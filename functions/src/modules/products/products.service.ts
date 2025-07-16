import { 
  Firestore, 
  Query,
  Timestamp 
} from 'firebase-admin/firestore';
import { Product, ProductCategory, ProductSubcategory } from '../../types';
import { AuditService } from '../../shared/audit.service';

export interface ProductFilters {
  ownerId?: string;
  accountId?: string;
  category?: ProductCategory;
  subcategory?: ProductSubcategory;
  status?: string;
  businessType?: string;
  search?: string;
  version?: string;
}

export interface ProductsQueryOptions {
  filters?: ProductFilters;
  sortBy?: 'name' | 'category' | 'subcategory' | 'status' | 'version' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ProductsResponse {
  products: Product[];
  total: number;
  hasMore: boolean;
}

export interface ProductStats {
  total: number;
  byCategory: Record<ProductCategory, number>;
  byStatus: Record<string, number>;
  byBusinessType: Record<string, number>;
  activeConnections: number;
  newThisWeek: number;
}

export class ProductsService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  async getProducts(options: ProductsQueryOptions = {}): Promise<ProductsResponse> {
    const {
      filters = {},
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      limit = 50,
      offset = 0
    } = options;

    let query: Query = this.db.collection('products');

    // Apply filters
    if (filters.ownerId) {
      query = query.where('ownerId', '==', filters.ownerId);
    }

    if (filters.accountId) {
      query = query.where('accountId', '==', filters.accountId);
    }

    if (filters.category) {
      query = query.where('category', '==', filters.category);
    }

    if (filters.subcategory) {
      query = query.where('subcategory', '==', filters.subcategory);
    }

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }

    if (filters.businessType) {
      query = query.where('businessType', '==', filters.businessType);
    }

    if (filters.version) {
      query = query.where('version', '==', filters.version);
    }

    // Apply sorting
    query = query.orderBy(sortBy, sortOrder);

