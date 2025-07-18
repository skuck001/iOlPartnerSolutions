import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { validateData, ValidationError } from '../../shared/validation.middleware';
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
      if (error instanceof ValidationError) {
        console.error('Validation errors:', error.errors);
        throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
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

      console.log(`🔍 getUser called with userId: ${request.data.userId}`);

      // Removed ownership check - allow access to all user profiles

      let userData = await usersService.getUser(request.data.userId);
      console.log(`📋 getUser result for ${request.data.userId}:`, userData ? 'Found in Firestore' : 'NOT FOUND in Firestore');
      
            if (!userData) {
        // User document doesn't exist in Firestore, but user ID might be valid Firebase Auth UID
        // Try to get user from Firebase Auth and auto-create user document
        try {
          const { getAuth } = await import('firebase-admin/auth');
          const authUser = await getAuth().getUser(request.data.userId);
          
          // Create user document with basic information from Firebase Auth
          const { Timestamp } = await import('firebase-admin/firestore');
          const newUserData = {
            id: authUser.uid,
            email: authUser.email || '',
            displayName: authUser.displayName || '',
            firstName: '',
            lastName: '',
            phone: authUser.phoneNumber || '',
            jobTitle: '',
            department: '',
            location: '',
            bio: '',
            avatar: '',
            role: 'user',
            permissions: [],
            timezone: '',
            notifications: {
              email: true,
              push: true,
              weekly: true,
            },
            createdAt: Timestamp.now(),
            lastLoginAt: authUser.metadata.lastSignInTime ? Timestamp.fromDate(new Date(authUser.metadata.lastSignInTime)) : Timestamp.now(),
            updatedAt: Timestamp.now()
          };
          
          // Create the user document
          await usersService.createUser(authUser.uid, newUserData);
          userData = newUserData;
          
          console.log(`✅ Auto-created user document for existing Firebase Auth user: ${authUser.email}`);
        } catch (authError) {
          // User doesn't exist in Firebase Auth either - return fallback user
          console.log(`❌ User ${request.data.userId} not found in Firebase Auth. Returning fallback user.`);
          const { Timestamp } = await import('firebase-admin/firestore');
          userData = {
            id: request.data.userId,
            email: 'unknown@example.com',
            displayName: 'Unknown User',
            firstName: 'Unknown',
            lastName: 'User',
            phone: '',
            jobTitle: '',
            department: '',
            location: '',
            bio: '',
            avatar: '',
            role: 'user',
            permissions: [],
            timezone: '',
            notifications: {
              email: true,
              push: true,
              weekly: true,
            },
            createdAt: Timestamp.now(),
            lastLoginAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          };
        }
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
      if (error instanceof ValidationError) {
        console.error('Validation errors:', error.errors);
        throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
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

      // Removed ownership check - allow updates to all user profiles

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
      if (error instanceof ValidationError) {
        console.error('Validation errors:', error.errors);
        throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
      }
      if (error instanceof Error) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError('internal', 'Failed to update user');
    }
  }
);

// Test function to debug specific user lookup
export const testGetUser = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      await authenticateUser(request.auth); // Just verify authentication
      
      const testUserId = 'Upznbx6fFNbCTujUmGwbQM1YNAp1'; // James Burdett
      console.log(`Testing getUser for specific user: ${testUserId}`);
      
      const userData = await usersService.getUser(testUserId);
      
      return {
        success: true,
        testUserId,
        found: !!userData,
        data: userData
      };
    } catch (error: any) {
      console.error('Error in testGetUser:', error);
      return {
        success: false,
        error: error?.message || 'Unknown error'
      };
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
      if (error instanceof ValidationError) {
        console.error('Validation errors:', error.errors);
        throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
      }
      throw new HttpsError('internal', 'Failed to get users statistics');
    }
  }
); 