import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { validateData } from '../../shared/validation.middleware';
import { authenticateUser } from '../../shared/auth.middleware';
import { RateLimiter, RateLimitPresets } from '../../shared/rateLimiter';
import { UsersService } from './users.service';
import { z } from 'zod';

const db = getFirestore();
const usersService = new UsersService(db);

// Validation schemas
const UserFiltersSchema = z.object({
  role: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  search: z.string().optional()
});

const UsersQuerySchema = z.object({
  filters: UserFiltersSchema.optional(),
  sortBy: z.enum(['displayName', 'email', 'lastLoginAt', 'createdAt', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional()
});

const UpdateUserSchema = z.object({
  displayName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  bio: z.string().optional(),
  timezone: z.string().optional(),
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    weekly: z.boolean()
  }).optional()
});

// Get users with filtering and pagination
export const getUsers = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.read.maxRequests, RateLimitPresets.read.windowMs, 'getUsers');
      
      const validatedData = validateData(UsersQuerySchema, request.data);
      const result = await usersService.getUsers(validatedData);
      
      return {
        success: true,
        data: result,
        resultCount: result.users.length
      };
    } catch (error) {
      console.error('Error in getUsers:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to get users');
    }
  }
);

// Get single user
export const getUser = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.read.maxRequests, RateLimitPresets.read.windowMs, 'getUser');
      
      if (!request.data?.userId) {
        throw new HttpsError('invalid-argument', 'User ID is required');
      }

      // Users can only get their own profile unless they're admin
      if (request.data.userId !== user.uid && user.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Access denied');
      }

      const userData = await usersService.getUser(request.data.userId);
      
      if (!userData) {
        throw new HttpsError('not-found', 'User not found');
      }

      return {
        success: true,
        data: userData
      };
    } catch (error) {
      console.error('Error in getUser:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to get user');
    }
  }
);

// Update user profile
export const updateUser = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'updateUser');
      
      const validatedData = validateData(UpdateUserSchema, request.data);

      if (!request.data?.userId) {
        throw new HttpsError('invalid-argument', 'User ID is required');
      }

      // Users can only update their own profile unless they're admin
      if (request.data.userId !== user.uid && user.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Access denied');
      }

      const updatedUser = await usersService.updateUser(request.data.userId, validatedData);

      return {
        success: true,
        data: updatedUser
      };
    } catch (error) {
      console.error('Error in updateUser:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError('internal', 'Failed to update user');
    }
  }
);

// Get users statistics (admin only)
export const getUsersStats = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);

      // Apply rate limiting for stats operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.stats.maxRequests, RateLimitPresets.stats.windowMs, 'getUsersStats');

      // Only admins can access user statistics
      if (user.role !== 'admin') {
        throw new HttpsError('permission-denied', 'Admin access required');
      }

      const stats = await usersService.getUsersStats();

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Error in getUsersStats:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to get users statistics');
    }
  }
); 