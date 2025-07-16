import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { validateData } from '../../shared/validation.middleware';
import { authenticateUser } from '../../shared/auth.middleware';
import { ProductsService, ProductFilters, ProductsQueryOptions } from './products.service';
import { z } from 'zod';

const db = getFirestore();
const productsService = new ProductsService(db);

// Validation schemas
const ProductFiltersSchema = z.object({
  ownerId: z.string().optional(),
  accountId: z.string().optional(),
  category: z.enum(['GDS', 'PMS', 'CRS', 'API', 'Middleware', 'Other']).optional(),
  subcategory: z.enum(['Booking Engine', 'Payment Gateway', 'Property Management', 'Channel Manager', 'Rate Management', 'Analytics', 'Integration Platform', 'API Gateway', 'Other']).optional(),
  status: z.string().optional(),
  businessType: z.string().optional(),
  search: z.string().optional(),
  version: z.string().optional()
});

const ProductsQuerySchema = z.object({
  filters: ProductFiltersSchema.optional(),
  sortBy: z.enum(['name', 'category', 'subcategory', 'status', 'version', 'createdAt', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional()
});

const CreateProductSchema = z.object({
  name: z.string().min(1),
  accountId: z.string().min(1),
  category: z.enum(['GDS', 'PMS', 'CRS', 'API', 'Middleware', 'Other']),
  subcategory: z.enum(['Booking Engine', 'Payment Gateway', 'Property Management', 'Channel Manager', 'Rate Management', 'Analytics', 'Integration Platform', 'API Gateway', 'Other']).optional(),
  description: z.string().optional(),
  businessType: z.string().optional(),
  status: z.string().optional(),
  version: z.string().optional(),
  features: z.array(z.string()).optional(),
  integrations: z.array(z.string()).optional(),
  documentation: z.string().optional(),
  support: z.string().optional(),
  pricing: z.string().optional(),
  tags: z.array(z.string()).optional()
});

const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(['GDS', 'PMS', 'CRS', 'API', 'Middleware', 'Other']).optional(),
  subcategory: z.enum(['Booking Engine', 'Payment Gateway', 'Property Management', 'Channel Manager', 'Rate Management', 'Analytics', 'Integration Platform', 'API Gateway', 'Other']).optional(),
  description: z.string().nullish().transform(val => val ?? undefined),
  businessType: z.string().nullish().transform(val => val ?? undefined),
  status: z.string().nullish().transform(val => val ?? undefined),
  version: z.string().nullish().transform(val => val ?? undefined),
  features: z.array(z.string()).optional(),
  integrations: z.array(z.string()).optional(),
  documentation: z.string().nullish().transform(val => val ?? undefined),
  support: z.string().nullish().transform(val => val ?? undefined),
  pricing: z.string().nullish().transform(val => val ?? undefined),
  tags: z.array(z.string()).optional(),
  ownerId: z.string().optional()
});

const BulkUpdateProductsSchema = z.object({
  updates: z.array(z.object({
    id: z.string().min(1),
    data: UpdateProductSchema
  })).min(1).max(50)
});

// Get products with filtering and pagination
export const getProducts = onCall(
  { cors: true },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      const validatedData = validateData(ProductsQuerySchema, request.data);

      const options: ProductsQueryOptions = {
        ...validatedData,
        filters: {
          ...validatedData.filters,
          ownerId: user.uid // Always filter by current user
        }
      };

      const result = await productsService.getProducts(options);
      
      return {
        success: true,
        data: result,
        resultCount: result.products.length
      };
    } catch (error) {
      console.error('Error in getProducts:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to get products');
    }
  }
);

// Get single product
export const getProduct = onCall(
  { cors: true },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      if (!request.data?.productId) {
        throw new HttpsError('invalid-argument', 'Product ID is required');
      }

      const product = await productsService.getProduct(request.data.productId);
      
      if (!product) {
        throw new HttpsError('not-found', 'Product not found');
      }

      // Check ownership
      if (product.ownerId !== user.uid) {
        throw new HttpsError('permission-denied', 'Access denied');
      }

      return {
        success: true,
        data: product
      };
    } catch (error) {
      console.error('Error in getProduct:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to get product');
    }
  }
);

// Create new product
export const createProduct = onCall(
  { cors: true },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      const validatedData = validateData(CreateProductSchema, request.data);

      const newProduct = await productsService.createProduct(validatedData, user.uid);

      return {
        success: true,
        data: newProduct
      };
    } catch (error) {
      console.error('Error in createProduct:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError('internal', 'Failed to create product');
    }
  }
);

// Update product
export const updateProduct = onCall(
  { cors: true },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      if (!request.data?.productId) {
        throw new HttpsError('invalid-argument', 'Product ID is required');
      }

      const validatedData = validateData(UpdateProductSchema, request.data.updates);

      // Check if product exists and user owns it
      const existingProduct = await productsService.getProduct(request.data.productId);
      if (!existingProduct) {
        throw new HttpsError('not-found', 'Product not found');
      }
      if (existingProduct.ownerId !== user.uid) {
        throw new HttpsError('permission-denied', 'Access denied');
      }

      const updatedProduct = await productsService.updateProduct(
        request.data.productId,
        validatedData,
        user.uid
      );

      return {
        success: true,
        data: updatedProduct
      };
    } catch (error) {
      console.error('Error in updateProduct:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError('internal', 'Failed to update product');
    }
  }
);

// Delete product
export const deleteProduct = onCall(
  { cors: true },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      if (!request.data?.productId) {
        throw new HttpsError('invalid-argument', 'Product ID is required');
      }

      // Check if product exists and user owns it
      const existingProduct = await productsService.getProduct(request.data.productId);
      if (!existingProduct) {
        throw new HttpsError('not-found', 'Product not found');
      }
      if (existingProduct.ownerId !== user.uid) {
        throw new HttpsError('permission-denied', 'Access denied');
      }

      await productsService.deleteProduct(request.data.productId, user.uid);

      return {
        success: true,
        message: 'Product deleted successfully'
      };
    } catch (error) {
      console.error('Error in deleteProduct:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError('internal', 'Failed to delete product');
    }
  }
);

// Get products statistics
export const getProductsStats = onCall(
  { cors: true },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      const validatedData = validateData(ProductFiltersSchema, request.data || {});

      const filters: ProductFilters = {
        ...validatedData,
        ownerId: user.uid // Always filter by current user
      };

      const stats = await productsService.getProductsStats(filters);

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Error in getProductsStats:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to get products statistics');
    }
  }
);

// Bulk update products
export const bulkUpdateProducts = onCall(
  { cors: true },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      const validatedData = validateData(BulkUpdateProductsSchema, request.data);

      // Verify ownership of all products
      for (const update of validatedData.updates) {
        const product = await productsService.getProduct(update.id);
        if (!product || product.ownerId !== user.uid) {
          throw new HttpsError('permission-denied', `Access denied for product ${update.id}`);
        }
      }

      const updatedProducts = await productsService.bulkUpdateProducts(
        validatedData.updates,
        user.uid
      );

      return {
        success: true,
        data: updatedProducts
      };
    } catch (error) {
      console.error('Error in bulkUpdateProducts:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError('internal', 'Failed to bulk update products');
    }
  }
); 