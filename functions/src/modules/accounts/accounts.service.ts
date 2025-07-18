import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { AuditService } from '../../shared/audit.service';
import { ConflictError, validateResourceExists, retryOperation } from '../../shared/errors';

const db = getFirestore();

export interface Account {
  id: string;
  name: string;
  region: string; // Headoffice Country
  website?: string;
  parentAccountId?: string;
  headquarters?: string;
  description?: string;
  logo?: string;
  primaryContact?: string;
  tags: string[];
  notes?: string;
  ownerId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AccountQueryParams {
  userId: string;
  limit?: number;
  lastDoc?: string;
  searchTerm?: string;
  region?: string;
  status?: 'Active' | 'Inactive' | 'Prospect';
  industry?: string;
}

export interface AccountsResponse {
  accounts: Account[];
  hasMore: boolean;
  lastDoc?: string;
  total?: number;
}

export class AccountsService {
  /**
   * Get accounts with filtering, pagination, and search
   */
  static async getAccounts(params: AccountQueryParams): Promise<AccountsResponse> {
    try {
      let query = db.collection('accounts')
        .orderBy('updatedAt', 'desc');
      // Removed ownerId filter - allow access to all accounts

      // Apply filters
      if (params.region) {
        query = query.where('region', '==', params.region);
      }

      if (params.status) {
        query = query.where('status', '==', params.status);
      }

      if (params.industry) {
        query = query.where('industry', '==', params.industry);
      }

      // Set limit
      const limit = params.limit || 50;
      query = query.limit(limit + 1); // Fetch one extra to check if there are more

      // Handle pagination
      if (params.lastDoc) {
        const lastDocSnap = await db.collection('accounts').doc(params.lastDoc).get();
        if (lastDocSnap.exists) {
          query = query.startAfter(lastDocSnap);
        }
      }

      const snapshot = await query.get();
      let accounts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Account));

      // Check if there are more results
      const hasMore = accounts.length > limit;
      if (hasMore) {
        accounts = accounts.slice(0, limit); // Remove the extra document
      }

