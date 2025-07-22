import { useState, useCallback } from 'react';
import { useApi } from './useApi';
import type { 
  Node, 
  Entity, 
  CreateNodeRequest, 
  UpdateNodeRequest,
  CreateEntityRequest,
  UpdateEntityRequest,
  NodeSearchFilters,
  BatchUploadRequest,
  StagingNodeReview
} from '../types';

// Add new types for CSV processing
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
  created_by: string;
  status: 'pending' | 'processed' | 'error' | 'cancelled' | 'rolled_back';
  total_records: number;
  processed_records: number;
  error_records: number;
  error_report?: any;
  createdAt: any;
  completedAt?: any;
  ownerId: string;
}

export interface DeduplicationResult {
  staging_id: string;
  has_duplicates: boolean;
  duplicate_count: number;
  matches: any[];
  overall_confidence: number;
  suggested_entity_id?: string;
  suggested_merge_action?: 'create_new' | 'merge_existing' | 'manual_review';
}

export const useNodesApi = () => {
  const { callFunction, loading, error, clearError } = useApi();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);

  // Entity API methods
  const createEntity = useCallback(async (data: CreateEntityRequest): Promise<Entity> => {
    const result = await callFunction('createEntity', data);
    return result;
  }, [callFunction]);

  const getEntities = useCallback(async (): Promise<Entity[]> => {
    const result = await callFunction('getEntities');
    setEntities(result || []);
    return result || [];
  }, [callFunction]);

  const getEntity = useCallback(async (entityId: string): Promise<Entity> => {
    const result = await callFunction('getEntity', { entityId });
    return result;
  }, [callFunction]);

  const updateEntity = useCallback(async (data: UpdateEntityRequest): Promise<Entity> => {
    const result = await callFunction('updateEntity', data);
    return result;
  }, [callFunction]);

  const deleteEntity = useCallback(async (entityId: string): Promise<void> => {
    await callFunction('deleteEntity', { entityId });
  }, [callFunction]);

  // Node API methods
  const createNode = useCallback(async (data: CreateNodeRequest): Promise<Node> => {
    const result = await callFunction('createNode', data);
    return result;
  }, [callFunction]);

  const getNodes = useCallback(async (): Promise<Node[]> => {
    const result = await callFunction('getNodes');
    setNodes(result || []);
    return result || [];
  }, [callFunction]);

  const getNode = useCallback(async (nodeId: string): Promise<Node> => {
    const result = await callFunction('getNode', { nodeId });
    return result;
  }, [callFunction]);

  const updateNode = useCallback(async (data: UpdateNodeRequest): Promise<Node> => {
    const result = await callFunction('updateNode', data);
    return result;
  }, [callFunction]);

  const deleteNode = useCallback(async (nodeId: string): Promise<void> => {
    await callFunction('deleteNode', { nodeId });
  }, [callFunction]);

  // Search and filter methods
  const searchNodes = useCallback(async (filters: NodeSearchFilters): Promise<Node[]> => {
    const result = await callFunction('searchNodes', filters);
    return result || [];
  }, [callFunction]);

  // Batch processing methods (for future CSV upload functionality)
  const createBatch = useCallback(async (batchName?: string): Promise<{ batch_id: string }> => {
    const result = await callFunction('createBatch', { batch_name: batchName });
    return result;
  }, [callFunction]);

  // CSV Processing and Batch Management methods
  const processBatchCSV = useCallback(async (
    csvContent: string, 
    batchName?: string
  ): Promise<CSVProcessingResult> => {
    const result = await callFunction('processBatchCSV', { 
      csvContent, 
      batchName 
    });
    return result;
  }, [callFunction]);

  const getStagingNodes = useCallback(async (batchId: string): Promise<any[]> => {
    const result = await callFunction('getStagingNodes', { batchId });
    return result || [];
  }, [callFunction]);

  const analyzeDeduplication = useCallback(async (
    batchId: string, 
    config?: any
  ): Promise<DeduplicationResult[]> => {
    const result = await callFunction('analyzeDeduplication', { 
      batchId, 
      config 
    });
    return result || [];
  }, [callFunction]);

  const processDeduplicationDecisions = useCallback(async (
    decisions: Array<{
      staging_id: string;
      action: 'approve_new' | 'merge_with_entity' | 'merge_with_node' | 'reject';
      target_id?: string;
      manual_edits?: any;
    }>
  ): Promise<{ processed: number; errors: any[] }> => {
    const result = await callFunction('processDeduplicationDecisions', { 
      decisions 
    });
    return result;
  }, [callFunction]);

  const getBatchLogs = useCallback(async (): Promise<BatchLog[]> => {
    const result = await callFunction('getBatchLogs');
    return result || [];
  }, [callFunction]);

  const updateBatchStatus = useCallback(async (
    batchId: string, 
    status: string, 
    updates?: any
  ): Promise<void> => {
    await callFunction('updateBatchStatus', { 
      batchId, 
      status, 
      updates 
    });
  }, [callFunction]);

  const rollbackBatch = useCallback(async (
    batchId: string
  ): Promise<{ success: boolean; nodes_deleted: number; staging_nodes_deleted: number }> => {
    const result = await callFunction('rollbackBatch', { batchId });
    return result;
  }, [callFunction]);

  // Enhanced helper methods for batch management
  const getBatchById = useCallback(async (batchId: string): Promise<BatchLog | null> => {
    const batches = await getBatchLogs();
    return batches.find(batch => batch.batch_id === batchId) || null;
  }, [getBatchLogs]);

  const getPendingBatches = useCallback(async (): Promise<BatchLog[]> => {
    const batches = await getBatchLogs();
    return batches.filter(batch => batch.status === 'pending' || batch.status === 'processed');
  }, [getBatchLogs]);

  const getErrorBatches = useCallback(async (): Promise<BatchLog[]> => {
    const batches = await getBatchLogs();
    return batches.filter(batch => batch.status === 'error');
  }, [getBatchLogs]);

  // Helper methods for frontend operations
  const refreshNodes = useCallback(async () => {
    await getNodes();
  }, [getNodes]);

  const refreshEntities = useCallback(async () => {
    await getEntities();
  }, [getEntities]);

  const refreshAll = useCallback(async () => {
    await Promise.all([getNodes(), getEntities()]);
  }, [getNodes, getEntities]);

  // Get nodes by entity
  const getNodesByEntity = useCallback((entityId: string): Node[] => {
    return nodes.filter(node => node.entity_id === entityId);
  }, [nodes]);

  // Get entity with its nodes
  const getEntityWithNodes = useCallback((entityId: string) => {
    const entity = entities.find(e => e.entity_id === entityId);
    const entityNodes = getNodesByEntity(entityId);
    return entity ? { entity, nodes: entityNodes } : null;
  }, [entities, getNodesByEntity]);

  return {
    // State
    nodes,
    entities,
    loading,
    error,
    clearError,

    // Entity methods
    createEntity,
    getEntities,
    getEntity,
    updateEntity,
    deleteEntity,

    // Node methods
    createNode,
    getNodes,
    getNode,
    updateNode,
    deleteNode,

    // Search methods
    searchNodes,

    // Basic batch methods
    createBatch,

    // CSV Processing and Advanced Batch methods
    processBatchCSV,
    getStagingNodes,
    analyzeDeduplication,
    processDeduplicationDecisions,
    getBatchLogs,
    updateBatchStatus,
    rollbackBatch,

    // Helper methods
    refreshNodes,
    refreshEntities,
    refreshAll,
    getNodesByEntity,
    getEntityWithNodes,
    getBatchById,
    getPendingBatches,
    getErrorBatches,
  };
}; 