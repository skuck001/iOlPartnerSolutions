import React, { createContext, useContext, useCallback, useRef, useState, useMemo } from 'react';
import type { 
  Account, 
  Contact, 
  Opportunity, 
  Product, 
  Task, 
  User 
} from '../types';
import { useApi } from '../hooks/useApi';

// Cache interfaces
interface DataCache {
  data: any;
  timestamp: number;
  loading: boolean;
}

interface RequestPromise {
  promise: Promise<any>;
  timestamp: number;
}

// Cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const REQUEST_TIMEOUT = 30 * 1000; // 30 seconds

// Data context interface
interface DataContextType {
  // Unified cache object
  cache: {
    accounts: Account[];
    contacts: Contact[];
    opportunities: Opportunity[];
    products: Product[];
    tasks: Task[];
    users: User[];
  };
  
  // Data getters
  getAccounts: () => Promise<Account[]>;
  getContacts: () => Promise<Contact[]>;
  getOpportunities: () => Promise<Opportunity[]>;
  getProducts: () => Promise<Product[]>;
  getTasks: () => Promise<Task[]>;
  getUsers: () => Promise<User[]>;
  
  // Batch data loader
  loadAllData: () => Promise<{
    accounts: Account[];
    contacts: Contact[];
    opportunities: Opportunity[];
    products: Product[];
    tasks: Task[];
    users: User[];
  }>;
  
  // Cache management
  clearCache: (dataType?: string) => void;
  refreshData: (dataType?: string) => Promise<void>;
  
  // Loading states
  loading: {
    accounts: boolean;
    contacts: boolean;
    opportunities: boolean;
    products: boolean;
    tasks: boolean;
    users: boolean;
  };
  
  // Direct data access (cached)
  getCachedAccounts: () => Account[];
  getCachedContacts: () => Contact[];
  getCachedOpportunities: () => Opportunity[];
  getCachedProducts: () => Product[];
  getCachedTasks: () => Task[];
  getCachedUsers: () => User[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useDataContext = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  return context;
};

interface DataProviderProps {
  children: React.ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const { callFunction } = useApi();
  
  // Cache storage
  const cacheRef = useRef<Record<string, DataCache>>({});
  
  // Active request tracking (for deduplication)
  const activeRequestsRef = useRef<Record<string, RequestPromise>>({});
  
