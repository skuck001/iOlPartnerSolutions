import { useState, useEffect, useCallback } from 'react';
import type { Product, ProductCategory, ProductSubcategory } from '../types/Product';
import { useApi } from './useApi';

export interface ProductFilters {
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

export const useProductsApi = () => {
  const { callFunction, loading, error } = useApi();
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<ProductStats | null>(null);



  // Get products with filtering and pagination
  const getProducts = useCallback(async (options: ProductsQueryOptions = {}) => {
    try {
      const response = await callFunction('getProducts', options);
      return response.data as ProductsResponse;
    } catch (err) {
      console.error('Error getting products:', err);
      throw err;
    }
  }, [callFunction]);

  // Get single product
  const getProduct = useCallback(async (productId: string): Promise<Product> => {
    try {
      const response = await callFunction('getProduct', { productId });
      return response.data as Product;
    } catch (err) {
      console.error('Error getting product:', err);
      throw err;
    }
  }, [callFunction]);

  // Create new product
  const createProduct = useCallback(async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> => {
    try {
      const response = await callFunction('createProduct', productData);
      const newProduct = response.data as Product;
      
      // Update local state
      setProducts(prev => [newProduct, ...prev]);
      
      return newProduct;
    } catch (err) {
      console.error('Error creating product:', err);
      throw err;
    }
  }, [callFunction]);

  // Update product
  const updateProduct = useCallback(async (productId: string, updates: Partial<Product>): Promise<Product> => {
    try {
      const response = await callFunction('updateProduct', {
        productId,
        updates
      });
      const updatedProduct = response.data as Product;
      
      // Update local state
      setProducts(prev => prev.map(product => 
        product.id === productId ? updatedProduct : product
      ));
      
      return updatedProduct;
    } catch (err) {
      console.error('Error updating product:', err);
      throw err;
    }
  }, [callFunction]);

  // Delete product
  const deleteProduct = useCallback(async (productId: string): Promise<void> => {
    try {
      await callFunction('deleteProduct', { productId });
      
      // Update local state
      setProducts(prev => prev.filter(product => product.id !== productId));
    } catch (err) {
      console.error('Error deleting product:', err);
      throw err;
    }
  }, [callFunction]);

  // Get products statistics
  const getProductsStats = useCallback(async (filters: ProductFilters = {}): Promise<ProductStats> => {
    try {
      const response = await callFunction('getProductsStats', filters);
      const statsData = response.data as ProductStats;
      setStats(statsData);
      return statsData;
    } catch (err) {
      console.error('Error getting products stats:', err);
      throw err;
    }
  }, [callFunction]);

  // Bulk update products
  const bulkUpdateProducts = useCallback(async (
    updates: Array<{ id: string; data: Partial<Product> }>
  ): Promise<Product[]> => {
    try {
      const response = await callFunction('bulkUpdateProducts', { updates });
      const updatedProducts = response.data as Product[];
      
      // Update local state
      setProducts(prev => prev.map(product => {
        const update = updatedProducts.find(updated => updated.id === product.id);
        return update || product;
      }));
      
      return updatedProducts;
    } catch (err) {
      console.error('Error bulk updating products:', err);
      throw err;
    }
  }, [callFunction]);

  // Load initial products
  const loadProducts = useCallback(async (options: ProductsQueryOptions = {}) => {
    try {
      const result = await getProducts(options);
      setProducts(result.products);
      return result;
    } catch (err) {
      console.error('Error loading products:', err);
      throw err;
    }
  }, [getProducts]);

  // Refresh products
  const refreshProducts = useCallback(async () => {
    await loadProducts();
  }, [loadProducts]);

  // Note: Auto-loading removed for performance. Use DataContext for cached data or call loadProducts() manually.
  // Auto-loading was causing duplicate API calls when multiple components used this hook.

  return {
    // Data
    products,
    stats,
    
    // Loading states
    loading,
    error,
    
    // API methods
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getProductsStats,
    bulkUpdateProducts,
    
    // Utility methods
    loadProducts,
    refreshProducts,
    
    // State setters (for direct manipulation if needed)
    setProducts,
    setStats
  };
}; 