    // Apply pagination
    if (offset > 0) {
      const offsetSnapshot = await query.limit(offset).get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    query = query.limit(limit + 1); // Get one extra to check if there are more

    const snapshot = await query.get();
    const products = snapshot.docs.slice(0, limit).map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Product[];

    // Apply client-side search filter if needed
    let filteredProducts = products;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredProducts = products.filter(product =>
        product.name?.toLowerCase().includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower) ||
        product.businessType?.toLowerCase().includes(searchLower) ||
        product.features?.some((feature: string) => feature.toLowerCase().includes(searchLower))
      );
    }

    // Get total count for pagination
    const totalQuery = this.buildFilterQuery(filters);
    const totalSnapshot = await totalQuery.count().get();
    const total = totalSnapshot.data().count;

    return {
      products: filteredProducts,
      total,
      hasMore: snapshot.docs.length > limit
    };
  }

  async getProduct(productId: string): Promise<Product | null> {
    const doc = await this.db.collection('products').doc(productId).get();
    
    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data()
    } as Product;
  }

  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>, userId: string): Promise<Product> {
    // Validate required fields
    if (!productData.name) {
      throw new Error('Product name is required');
    }

    if (!productData.category) {
      throw new Error('Product category is required');
    }

    if (!productData.accountId) {
      throw new Error('Account ID is required');
    }

    // Check for duplicate name within the same account
    const existingProducts = await this.db.collection('products')
      .where('accountId', '==', productData.accountId)
      .where('name', '==', productData.name)
      .get();

    if (!existingProducts.empty) {
      throw new Error('A product with this name already exists for this account');
    }

    const now = Timestamp.now();
    const product: Omit<Product, 'id'> = {
      ...productData,
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
      status: productData.status || 'Development',
      features: productData.features || [],
      integrations: productData.integrations || [],
      tags: productData.tags || []
    };

    const docRef = await this.db.collection('products').add(product);
    const newProduct = { id: docRef.id, ...product } as Product;

    // Audit log
    await AuditService.log({
      userId,
      action: 'create',
      resourceType: 'product',
      resourceId: docRef.id,
      data: { productName: product.name, accountId: product.accountId, category: product.category }
    });

    return newProduct;
  }

  async updateProduct(productId: string, updates: Partial<Product>, userId: string): Promise<Product> {
    const productRef = this.db.collection('products').doc(productId);
    const doc = await productRef.get();

    if (!doc.exists) {
      throw new Error('Product not found');
    }

    const existingProduct = doc.data() as Product;

    // Check for name conflicts if name is being updated
    if (updates.name && updates.name !== existingProduct.name) {
      const nameCheck = await this.db.collection('products')
        .where('accountId', '==', existingProduct.accountId)
        .where('name', '==', updates.name)
        .get();

      if (!nameCheck.empty && nameCheck.docs[0].id !== productId) {
        throw new Error('A product with this name already exists for this account');
      }
    }

    const updateData = {
      ...updates,
      updatedAt: Timestamp.now()
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    await productRef.update(updateData);

    const updatedProduct = {
      ...existingProduct,
      ...updateData,
      id: productId
    } as Product;

    // Audit log
    await AuditService.log({
      userId,
      action: 'update',
      resourceType: 'product',
      resourceId: productId,
      data: { 
        productName: updatedProduct.name,
        updatedFields: Object.keys(updates)
      }
    });

    return updatedProduct;
  }

  async deleteProduct(productId: string, userId: string): Promise<void> {
    const productRef = this.db.collection('products').doc(productId);
    const doc = await productRef.get();

    if (!doc.exists) {
      throw new Error('Product not found');
    }

    const product = doc.data() as Product;

    // Check for dependencies (opportunities, contacts, etc.)
    const opportunitiesQuery = await this.db.collection('opportunities')
      .where('productId', '==', productId)
      .get();

    if (!opportunitiesQuery.empty) {
      throw new Error('Cannot delete product: product is referenced by opportunities');
    }

    const contactsQuery = await this.db.collection('contacts')
      .where('productIds', 'array-contains', productId)
      .get();

    if (!contactsQuery.empty) {
      throw new Error('Cannot delete product: product is referenced by contacts');
    }

    await productRef.delete();

    // Audit log
    await AuditService.log({
      userId,
      action: 'delete',
      resourceType: 'product',
      resourceId: productId,
      data: { productName: product.name, accountId: product.accountId }
    });
  }

  async getProductsStats(filters: ProductFilters = {}): Promise<ProductStats> {
    const query = this.buildFilterQuery(filters);
    const snapshot = await query.get();
    const products = snapshot.docs.map(doc => doc.data()) as Product[];

    const stats: ProductStats = {
      total: products.length,
      byCategory: {
        'GDS': 0,
        'PMS': 0,
        'CRS': 0,
        'API': 0,
        'Middleware': 0,
        'Other': 0
      },
      byStatus: {},
      byBusinessType: {},
      activeConnections: 0,
      newThisWeek: 0
    };

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    products.forEach(product => {
      // Count by category
      if (product.category) {
        stats.byCategory[product.category]++;
      }

      // Count by status
      if (product.status) {
        stats.byStatus[product.status] = (stats.byStatus[product.status] || 0) + 1;
      }

      // Count by business type
      if (product.businessType) {
        stats.byBusinessType[product.businessType] = (stats.byBusinessType[product.businessType] || 0) + 1;
      }

      // Count active connections (products with live status)
      if (product.status === 'Live' || product.status === 'Production') {
        stats.activeConnections++;
      }

      // Count new this week
      if (product.createdAt && product.createdAt.toDate() > oneWeekAgo) {
        stats.newThisWeek++;
      }
    });

    return stats;
  }

  async bulkUpdateProducts(updates: Array<{ id: string; data: Partial<Product> }>, userId: string): Promise<Product[]> {
    const batch = this.db.batch();
    const updatedProducts: Product[] = [];

    for (const update of updates) {
      const productRef = this.db.collection('products').doc(update.id);
      const doc = await productRef.get();

      if (!doc.exists) {
        continue;
      }

      const existingProduct = doc.data() as Product;
      const updateData = {
        ...update.data,
        updatedAt: Timestamp.now()
      };

      batch.update(productRef, updateData);

      updatedProducts.push({
        ...existingProduct,
        ...updateData,
        id: update.id
      } as Product);
    }

    await batch.commit();

    // Audit log
    await AuditService.log({
      userId,
      action: 'bulk_update',
      resourceType: 'product',
      resourceId: 'multiple',
      data: { count: updates.length }
    });

    return updatedProducts;
  }

  private buildFilterQuery(filters: ProductFilters): Query {
    let query: Query = this.db.collection('products');

    if (filters.ownerId) {
      query = query.where('ownerId', '==', filters.ownerId);
    }

    if (filters.accountId) {
      query = query.where('accountId', '==', filters.accountId);
    }

    if (filters.category) {
      query = query.where('category', '==', filters.category);
    }

    if (filters.subcategory) {
      query = query.where('subcategory', '==', filters.subcategory);
    }

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }

    if (filters.businessType) {
      query = query.where('businessType', '==', filters.businessType);
    }

    if (filters.version) {
      query = query.where('version', '==', filters.version);
    }

    return query;
  }
} 