import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { getFirestore } from 'firebase-admin/firestore';
import { authenticateUser } from '../../shared/auth.middleware';
import { AccountsService } from '../accounts/accounts.service';
import { ContactsService } from '../contacts/contacts.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';
import { ProductsService } from '../products/products.service';
import { TasksService } from '../tasks/tasks.service';
import { UsersService } from '../users/users.service';
import { z } from 'zod';

// Input validation schema
const batchLoadDataSchema = z.object({
  includeAccounts: z.boolean().optional().default(true),
  includeContacts: z.boolean().optional().default(true),
  includeOpportunities: z.boolean().optional().default(true),
  includeProducts: z.boolean().optional().default(true),
  includeTasks: z.boolean().optional().default(true),
  includeUsers: z.boolean().optional().default(true),
  limit: z.number().min(1).max(1000).optional().default(100)
});

// Simple validation function
const validateInput = <T>(schema: z.ZodSchema<T>, data: any): T => {
  try {
    return schema.parse(data || {});
  } catch (error) {
    throw new HttpsError('invalid-argument', 'Invalid input data');
  }
};

type BatchLoadDataInput = z.infer<typeof batchLoadDataSchema>;

interface BatchLoadDataResponse {
  accounts?: any[];
  contacts?: any[];
  opportunities?: any[];
  products?: any[];
  tasks?: any[];
  users?: any[];
  timestamp: number;
  loadTime: number;
}

/**
 * Batch load all dashboard data in a single call
 * This reduces the number of individual API calls and CORS preflight overhead
 * 
 * @param data - Configuration for which data to include
 * @returns All requested data in a single response
 */
