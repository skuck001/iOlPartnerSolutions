import { useState, useCallback, useEffect } from 'react';
import { useApi } from './useApi';
import type { User } from '../types';

// Types for API calls
export interface UserFilters {
  role?: string;
  department?: string;
  location?: string;
  search?: string;
}

export interface UsersQueryOptions {
  filters?: UserFilters;
  sortBy?: 'displayName' | 'email' | 'lastLoginAt' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface UsersResponse {
  users: User[];
  total: number;
  hasMore: boolean;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  roleDistribution: Record<string, number>;
  departmentDistribution: Record<string, number>;
}

// Cache for users to avoid repeated fetches - similar to the old userUtils pattern
let usersCache: User[] = [];
let lastFetch: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useUsersApi = () => {
  const { callFunction, loading, error } = useApi();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);

  // Get users with filtering and pagination
  const getUsers = useCallback(async (options: UsersQueryOptions = {}) => {
    try {
      const response = await callFunction('getUsers', options);
      return response.data as UsersResponse;
    } catch (err) {
      console.error('Error getting users:', err);
      throw err;
    }
  }, [callFunction]);

  // Get all users (cached) - replacement for getAllUsers
  const getAllUsers = useCallback(async (): Promise<User[]> => {
    // Return cached users if still fresh
    if (usersCache.length > 0 && Date.now() - lastFetch < CACHE_DURATION) {
      console.log('Returning cached users:', usersCache.length);
      return usersCache;
    }

    try {
      console.log('Fetching users from Cloud Functions...');
      const response = await getUsers({ limit: 100 }); // Get all users
      
      console.log(`Fetched ${response.users.length} users from Cloud Functions`);

      // Update cache
      usersCache = response.users;
      lastFetch = Date.now();
      
      return response.users;
    } catch (error) {
      console.error('Error fetching users:', error);
      return [];
    }
  }, [getUsers]);

  // Get single user
  const getUser = useCallback(async (userId: string): Promise<User | null> => {
    try {
      const response = await callFunction('getUser', { userId });
      return response.data as User;
    } catch (err) {
      console.error('Error getting user:', err);
      throw err;
    }
  }, [callFunction]);

  // Get user by ID (cached) - replacement for getUserById
  const getUserById = useCallback(async (userId: string): Promise<User | null> => {
    // Check cache first
    const cachedUser = usersCache.find(user => user.id === userId);
    if (cachedUser) {
      return cachedUser;
    }

    try {
      return await getUser(userId);
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }, [getUser]);

  // Update user
  const updateUser = useCallback(async (userId: string, userData: Partial<User>): Promise<User> => {
    try {
      const response = await callFunction('updateUser', {
        userId,
        ...userData
      });
      const updatedUser = response.data as User;
      
      // Update local cache
      const userIndex = usersCache.findIndex(u => u.id === userId);
      if (userIndex !== -1) {
        usersCache[userIndex] = updatedUser;
      }
      
      // Update local state if we have it
      setUsers(prev => prev.map(user => 
        user.id === userId ? updatedUser : user
      ));
      
      return updatedUser;
    } catch (err) {
      console.error('Error updating user:', err);
      throw err;
    }
  }, [callFunction]);

  // Get user statistics (admin only)
  const getUsersStats = useCallback(async (): Promise<UserStats> => {
    try {
      const response = await callFunction('getUsersStats');
      return response.data as UserStats;
    } catch (err) {
      console.error('Error getting user stats:', err);
      throw err;
    }
  }, [callFunction]);

  // Load initial users
  const loadUsers = useCallback(async (options: UsersQueryOptions = {}) => {
    try {
      const result = await getUsers(options);
      setUsers(result.users);
      return result;
    } catch (err) {
      console.error('Error loading users:', err);
      throw err;
    }
  }, [getUsers]);

  // Clear cache - utility function
  const clearUsersCache = useCallback(() => {
    usersCache = [];
    lastFetch = 0;
    console.log('Users cache cleared');
  }, []);

  // Utility functions that match the old userUtils API
  const getUserDisplayName = useCallback((user: User): string => {
    if (user.displayName && user.displayName.trim()) {
      return user.displayName;
    }
    
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`.trim();
    }
    
    if (user.firstName) {
      return user.firstName;
    }
    
    if (user.lastName) {
      return user.lastName;
    }
    
    if (user.email) {
      return user.email.split('@')[0];
    }
    
    return 'Unknown User';
  }, []);

  const getUserDisplayNameById = useCallback(async (userId: string): Promise<string> => {
    try {
      const user = await getUserById(userId);
      return user ? getUserDisplayName(user) : 'Unknown User';
    } catch (error) {
      console.error('Error getting user display name:', error);
      return 'Unknown User';
    }
  }, [getUserById, getUserDisplayName]);

  const getUserInitials = useCallback((user: User): string => {
    const displayName = getUserDisplayName(user);
    
    if (user.firstName && user.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    
    const nameParts = displayName.split(' ');
    if (nameParts.length >= 2) {
      return `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`.toUpperCase();
    }
    
    return displayName.charAt(0).toUpperCase();
  }, [getUserDisplayName]);

  return {
    // Data
    users,
    stats,
    
    // Loading states
    loading,
    error,
    
    // API methods
    getUsers,
    getAllUsers,
    getUser,
    getUserById,
    updateUser,
    getUsersStats,
    
    // Utility methods
    loadUsers,
    clearUsersCache,
    getUserDisplayName,
    getUserDisplayNameById,
    getUserInitials,
    
    // State setters (for direct manipulation if needed)
    setUsers,
    setStats
  };
}; 