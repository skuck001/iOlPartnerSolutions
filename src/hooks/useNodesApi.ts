import { useState, useCallback } from 'react';
import { useApi } from './useApi';

// Types for CSV processing
export interface CSVProcessingResult {
  batch_id: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  staging_nodes: any[];
  validation_errors: any[];
  duplicate_warnings: number;
}

export interface BatchLog {
  batch_id: string;
  batch_name?: string;
  created_by: string;
  status: 'pending' | 'processed' | 'error' | 'cancelled' | 'rolled_back';
  total_records: number;
  processed_records: number;
  error_records: number;
  error_report?: any;
  createdAt: any;
  completedAt?: any;
  ownerId: string;
  source_type?: string;
}

export const useNodesApi = () => {
  const { callFunction, loading, error, clearError } = useApi();

  // CSV Processing
  const processBatchCSV = useCallback(async (csvContent: string, batchName: string): Promise<CSVProcessingResult> => {
    return await callFunction('processBatchCSV', {
      csv_content: csvContent,
      batch_name: batchName
    });
  }, [callFunction]);

  // Batch Management
  const getBatchLogs = useCallback(async (): Promise<BatchLog[]> => {
    const result = await callFunction('getBatchLogs');
    return Array.isArray(result) ? result : [];
  }, [callFunction]);

  const getEntities = useCallback(async () => {
    const result = await callFunction('getEntities');
    return Array.isArray(result) ? result : [];
  }, [callFunction]);

  const getNodes = useCallback(async () => {
    const result = await callFunction('getNodes');
    return Array.isArray(result) ? result : [];
  }, [callFunction]);

  return {
    processBatchCSV,
    getBatchLogs,
    getEntities,
    getNodes,
    loading,
    error,
    clearError
  };
};