export const batchLoadDashboardData = onCall(
  {
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'],
    maxInstances: 10,
    region: 'us-central1'
  },
  async (request) => {
    const startTime = Date.now();
    
    try {
      // Authenticate user
      const user = await authenticateUser(request.auth);
      logger.info('Batch loading dashboard data', { 
        userId: user.uid,
        userEmail: user.email,
        timestamp: new Date().toISOString()
      });

      // Validate input
      const validatedData = validateInput<BatchLoadDataInput>(batchLoadDataSchema, request.data);

      // Initialize services with database
      const db = getFirestore();
      const contactsService = new ContactsService(db);
      const opportunitiesService = new OpportunitiesService(db);
      const productsService = new ProductsService(db);
      const tasksService = new TasksService(db);
      const usersService = new UsersService(db);

      // Prepare parallel data loading promises
      const dataPromises: Promise<any>[] = [];
      const dataKeys: string[] = [];

      if (validatedData.includeAccounts) {
        dataPromises.push(AccountsService.getAccounts({ 
          userId: user.uid,
          limit: validatedData.limit 
        }));
        dataKeys.push('accounts');
      }

      if (validatedData.includeContacts) {
        dataPromises.push(contactsService.getContacts({ 
          limit: validatedData.limit 
        }));
        dataKeys.push('contacts');
      }

      if (validatedData.includeOpportunities) {
        dataPromises.push(opportunitiesService.getOpportunities({ 
          limit: validatedData.limit 
        }));
        dataKeys.push('opportunities');
      }

      if (validatedData.includeProducts) {
        dataPromises.push(productsService.getProducts({ 
          limit: validatedData.limit 
        }));
        dataKeys.push('products');
      }

      if (validatedData.includeTasks) {
        dataPromises.push(tasksService.getTasks({ 
          limit: validatedData.limit 
        }));
        dataKeys.push('tasks');
      }

      if (validatedData.includeUsers) {
        dataPromises.push(usersService.getUsers({ 
          limit: validatedData.limit 
        }));
        dataKeys.push('users');
      }

      // Execute all data loading in parallel
      logger.info('Loading data in parallel...', { 
        dataTypes: dataKeys,
        requestCount: dataPromises.length 
      });
      
      const results = await Promise.all(dataPromises);

      // Build response object
      const response: BatchLoadDataResponse = {
        timestamp: Date.now(),
        loadTime: Date.now() - startTime
      };

      // Map results to response object
      results.forEach((result, index) => {
        const key = dataKeys[index] as keyof BatchLoadDataResponse;
        if (key !== 'timestamp' && key !== 'loadTime') {
          // Extract actual data from service responses
          if (key === 'accounts' && result.accounts) {
            response[key] = result.accounts;
          } else if (key === 'contacts' && result.contacts) {
            response[key] = result.contacts;
          } else if (key === 'opportunities' && result.opportunities) {
            response[key] = result.opportunities;
          } else if (key === 'products' && result.products) {
            response[key] = result.products;
          } else if (key === 'tasks' && result.tasks) {
            response[key] = result.tasks;
          } else if (key === 'users' && result.users) {
            response[key] = result.users;
          } else {
            // Fallback: use result directly if it's an array
            response[key] = Array.isArray(result) ? result : [];
          }
        }
      });

      logger.info('Batch data load completed', {
        userId: user.uid,
        loadTime: response.loadTime,
        dataLoaded: Object.keys(response).filter(k => k !== 'timestamp' && k !== 'loadTime'),
        counts: {
          accounts: response.accounts?.length || 0,
          contacts: response.contacts?.length || 0,
          opportunities: response.opportunities?.length || 0,
          products: response.products?.length || 0,
          tasks: response.tasks?.length || 0,
          users: response.users?.length || 0
        }
      });

      return {
        success: true,
        data: response
      };

    } catch (error) {
      logger.error('Error in batch load dashboard data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userId: request.auth?.uid || 'unauthenticated',
        loadTime: Date.now() - startTime
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        'internal',
        'Failed to batch load dashboard data',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }
); 

/**
 * Get recently updated items across all collections
 * This replaces direct Firestore queries from the frontend for better security
 * 
 * @param data - Limit for number of items to return
 * @returns Recently updated items from all collections
 */
export const getRecentItems = onCall(
  {
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'],
    maxInstances: 10,
    region: 'us-central1'
  },
  async (request) => {
    try {
      // Authenticate user
      const user = await authenticateUser(request.auth);
      logger.info('Getting recent items', { 
        userId: user.uid,
        userEmail: user.email,
        timestamp: new Date().toISOString()
      });

      // Parse limit from request data
      const limit = Math.min(request.data?.limit || 5, 20); // Max 20 items

      // Initialize services with database
      const db = getFirestore();
      const contactsService = new ContactsService(db);
      const opportunitiesService = new OpportunitiesService(db);
      const productsService = new ProductsService(db);

      const allItems: any[] = [];

      try {
        // Get recent accounts (static method)
        const accountsResponse = await AccountsService.getAccounts({ 
          userId: user.uid,
          limit 
        });
        const accountItems = accountsResponse.accounts.map((item: any) => ({
          id: item.id,
          title: item.name,
          type: 'account' as const,
          updatedAt: item.updatedAt,
          subtitle: item.region || '',
          href: `/accounts/${item.id}`,
        }));
        allItems.push(...accountItems);
      } catch (error) {
        logger.warn('Error fetching recent accounts:', error);
      }

      try {
        // Get recent contacts
        const contactsResponse = await contactsService.getContacts({ 
          limit 
        });
        const contactItems = contactsResponse.contacts.map((item: any) => ({
          id: item.id,
          title: item.name,
          type: 'contact' as const,
          updatedAt: item.updatedAt,
          subtitle: item.position || item.email || '',
          href: `/contacts/${item.id}`,
        }));
        allItems.push(...contactItems);
      } catch (error) {
        logger.warn('Error fetching recent contacts:', error);
      }

      try {
        // Get recent opportunities
        const opportunitiesResponse = await opportunitiesService.getOpportunities({ 
          limit 
        });
        const opportunityItems = opportunitiesResponse.opportunities.map((item: any) => ({
          id: item.id,
          title: item.title,
          type: 'opportunity' as const,
          updatedAt: item.updatedAt,
          subtitle: item.stage || '',
          href: `/opportunities/${item.id}`,
        }));
        allItems.push(...opportunityItems);
      } catch (error) {
        logger.warn('Error fetching recent opportunities:', error);
      }

      try {
        // Get recent products
        const productsResponse = await productsService.getProducts({ 
          limit 
        });
        const productItems = productsResponse.products.map((item: any) => ({
          id: item.id,
          title: item.name,
          type: 'product' as const,
          updatedAt: item.updatedAt,
          subtitle: item.category || '',
          href: `/products/${item.id}`,
        }));
        allItems.push(...productItems);
      } catch (error) {
        logger.warn('Error fetching recent products:', error);
      }

      // Sort all items by updatedAt and return top items
      const sortedItems = allItems
        .filter(item => item.updatedAt) // Only include items with updatedAt
        .sort((a, b) => {
          const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : new Date(a.updatedAt).getTime();
          const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : new Date(b.updatedAt).getTime();
          return timeB - timeA;
        })
        .slice(0, limit);

      return {
        items: sortedItems,
        timestamp: Date.now(),
        count: sortedItems.length
      };

    } catch (error) {
      logger.error('Error getting recent items:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        'internal',
        'Failed to get recent items',
        { originalError: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }
); 