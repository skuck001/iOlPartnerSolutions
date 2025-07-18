import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { validateData, ValidationError } from '../../shared/validation.middleware';
import { authenticateUser } from '../../shared/auth.middleware';
import { RateLimiter, RateLimitPresets } from '../../shared/rateLimiter';
import { ProductsService, ProductFilters, ProductsQueryOptions } from './products.service';
import { z } from 'zod';

const db = getFirestore();
const productsService = new ProductsService(db);

// Validation schemas
const ProductFiltersSchema = z.object({
  ownerId: z.string().optional(),
  accountId: z.string().optional(),
  category: z.enum(['Business Intelligence', 'Revenue Management', 'Distribution', 'Guest Experience', 'Operations', 'Connectivity', 'Booking Engine', 'Channel Management', 'Other']).optional(),
  subcategory: z.enum(['Rate Shopping Tools', 'Competitive Intelligence', 'Market Analytics', 'Demand Forecasting', 'Pricing Optimization', 'Reservation Systems', 'Property Management', 'Guest Communication', 'Loyalty Programs', 'API Integration', 'Data Connectivity', 'Other']).optional(),
  status: z.enum(['Active', 'Deprecated', 'Development', 'Beta']).optional(),
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
  category: z.enum(['Business Intelligence', 'Revenue Management', 'Distribution', 'Guest Experience', 'Operations', 'Connectivity', 'Booking Engine', 'Channel Management', 'Other']),
  subcategory: z.enum(['Rate Shopping Tools', 'Competitive Intelligence', 'Market Analytics', 'Demand Forecasting', 'Pricing Optimization', 'Reservation Systems', 'Property Management', 'Guest Communication', 'Loyalty Programs', 'API Integration', 'Data Connectivity', 'Other']).nullish(),
  description: z.string().nullish(),
  version: z.string().nullish(),
  status: z.enum(['Active', 'Deprecated', 'Development', 'Beta']).nullish(),
  website: z.string().nullish(),
  contactIds: z.array(z.string()).nullish(),
  tags: z.array(z.string()).nullish(),
  targetMarket: z.string().nullish(),
  pricing: z.string().nullish(),
  notes: z.string().nullish(),
  ownerId: z.string().min(1)
}).transform(data => {
  // Remove null, undefined, and empty string values to prevent Firestore errors
  const cleanData: any = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      cleanData[key] = value;
    }
  });
  return cleanData;
});

const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(['Business Intelligence', 'Revenue Management', 'Distribution', 'Guest Experience', 'Operations', 'Connectivity', 'Booking Engine', 'Channel Management', 'Other']).optional(),
  subcategory: z.enum(['Rate Shopping Tools', 'Competitive Intelligence', 'Market Analytics', 'Demand Forecasting', 'Pricing Optimization', 'Reservation Systems', 'Property Management', 'Guest Communication', 'Loyalty Programs', 'API Integration', 'Data Connectivity', 'Other']).nullish(),
  description: z.string().nullish(),
  version: z.string().nullish(),
  status: z.enum(['Active', 'Deprecated', 'Development', 'Beta']).nullish(),
  website: z.string().nullish(),
  contactIds: z.array(z.string()).nullish(),
  tags: z.array(z.string()).nullish(),
  targetMarket: z.string().nullish(),
  pricing: z.string().nullish(),
  notes: z.string().nullish(),
  ownerId: z.string().optional()
}).transform(data => {
  // Remove null, undefined, and empty string values to prevent Firestore errors
  const cleanData: any = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      cleanData[key] = value;
    }
  });
  return cleanData;
});

const BulkUpdateProductsSchema = z.object({
  updates: z.array(z.object({
    id: z.string().min(1),
    data: UpdateProductSchema
  })).min(1).max(50)
});

// Get products with filtering and pagination
export const getProducts = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for read operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.read.maxRequests, RateLimitPresets.read.windowMs, 'getProducts');
      
      const validatedData = validateData(ProductsQuerySchema, request.data);

      const options: ProductsQueryOptions = {
        ...validatedData,
        filters: {
          ...validatedData.filters
          // Removed ownerId filter - allow access to all products
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
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for read operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.read.maxRequests, RateLimitPresets.read.windowMs, 'getProduct');
      
      if (!request.data?.productId) {
        throw new HttpsError('invalid-argument', 'Product ID is required');
      }

      const product = await productsService.getProduct(request.data.productId);
      
      if (!product) {
        throw new HttpsError('not-found', 'Product not found');
      }

      // Removed ownership check - allow access to all products

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
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'createProduct');
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
      if (error instanceof ValidationError) {
        console.error('Validation errors:', error.errors);
        throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
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
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'updateProduct');
      
      if (!request.data?.productId) {
        throw new HttpsError('invalid-argument', 'Product ID is required');
      }

      const validatedData = validateData(UpdateProductSchema, request.data.updates);

      // Check if product exists - removed ownership check
      const existingProduct = await productsService.getProduct(request.data.productId);
      if (!existingProduct) {
        throw new HttpsError('not-found', 'Product not found');
      }
      // Removed ownership check - allow updates to all products

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
      if (error instanceof ValidationError) {
        console.error('Validation errors:', error.errors);
        throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
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
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'deleteProduct');
      
      if (!request.data?.productId) {
        throw new HttpsError('invalid-argument', 'Product ID is required');
      }

      // Check if product exists - removed ownership check
      const existingProduct = await productsService.getProduct(request.data.productId);
      if (!existingProduct) {
        throw new HttpsError('not-found', 'Product not found');
      }
      // Removed ownership check - allow deletion of all products

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
      if (error instanceof ValidationError) {
        console.error('Validation errors:', error.errors);
        throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
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
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for stats operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.stats.maxRequests, RateLimitPresets.stats.windowMs, 'getProductsStats');
      const validatedData = validateData(ProductFiltersSchema, request.data || {});

      const filters: ProductFilters = {
        ...validatedData
        // Removed ownerId filter - allow stats for all products
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
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for heavy operations (bulk updates)
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.heavy.maxRequests, RateLimitPresets.heavy.windowMs, 'bulkUpdateProducts');
      const validatedData = validateData(BulkUpdateProductsSchema, request.data);

      // Verify all products exist - removed ownership verification
      for (const update of validatedData.updates) {
        const product = await productsService.getProduct(update.id);
        if (!product) {
          throw new HttpsError('not-found', `Product not found: ${update.id}`);
        }
      }
      // Removed ownership checks - allow bulk updates to all products

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
      if (error instanceof ValidationError) {
        console.error('Validation errors:', error.errors);
        throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
      }
      if (error instanceof Error) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError('internal', 'Failed to bulk update products');
    }
  }
); 