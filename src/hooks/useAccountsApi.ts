import { useState, useCallback } from 'react';
import { useApi } from './useApi';
import type { Account } from '../types';

export interface AccountQueryParams {
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

export interface AccountStats {
  total: number;
  byStatus: Record<string, number>;
  byRegion: Record<string, number>;
  recent: Account[];
}

export const useAccountsApi = () => {
  const { callFunction, loading, error, clearError } = useApi();
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Get accounts with filtering and pagination
  const fetchAccounts = useCallback(async (params?: AccountQueryParams): Promise<AccountsResponse> => {
    const result = await callFunction<AccountsResponse>('getAccounts', params);
    setAccounts(result.accounts);
    return result;
  }, [callFunction]);

  // Get a single account
  const getAccount = useCallback(async (accountId: string): Promise<Account> => {
    return await callFunction<Account>('getAccount', { accountId });
  }, [callFunction]);

  // Create a new account
  const createAccount = useCallback(async (accountData: {
    name: string;
    description?: string;
    website?: string;
    region: string;
    industry?: string;
    size?: 'Small' | 'Medium' | 'Large' | 'Enterprise';
    status?: 'Active' | 'Inactive' | 'Prospect';
    tags?: string[];
  }): Promise<Account> => {
    const newAccount = await callFunction<Account>('createAccount', accountData);
    setAccounts(prev => [newAccount, ...prev]);
    return newAccount;
  }, [callFunction]);

  // Update an existing account
  const updateAccount = useCallback(async (
    accountId: string, 
    updateData: Partial<Account>
  ): Promise<Account> => {
    const updatedAccount = await callFunction<Account>('updateAccount', {
      accountId,
      ...updateData
    });
    
    setAccounts(prev => 
      prev.map(account => 
        account.id === accountId ? updatedAccount : account
      )
    );
    
    return updatedAccount;
  }, [callFunction]);

  // Delete an account
  const deleteAccount = useCallback(async (accountId: string): Promise<void> => {
    await callFunction('deleteAccount', { accountId });
    setAccounts(prev => prev.filter(account => account.id !== accountId));
  }, [callFunction]);

  // Get accounts statistics
  const getAccountsStats = useCallback(async (): Promise<AccountStats> => {
    return await callFunction<AccountStats>('getAccountsStats');
  }, [callFunction]);

  // Bulk update accounts
  const bulkUpdateAccounts = useCallback(async (
    accountIds: string[], 
    updateData: Partial<Account>
  ): Promise<{ updated: number; errors: string[] }> => {
    const result = await callFunction<{ updated: number; errors: string[] }>(
      'bulkUpdateAccounts', 
      { accountIds, updateData }
    );
    
    // Refresh accounts list after bulk update
    if (result.updated > 0) {
      await fetchAccounts();
    }
    
    return result;
  }, [callFunction, fetchAccounts]);

  // Advanced search with filters
  const searchAccounts = useCallback(async (params: AccountQueryParams): Promise<AccountsResponse> => {
    return await fetchAccounts(params);
  }, [fetchAccounts]);

  // Load more accounts (pagination)
  const loadMoreAccounts = useCallback(async (params?: AccountQueryParams): Promise<void> => {
    const result = await callFunction<AccountsResponse>('getAccounts', params);
    setAccounts(prev => [...prev, ...result.accounts]);
  }, [callFunction]);

  // Refresh accounts list
  const refreshAccounts = useCallback(async (params?: AccountQueryParams): Promise<void> => {
    await fetchAccounts(params);
  }, [fetchAccounts]);

  return {
    // State
    accounts,
    loading,
    error,
    
    // Actions
    fetchAccounts,
    getAccount,
    createAccount,
    updateAccount,
    deleteAccount,
    getAccountsStats,
    bulkUpdateAccounts,
    searchAccounts,
    loadMoreAccounts,
    refreshAccounts,
    
    // Utilities
    clearError
  };
}; 