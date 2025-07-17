import { useState, useEffect, useCallback } from 'react';
import type { Opportunity, OpportunityStage, OpportunityPriority } from '../types/Opportunity';
import { useApi } from './useApi';

export interface OpportunityFilters {
  accountId?: string;
  productId?: string;
  stage?: OpportunityStage;
  priority?: OpportunityPriority;
  search?: string;
  contactId?: string;
  minValue?: number;
  maxValue?: number;
  closeDateStart?: Date;
  closeDateEnd?: Date;
}

export interface OpportunitiesQueryOptions {
  filters?: OpportunityFilters;
  sortBy?: 'title' | 'stage' | 'priority' | 'estimatedDealValue' | 'expectedCloseDate' | 'lastActivityDate' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface OpportunitiesResponse {
  opportunities: Opportunity[];
  total: number;
  hasMore: boolean;
}

export interface OpportunityStats {
  total: number;
  byStage: Record<OpportunityStage, number>;
  byPriority: Record<OpportunityPriority, number>;
  totalValue: number;
  wonValue: number;
  pipelineValue: number;
  averageDealSize: number;
  conversionRate: number;
  closingThisMonth: number;
}

export const useOpportunitiesApi = () => {
  const { callFunction, loading, error } = useApi();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stats, setStats] = useState<OpportunityStats | null>(null);

  // Get opportunities with filtering and pagination
  const getOpportunities = useCallback(async (options: OpportunitiesQueryOptions = {}) => {
    try {
      const response = await callFunction('getOpportunities', options);
      return response.data as OpportunitiesResponse;
    } catch (err) {
      console.error('Error getting opportunities:', err);
      throw err;
    }
  }, [callFunction]);

  // Get single opportunity
  const getOpportunity = useCallback(async (opportunityId: string): Promise<Opportunity> => {
    try {
      const response = await callFunction('getOpportunity', { opportunityId });
      return response.data as Opportunity;
    } catch (err) {
      console.error('Error getting opportunity:', err);
      throw err;
    }
  }, [callFunction]);

  // Create new opportunity
  const createOpportunity = useCallback(async (opportunityData: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Opportunity> => {
    try {
      const response = await callFunction('createOpportunity', opportunityData);
      const newOpportunity = response.data as Opportunity;
      
      // Update local state
      setOpportunities(prev => [newOpportunity, ...prev]);
      
      return newOpportunity;
    } catch (err) {
      console.error('Error creating opportunity:', err);
      throw err;
    }
  }, [callFunction]);

  // Update opportunity
  const updateOpportunity = useCallback(async (opportunityId: string, updates: Partial<Opportunity>): Promise<Opportunity> => {
    try {
      const response = await callFunction('updateOpportunity', {
        opportunityId,
        updates
      });
      const updatedOpportunity = response.data as Opportunity;
      
      // Update local state
      setOpportunities(prev => prev.map(opportunity => 
        opportunity.id === opportunityId ? updatedOpportunity : opportunity
      ));
      
      return updatedOpportunity;
    } catch (err) {
      console.error('Error updating opportunity:', err);
      throw err;
    }
  }, [callFunction]);

  // Delete opportunity
  const deleteOpportunity = useCallback(async (opportunityId: string): Promise<void> => {
    try {
      await callFunction('deleteOpportunity', { opportunityId });
      
      // Update local state
      setOpportunities(prev => prev.filter(opportunity => opportunity.id !== opportunityId));
    } catch (err) {
      console.error('Error deleting opportunity:', err);
      throw err;
    }
  }, [callFunction]);

  // Get opportunities statistics
  const getOpportunitiesStats = useCallback(async (filters: OpportunityFilters = {}): Promise<OpportunityStats> => {
    try {
      const response = await callFunction('getOpportunitiesStats', filters);
      const statsData = response.data as OpportunityStats;
      setStats(statsData);
      return statsData;
    } catch (err) {
      console.error('Error getting opportunities stats:', err);
      throw err;
    }
  }, [callFunction]);

  // Bulk update opportunities
  const bulkUpdateOpportunities = useCallback(async (
    updates: Array<{ id: string; data: Partial<Opportunity> }>
  ): Promise<Opportunity[]> => {
    try {
      const response = await callFunction('bulkUpdateOpportunities', { updates });
      const updatedOpportunities = response.data as Opportunity[];
      
      // Update local state
      setOpportunities(prev => prev.map(opportunity => {
        const update = updatedOpportunities.find(updated => updated.id === opportunity.id);
        return update || opportunity;
      }));
      
      return updatedOpportunities;
    } catch (err) {
      console.error('Error bulk updating opportunities:', err);
      throw err;
    }
  }, [callFunction]);

  // Generate AI summary manually
  const generateAISummaryManual = useCallback(async (opportunityId: string): Promise<{ summary: string; generatedAt: string }> => {
    try {
      const response = await callFunction('generateOpportunitySummaryManual', { opportunityId });
      return {
        summary: response.data.summary,
        generatedAt: response.data.generatedAt
      };
    } catch (err) {
      console.error('Error generating AI summary:', err);
      throw err;
    }
  }, [callFunction]);

  // Load initial opportunities
  const loadOpportunities = useCallback(async (options: OpportunitiesQueryOptions = {}) => {
    try {
      const result = await getOpportunities(options);
      setOpportunities(result.opportunities);
      return result;
    } catch (err) {
      console.error('Error loading opportunities:', err);
      throw err;
    }
  }, [getOpportunities]);

  // Refresh opportunities
  const refreshOpportunities = useCallback(async () => {
    await loadOpportunities();
  }, [loadOpportunities]);

  // Note: Auto-loading removed for performance. Use DataContext for cached data or call loadOpportunities() manually.
  // Auto-loading was causing duplicate API calls when multiple components used this hook.

  return {
    // Data
    opportunities,
    stats,
    
    // Loading states
    loading,
    error,
    
    // API methods
    getOpportunities,
    getOpportunity,
    createOpportunity,
    updateOpportunity,
    deleteOpportunity,
    getOpportunitiesStats,
    bulkUpdateOpportunities,
    generateAISummaryManual,
    
    // Utility methods
    loadOpportunities,
    refreshOpportunities,
    
    // State setters (for direct manipulation if needed)
    setOpportunities,
    setStats
  };
}; 