  // Loading states
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});
  
  // State-based cache for reactive updates
  const [cacheState, setCacheState] = useState({
    accounts: [] as Account[],
    contacts: [] as Contact[],
    opportunities: [] as Opportunity[],
    products: [] as Product[],
    tasks: [] as Task[],
    users: [] as User[]
  });

  // Helper to check if cache is valid
  const isCacheValid = useCallback((cacheKey: string): boolean => {
    const cache = cacheRef.current[cacheKey];
    if (!cache || !cache.data) return false;
    return Date.now() - cache.timestamp < CACHE_DURATION;
  }, []);

  // Helper to get cached data
  const getCachedData = useCallback((cacheKey: string): any => {
    return isCacheValid(cacheKey) ? cacheRef.current[cacheKey]?.data : null;
  }, [isCacheValid]);

  // Helper to set cache
  const setCache = useCallback((cacheKey: string, data: any): void => {
    cacheRef.current[cacheKey] = {
      data,
      timestamp: Date.now(),
      loading: false
    };
    
    // Update state-based cache for reactive updates
    if (cacheKey.startsWith('accounts_')) {
      setCacheState(prev => ({ ...prev, accounts: data }));
    } else if (cacheKey.startsWith('contacts_')) {
      setCacheState(prev => ({ ...prev, contacts: data }));
    } else if (cacheKey.startsWith('opportunities_')) {
      setCacheState(prev => ({ ...prev, opportunities: data }));
    } else if (cacheKey.startsWith('products_')) {
      setCacheState(prev => ({ ...prev, products: data }));
    } else if (cacheKey.startsWith('tasks_')) {
      setCacheState(prev => ({ ...prev, tasks: data }));
    } else if (cacheKey.startsWith('users_')) {
      setCacheState(prev => ({ ...prev, users: data }));
    }
  }, []);

  // Helper to update loading state
  const setLoading = useCallback((dataType: string, loading: boolean): void => {
    setLoadingStates(prev => ({ ...prev, [dataType]: loading }));
    
    // Also update cache loading state
    if (cacheRef.current[dataType]) {
      cacheRef.current[dataType].loading = loading;
    } else if (loading) {
      cacheRef.current[dataType] = {
        data: null,
        timestamp: 0,
        loading: true
      };
    }
  }, []);

  // Generic data fetcher with deduplication
  const fetchDataImpl = async (
    dataType: string,
    cloudFunctionName: string,
    params?: any
  ): Promise<any> => {
    const cacheKey = `${dataType}_${JSON.stringify(params || {})}`;
    
    // Return cached data if valid
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      console.log(`Returning cached ${dataType}:`, cachedData.length || 'data');
      return cachedData;
    }

    // Check if there's already an active request for this data
    const activeRequest = activeRequestsRef.current[cacheKey];
    if (activeRequest && Date.now() - activeRequest.timestamp < REQUEST_TIMEOUT) {
      console.log(`Reusing active request for ${dataType}`);
      return activeRequest.promise;
    }

    // Start new request
    console.log(`Fetching fresh ${dataType} from Cloud Functions...`);
    setLoading(dataType, true);

    const requestPromise = (async () => {
      try {
        const response = await callFunction(cloudFunctionName, params);
        
        let data: T;
        if (response.data) {
          // Handle response with data wrapper
          if (Array.isArray(response.data)) {
            data = response.data as T;
          } else if (response.data.accounts || response.data.contacts || 
                     response.data.opportunities || response.data.products || 
                     response.data.tasks || response.data.users) {
            // Handle specific data property
            data = response.data[dataType] || response.data as T;
          } else {
            data = response.data as T;
          }
        } else {
          // Handle direct response
          data = response as T;
        }

        // Process data based on type to extract arrays from response objects
        let processedData = data;
        if (dataType === 'accounts' && data && !Array.isArray(data) && data.accounts) {
          processedData = data.accounts;
        } else if (dataType === 'contacts' && data && !Array.isArray(data) && data.contacts) {
          processedData = data.contacts;
        } else if (dataType === 'opportunities' && data && !Array.isArray(data) && data.opportunities) {
          processedData = data.opportunities;
        } else if (dataType === 'products' && data && !Array.isArray(data) && data.products) {
          processedData = data.products;
        } else if (dataType === 'tasks' && data && !Array.isArray(data) && data.tasks) {
          processedData = data.tasks;
        } else if (dataType === 'users' && data && !Array.isArray(data) && data.users) {
          processedData = data.users;
        }

        // Cache the processed result
        setCache(cacheKey, processedData);
        
        console.log(`Cached ${dataType}:`, Array.isArray(processedData) ? processedData.length : 'data');
        return processedData;
      } catch (error) {
        console.error(`Error fetching ${dataType}:`, error);
        throw error;
      } finally {
        setLoading(dataType, false);
        // Clean up active request
        delete activeRequestsRef.current[cacheKey];
      }
    })();

    // Store active request for deduplication
    activeRequestsRef.current[cacheKey] = {
      promise: requestPromise,
      timestamp: Date.now()
    };

    return requestPromise;
  };

  const fetchData = useCallback(fetchDataImpl, [callFunction, getCachedData, setCache, setLoading]);

  // Specific data fetchers
  const getAccounts = useCallback(async (): Promise<Account[]> => {
    const result = await fetchData('accounts', 'getAccounts', {});
    return Array.isArray(result) ? result : result.accounts || [];
  }, [fetchData]);

  const getContacts = useCallback(async (): Promise<Contact[]> => {
    const result = await fetchData('contacts', 'getContacts', {});
    return Array.isArray(result) ? result : result.contacts || [];
  }, [fetchData]);

  const getOpportunities = useCallback(async (): Promise<Opportunity[]> => {
    const result = await fetchData('opportunities', 'getOpportunities', {});
    return Array.isArray(result) ? result : result.opportunities || [];
  }, [fetchData]);

  const getProducts = useCallback(async (): Promise<Product[]> => {
    const result = await fetchData('products', 'getProducts', {});
    return Array.isArray(result) ? result : result.products || [];
  }, [fetchData]);

  const getTasks = useCallback(async (): Promise<Task[]> => {
    const result = await fetchData('tasks', 'getTasks', {});
    return Array.isArray(result) ? result : result.tasks || [];
  }, [fetchData]);

  const getUsers = useCallback(async (): Promise<User[]> => {
    const result = await fetchData('users', 'getUsers', { limit: 100 });
    return Array.isArray(result) ? result : result.users || [];
  }, [fetchData]);

  // Batch data loader for dashboard
  const loadAllData = useCallback(async () => {
    console.log('Loading all data using batch endpoint...');
    
    try {
      // Use the new batch endpoint for better performance
      const response = await callFunction('batchLoadDashboardData', {
        includeAccounts: true,
        includeContacts: true,
        includeOpportunities: true,
        includeProducts: true,
        includeTasks: true,
        includeUsers: true,
        limit: 100
      });

      const data = response.data;
      
      console.log('Batch data loaded successfully:', {
        accounts: data.accounts?.length || 0,
        contacts: data.contacts?.length || 0,
        opportunities: data.opportunities?.length || 0,
        products: data.products?.length || 0,
        tasks: data.tasks?.length || 0,
        users: data.users?.length || 0,
        loadTime: data.loadTime
      });

      // Cache each data type individually for future access
      if (data.accounts) setCache('accounts_{}', data.accounts);
      if (data.contacts) setCache('contacts_{}', data.contacts);
      if (data.opportunities) setCache('opportunities_{}', data.opportunities);
      if (data.products) setCache('products_{}', data.products);
      if (data.tasks) setCache('tasks_{}', data.tasks);
      if (data.users) setCache('users_{"limit":100}', data.users);

      return {
        accounts: data.accounts || [],
        contacts: data.contacts || [],
        opportunities: data.opportunities || [],
        products: data.products || [],
        tasks: data.tasks || [],
        users: data.users || []
      };
    } catch (error) {
      console.warn('Batch endpoint failed, falling back to individual calls:', error);
      
      // Fallback to individual calls if batch fails
      const [accounts, contacts, opportunities, products, tasks, users] = await Promise.all([
        getAccounts(),
        getContacts(),
        getOpportunities(),
        getProducts(),
        getTasks(),
        getUsers()
      ]);

      console.log('Fallback data loaded:', {
        accounts: accounts.length,
        contacts: contacts.length,
        opportunities: opportunities.length,
        products: products.length,
        tasks: tasks.length,
        users: users.length
      });

      return { accounts, contacts, opportunities, products, tasks, users };
    }
  }, [callFunction, getAccounts, getContacts, getOpportunities, getProducts, getTasks, getUsers, setCache]);

  // Cache management
  const clearCache = useCallback((dataType?: string): void => {
    if (dataType) {
      // Clear specific cache
      Object.keys(cacheRef.current).forEach(key => {
        if (key.startsWith(dataType)) {
          delete cacheRef.current[key];
        }
      });
      console.log(`Cleared ${dataType} cache`);
    } else {
      // Clear all cache
      cacheRef.current = {};
      console.log('Cleared all cache');
    }
  }, []);

  const refreshData = useCallback(async (dataType?: string): Promise<void> => {
    if (dataType) {
      clearCache(dataType);
      // Trigger fresh fetch
      switch (dataType) {
        case 'accounts':
          await getAccounts();
          break;
        case 'contacts':
          await getContacts();
          break;
        case 'opportunities':
          await getOpportunities();
          break;
        case 'products':
          await getProducts();
          break;
        case 'tasks':
          await getTasks();
          break;
        case 'users':
          await getUsers();
          break;
      }
    } else {
      clearCache();
      await loadAllData();
    }
  }, [clearCache, getAccounts, getContacts, getOpportunities, getProducts, getTasks, getUsers, loadAllData]);

  // Structured loading states
  const loading = useMemo(() => ({
    accounts: loadingStates.accounts || false,
    contacts: loadingStates.contacts || false,
    opportunities: loadingStates.opportunities || false,
    products: loadingStates.products || false,
    tasks: loadingStates.tasks || false,
    users: loadingStates.users || false
  }), [loadingStates]);

  // Direct cached data access (synchronous)
  const getCachedAccounts = useCallback((): Account[] => {
    return getCachedData('accounts_{}') || [];
  }, [getCachedData]);

  const getCachedContacts = useCallback((): Contact[] => {
    return getCachedData('contacts_{}') || [];
  }, [getCachedData]);

  const getCachedOpportunities = useCallback((): Opportunity[] => {
    return getCachedData('opportunities_{}') || [];
  }, [getCachedData]);

  const getCachedProducts = useCallback((): Product[] => {
    return getCachedData('products_{}') || [];
  }, [getCachedData]);

  const getCachedTasks = useCallback((): Task[] => {
    return getCachedData('tasks_{}') || [];
  }, [getCachedData]);

  const getCachedUsers = useCallback((): User[] => {
    return getCachedData('users_{"limit":100}') || [];
  }, [getCachedData]);

  // Use state-based cache for reactive updates
  const cache = cacheState;

  const value: DataContextType = {
    // Unified cache object
    cache,
    
    // Data getters
    getAccounts,
    getContacts,
    getOpportunities,
    getProducts,
    getTasks,
    getUsers,
    
    // Batch loader
    loadAllData,
    
    // Cache management
    clearCache,
    refreshData,
    
    // Loading states
    loading,
    
    // Direct cached access
    getCachedAccounts,
    getCachedContacts,
    getCachedOpportunities,
    getCachedProducts,
    getCachedTasks,
    getCachedUsers
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}; 