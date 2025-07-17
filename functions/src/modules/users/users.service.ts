import { getFirestore, Query } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';

// const db = getFirestore(); // Initialized in calling functions

export interface User {
  id: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  location?: string;
  bio?: string;
  avatar?: string;
  role: string;
  permissions: string[];
  timezone?: string;
  notifications?: {
    email: boolean;
    push: boolean;
    weekly: boolean;
  };
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  updatedAt?: Timestamp;
}

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

export class UsersService {
  constructor(private db = getFirestore()) {}

  async getUsers(options: UsersQueryOptions = {}): Promise<UsersResponse> {
    const {
      filters = {},
      sortBy = 'lastLoginAt',
      sortOrder = 'desc',
      limit = 50,
      offset = 0
    } = options;

    let query: Query = this.db.collection('users');

    // Apply filters
    if (filters.role) {
      query = query.where('role', '==', filters.role);
    }

    if (filters.department) {
      query = query.where('department', '==', filters.department);
    }

    if (filters.location) {
      query = query.where('location', '==', filters.location);
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
    const users = snapshot.docs.slice(0, limit).map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as User[];

    // Apply client-side search filter if needed
    let filteredUsers = users;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredUsers = users.filter(user =>
        user.displayName?.toLowerCase().includes(searchLower) ||
        user.firstName?.toLowerCase().includes(searchLower) ||
        user.lastName?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.jobTitle?.toLowerCase().includes(searchLower) ||
        user.department?.toLowerCase().includes(searchLower)
      );
    }

    // Get total count for pagination
    const totalQuery = this.buildFilterQuery(filters);
    const totalSnapshot = await totalQuery.count().get();
    const total = totalSnapshot.data().count;

    return {
      users: filteredUsers,
      total,
      hasMore: snapshot.docs.length > limit
    };
  }

  async getUser(userId: string): Promise<User | null> {
    const doc = await this.db.collection('users').doc(userId).get();
    
    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data()
    } as User;
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<User> {
    const userRef = this.db.collection('users').doc(userId);
    
    // Remove fields that shouldn't be updated via this method
    const { id, createdAt, ...updateData } = userData;
    
    const updatedData = {
      ...updateData,
      updatedAt: Timestamp.now()
    };

    await userRef.update(updatedData);

    const updatedDoc = await userRef.get();
    return {
      id: updatedDoc.id,
      ...updatedDoc.data()
    } as User;
  }

  async getUsersStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    roleDistribution: Record<string, number>;
    departmentDistribution: Record<string, number>;
  }> {
    const usersSnapshot = await this.db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => doc.data() as User);

    const totalUsers = users.length;
    
    // Users active in the last 30 days
    const thirtyDaysAgo = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const activeUsers = users.filter(user => 
      user.lastLoginAt && user.lastLoginAt.toDate() > thirtyDaysAgo.toDate()
    ).length;

    // Role distribution
    const roleDistribution: Record<string, number> = {};
    users.forEach(user => {
      const role = user.role || 'unknown';
      roleDistribution[role] = (roleDistribution[role] || 0) + 1;
    });

    // Department distribution
    const departmentDistribution: Record<string, number> = {};
    users.forEach(user => {
      const department = user.department || 'unassigned';
      departmentDistribution[department] = (departmentDistribution[department] || 0) + 1;
    });

    return {
      totalUsers,
      activeUsers,
      roleDistribution,
      departmentDistribution
    };
  }

  private buildFilterQuery(filters: UserFilters): Query {
    let query: Query = this.db.collection('users');

    if (filters.role) {
      query = query.where('role', '==', filters.role);
    }

    if (filters.department) {
      query = query.where('department', '==', filters.department);
    }

    if (filters.location) {
      query = query.where('location', '==', filters.location);
    }

    return query;
  }
} 