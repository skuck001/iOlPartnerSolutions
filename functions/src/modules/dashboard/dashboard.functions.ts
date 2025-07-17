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
    cors: [
      /firebase\.com$/,
      /.*\.firebaseapp\.com$/,
      /localhost/,
    ],
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
          filters: { ownerId: user.uid },
          limit: validatedData.limit 
        }));
        dataKeys.push('contacts');
      }

      if (validatedData.includeOpportunities) {
        dataPromises.push(opportunitiesService.getOpportunities({ 
          filters: { ownerId: user.uid },
          limit: validatedData.limit 
        }));
        dataKeys.push('opportunities');
      }

      if (validatedData.includeProducts) {
        dataPromises.push(productsService.getProducts({ 
          filters: { ownerId: user.uid },
          limit: validatedData.limit 
        }));
        dataKeys.push('products');
      }

      if (validatedData.includeTasks) {
        dataPromises.push(tasksService.getTasks({ 
          filters: { assignedTo: user.uid },
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