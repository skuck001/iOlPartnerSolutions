import { useState, useCallback } from 'react';
import { useApi } from './useApi';
import type { 
  Assignment, 
  CreateAssignmentRequest, 
  UpdateAssignmentRequest,
  AddChecklistItemRequest,
  UpdateChecklistItemRequest,
  AddProgressLogEntryRequest,
  UpdateProgressLogEntryRequest,
  RemoveProgressLogEntryRequest,
  RemoveChecklistItemRequest,
  AddAssignmentActivityRequest,
  UpdateAssignmentActivityRequest,
  RemoveAssignmentActivityRequest,
  AssignmentActivity
} from '../types';

export const useAssignmentsApi = () => {
  const { callFunction, loading, error, clearError } = useApi();
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const createAssignment = useCallback(async (data: CreateAssignmentRequest): Promise<Assignment> => {
    const result = await callFunction('createAssignment', data);
    return result;
  }, [callFunction]);

  const getAssignments = useCallback(async (): Promise<Assignment[]> => {
    const result = await callFunction('getAssignments');
    setAssignments(result || []);
    return result || [];
  }, [callFunction]);

  const getAssignmentsByOwner = useCallback(async (ownerId?: string): Promise<Assignment[]> => {
    const result = await callFunction('getAssignmentsByOwner', { ownerId });
    setAssignments(result || []);
    return result || [];
  }, [callFunction]);

  const getAssignment = useCallback(async (taskId: string): Promise<Assignment> => {
    const result = await callFunction('getAssignment', { taskId });
    return result;
  }, [callFunction]);

  const updateAssignment = useCallback(async (data: UpdateAssignmentRequest): Promise<Assignment> => {
    const result = await callFunction('updateAssignment', data);
    
    // Update local state
    setAssignments(prev => prev.map(assignment => 
      assignment.taskId === data.taskId ? result : assignment
    ));
    
    return result;
  }, [callFunction]);

  const deleteAssignment = useCallback(async (taskId: string): Promise<void> => {
    await callFunction('deleteAssignment', { taskId });
    
    // Update local state
    setAssignments(prev => prev.filter(assignment => assignment.taskId !== taskId));
  }, [callFunction]);

  const addChecklistItem = useCallback(async (data: AddChecklistItemRequest): Promise<Assignment> => {
    const result = await callFunction('addChecklistItem', data);
    
    // Update local state
    setAssignments(prev => prev.map(assignment => 
      assignment.taskId === data.taskId ? result : assignment
    ));
    
    return result;
  }, [callFunction]);

  const updateChecklistItem = useCallback(async (data: UpdateChecklistItemRequest): Promise<Assignment> => {
    const result = await callFunction('updateChecklistItem', data);
    
    // Update local state
    setAssignments(prev => prev.map(assignment => 
      assignment.taskId === data.taskId ? result : assignment
    ));
    
    return result;
  }, [callFunction]);

  const removeChecklistItem = useCallback(async (data: RemoveChecklistItemRequest): Promise<Assignment> => {
    const result = await callFunction('removeChecklistItem', data);
    
    // Update local state
    setAssignments(prev => prev.map(assignment => 
      assignment.taskId === data.taskId ? result : assignment
    ));
    
    return result;
  }, [callFunction]);

  const addProgressLogEntry = useCallback(async (data: AddProgressLogEntryRequest): Promise<Assignment> => {
    const result = await callFunction('addProgressLogEntry', data);
    
    // Update local state
    setAssignments(prev => prev.map(assignment => 
      assignment.taskId === data.taskId ? result : assignment
    ));
    
    return result;
  }, [callFunction]);

  const updateProgressLogEntry = useCallback(async (data: UpdateProgressLogEntryRequest): Promise<Assignment> => {
    const result = await callFunction('updateProgressLogEntry', data);
    
    // Update local state
    setAssignments(prev => prev.map(assignment => 
      assignment.taskId === data.taskId ? result : assignment
    ));
    
    return result;
  }, [callFunction]);

  const removeProgressLogEntry = useCallback(async (data: RemoveProgressLogEntryRequest): Promise<Assignment> => {
    const result = await callFunction('removeProgressLogEntry', data);
    
    // Update local state
    setAssignments(prev => prev.map(assignment => 
      assignment.taskId === data.taskId ? result : assignment
    ));
    
    return result;
  }, [callFunction]);

  // Helper functions for better UX
  const getAssignmentsByStatus = useCallback((status: 'todo' | 'in_progress' | 'done') => {
    return assignments.filter(assignment => assignment.status === status);
  }, [assignments]);

  const getAssignmentProgress = useCallback((assignment: Assignment) => {
    if (assignment.checklist.length === 0) return 0;
    const completedItems = assignment.checklist.filter(item => item.completed).length;
    return (completedItems / assignment.checklist.length) * 100;
  }, []);

  // ============================================================================
  // ACTIVITY MANAGEMENT METHODS
  // ============================================================================

  const addActivityToAssignment = useCallback(async (data: AddAssignmentActivityRequest): Promise<Assignment> => {
    const result = await callFunction('addActivityToAssignment', data);
    
    // Update local state
    setAssignments(prev => prev.map(assignment => 
      assignment.taskId === data.taskId ? result : assignment
    ));
    
    return result;
  }, [callFunction]);

  const updateActivityInAssignment = useCallback(async (data: UpdateAssignmentActivityRequest): Promise<Assignment> => {
    const result = await callFunction('updateActivityInAssignment', data);
    
    // Update local state
    setAssignments(prev => prev.map(assignment => 
      assignment.taskId === data.taskId ? result : assignment
    ));
    
    return result;
  }, [callFunction]);

  const removeActivityFromAssignment = useCallback(async (data: RemoveAssignmentActivityRequest): Promise<void> => {
    await callFunction('removeActivityFromAssignment', data);
    
    // Refresh the assignment to get updated activities list
    const updatedAssignment = await getAssignment(data.taskId);
    setAssignments(prev => prev.map(assignment => 
      assignment.taskId === data.taskId ? updatedAssignment : assignment
    ));
  }, [callFunction, getAssignment]);

  const getActivitiesByAssignment = useCallback(async (taskId: string): Promise<AssignmentActivity[]> => {
    const result = await callFunction('getActivitiesByAssignment', { taskId });
    return result.activities || [];
  }, [callFunction]);

  return {
    assignments,
    createAssignment,
    getAssignments,
    getAssignmentsByOwner,
    getAssignment,
    updateAssignment,
    deleteAssignment,
    addChecklistItem,
    updateChecklistItem,
    removeChecklistItem,
    addProgressLogEntry,
    updateProgressLogEntry,
    removeProgressLogEntry,
    // Activity management methods
    addActivityToAssignment,
    updateActivityInAssignment,
    removeActivityFromAssignment,
    getActivitiesByAssignment,
    // Helper methods
    getAssignmentsByStatus,
    getAssignmentProgress,
    loading,
    error,
    clearError,
  };
}; 