      // Apply client-side search filtering if provided
      // Note: In production, consider using full-text search solutions like Algolia
      if (params.searchTerm) {
        const searchLower = params.searchTerm.toLowerCase();
        accounts = accounts.filter(account => 
          account.name?.toLowerCase().includes(searchLower) ||
          account.description?.toLowerCase().includes(searchLower) ||
          account.tags?.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }

      // Log the view action
      await AuditService.logAccountAction('VIEW', params.userId, 'bulk', {
        filters: {
          region: params.region,
          status: params.status,
          industry: params.industry,
          searchTerm: params.searchTerm
        },
        resultCount: accounts.length
      });

      return {
        accounts,
        hasMore,
        lastDoc: accounts.length > 0 ? accounts[accounts.length - 1].id : undefined
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a single account by ID
   */
  static async getAccount(accountId: string, userId: string): Promise<Account> {
    await validateResourceExists('accounts', accountId, 'Account');
    
    const doc = await db.collection('accounts').doc(accountId).get();
    const account = { id: doc.id, ...doc.data() } as Account;

    // Removed ownership check - allow access to all accounts

    // Log the view action
    await AuditService.logAccountAction('VIEW', userId, accountId, { name: account.name });

    return account;
  }

  /**
   * Create a new account
   */
  static async createAccount(
    data: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>, 
    userEmail?: string
  ): Promise<Account> {
    try {
      // Check for duplicate account names within the same user's accounts
      const existingQuery = await db.collection('accounts')
        .where('ownerId', '==', data.ownerId)
        .where('name', '==', data.name)
        .get();

      if (!existingQuery.empty) {
        throw new ConflictError(`Account with name "${data.name}" already exists`);
      }

      const now = Timestamp.now();
      const accountData = {
        ...data,
        createdAt: now,
        updatedAt: now
      };

      // Use retry operation for reliability
      const docRef = await retryOperation(async () => {
        return await db.collection('accounts').add(accountData);
      });

      const newAccount = { id: docRef.id, ...accountData };

      // Log the creation
      await AuditService.logAccountAction(
        'CREATE', 
        data.createdBy, 
        docRef.id, 
        { name: data.name, region: data.region },
        userEmail
      );

      return newAccount;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an existing account
   */
  static async updateAccount(
    accountId: string, 
    data: Partial<Account>, 
    userId: string, 
    userEmail?: string
  ): Promise<Account> {
    try {
      await validateResourceExists('accounts', accountId, 'Account');

      // Get current account - removed ownership check
      const currentDoc = await db.collection('accounts').doc(accountId).get();
      const currentAccount = currentDoc.data() as Account;

      // Removed ownership check - allow updates to all accounts

      // Check for name conflicts if name is being updated
      if (data.name && data.name !== currentAccount.name) {
        const existingQuery = await db.collection('accounts')
          .where('name', '==', data.name)
          .get();
        // Removed ownerId filter from conflict check - check all accounts

        const conflictingDocs = existingQuery.docs.filter(doc => doc.id !== accountId);
        if (conflictingDocs.length > 0) {
          throw new ConflictError(`Account with name "${data.name}" already exists`);
        }
      }

      const updateData = {
        ...data,
        updatedBy: userId,
        updatedAt: Timestamp.now()
      };

      // Remove fields that shouldn't be updated
      delete (updateData as any).id;
      delete (updateData as any).createdAt;
      delete (updateData as any).createdBy;
      delete (updateData as any).ownerId;

      await retryOperation(async () => {
        await db.collection('accounts').doc(accountId).update(updateData);
      });

      const updatedAccount = { ...currentAccount, ...updateData, id: accountId };

      // Log the update
      await AuditService.logAccountAction(
        'UPDATE', 
        userId, 
        accountId, 
        { changes: data, previousName: currentAccount.name },
        userEmail
      );

      return updatedAccount;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete an account and handle related data cleanup
   */
  static async deleteAccount(accountId: string, userId: string, userEmail?: string): Promise<void> {
    try {
      await validateResourceExists('accounts', accountId, 'Account');

      // Get current account - removed ownership check
      const currentDoc = await db.collection('accounts').doc(accountId).get();
      const currentAccount = currentDoc.data() as Account;

      // Removed ownership check - allow deletion of all accounts

      // Check for related data that would prevent deletion
      const [contactsSnap, opportunitiesSnap] = await Promise.all([
        db.collection('contacts').where('accountId', '==', accountId).limit(1).get(),
        db.collection('opportunities').where('accountId', '==', accountId).limit(1).get()
      ]);

      if (!contactsSnap.empty || !opportunitiesSnap.empty) {
        throw new ConflictError(
          'Cannot delete account with associated contacts or opportunities', 
          { 
            hasContacts: !contactsSnap.empty, 
            hasOpportunities: !opportunitiesSnap.empty 
          }
        );
      }

      await retryOperation(async () => {
        await db.collection('accounts').doc(accountId).delete();
      });

      // Log the deletion
      await AuditService.logAccountAction(
        'DELETE', 
        userId, 
        accountId, 
        { name: currentAccount.name },
        userEmail
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get accounts summary/statistics for dashboard
   */
  static async getAccountsStats(userId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byRegion: Record<string, number>;
    recent: Account[];
  }> {
    try {
      const accountsQuery = db.collection('accounts');
      // Removed ownerId filter - calculate stats for all accounts

      const snapshot = await accountsQuery.get();
      const accounts = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Account));

      // Calculate statistics
      const byStatus = accounts.reduce((acc, account) => {
        // Status field removed - keeping all accounts as active for stats
        return acc;
      }, {} as Record<string, number>);

      const byRegion = accounts.reduce((acc, account) => {
        acc[account.region] = (acc[account.region] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get 5 most recent accounts
      const recent = accounts
        .sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis())
        .slice(0, 5);

      return {
        total: accounts.length,
        byStatus,
        byRegion,
        recent
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk operations for accounts
   */
  static async bulkUpdateAccounts(
    accountIds: string[], 
    updateData: Partial<Account>, 
    userId: string, 
    userEmail?: string
  ): Promise<{ updated: number; errors: string[] }> {
    const batch = db.batch();
    const errors: string[] = [];
    let updated = 0;

    try {
      // Validate all accounts exist - removed ownership validation
      const accountPromises = accountIds.map(id => 
        db.collection('accounts').doc(id).get()
      );
      
      const accountDocs = await Promise.all(accountPromises);

      for (let i = 0; i < accountDocs.length; i++) {
        const doc = accountDocs[i];
        const accountId = accountIds[i];

        if (!doc.exists) {
          errors.push(`Account ${accountId} not found`);
          continue;
        }

        // Removed ownership check - allow bulk updates to all accounts

        batch.update(doc.ref, {
          ...updateData,
          updatedBy: userId,
          updatedAt: Timestamp.now()
        });
        updated++;
      }

      if (updated > 0) {
        await batch.commit();

        // Log bulk update
        await AuditService.logAccountAction(
          'UPDATE', 
          userId, 
          'bulk', 
          { accountIds, updateData, updated, errors },
          userEmail
        );
      }

      return { updated, errors };
    } catch (error) {
      throw error;
    }
  }
} 