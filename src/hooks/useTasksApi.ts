import { useState, useCallback } from 'react';
import type { Task, TaskStatus } from '../types/Task';
import type { Activity, ActivityStatus, ChecklistItem } from '../types/Opportunity';
import { useApi } from './useApi';
import { Timestamp } from 'firebase/firestore';

export interface TaskFilters {
  ownerId?: string;
  assignedTo?: string;
  opportunityId?: string;
  status?: TaskStatus;
  bucket?: string;
  dueDateStart?: Date;
  dueDateEnd?: Date;
}

export interface TasksQueryOptions {
  filters?: TaskFilters;
  sortBy?: 'title' | 'dueDate' | 'status' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface TasksResponse {
  tasks: Task[];
  total: number;
  hasMore: boolean;
}

export interface ActivityFilters {
  assignedTo?: string;
  status?: ActivityStatus;
  activityType?: string;
  dateStart?: Date;
  dateEnd?: Date;
}

export interface ActivitiesQueryOptions {
  filters?: ActivityFilters;
  sortBy?: 'dateTime' | 'status' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export const useTasksApi = () => {
  const { callFunction, loading, error } = useApi();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  // ============================================================================
  // STANDALONE TASKS METHODS
  // ============================================================================

  // Get tasks with filtering and pagination
  const getTasks = useCallback(async (options: TasksQueryOptions = {}) => {
    try {
      const response = await callFunction('getTasks', options);
      return response.data as TasksResponse;
    } catch (err) {
      console.error('Error getting tasks:', err);
      throw err;
    }
  }, [callFunction]);

  // Get single task
  const getTask = useCallback(async (taskId: string): Promise<Task> => {
    try {
      const response = await callFunction('getTask', { taskId });
      return response.task as Task;
    } catch (err) {
      console.error('Error getting task:', err);
      throw err;
    }
  }, [callFunction]);

  // Create new task
  const createTask = useCallback(async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> => {
    try {
      // Convert Date to Timestamp if needed
      const processedData = {
        ...taskData,
        dueDate: taskData.dueDate instanceof Date ? Timestamp.fromDate(taskData.dueDate) : taskData.dueDate
      };

      const response = await callFunction('createTask', processedData);
      const newTask = response.task as Task;
      
      // Update local state
      setTasks(prev => [newTask, ...prev]);
      
      return newTask;
    } catch (err) {
      console.error('Error creating task:', err);
      throw err;
    }
  }, [callFunction]);

  // Update task
  const updateTask = useCallback(async (taskId: string, updates: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<Task> => {
    try {
      // Convert Date to Timestamp if needed
      const processedUpdates = {
        ...updates,
        ...(updates.dueDate && updates.dueDate instanceof Date && {
          dueDate: Timestamp.fromDate(updates.dueDate)
        })
      };

      const response = await callFunction('updateTask', {
        taskId,
        ...processedUpdates
      });
      const updatedTask = response.task as Task;
      
      // Update local state
      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ));
      
      return updatedTask;
    } catch (err) {
      console.error('Error updating task:', err);
      throw err;
    }
  }, [callFunction]);

  // Delete task
  const deleteTask = useCallback(async (taskId: string): Promise<void> => {
    try {
      await callFunction('deleteTask', { taskId });
      
      // Update local state
      setTasks(prev => prev.filter(task => task.id !== taskId));
    } catch (err) {
      console.error('Error deleting task:', err);
      throw err;
    }
  }, [callFunction]);

  // Load tasks (convenience method)
  const loadTasks = useCallback(async (options: TasksQueryOptions = {}) => {
    try {
      const response = await getTasks(options);
      setTasks(response.tasks);
      return response;
    } catch (err) {
      console.error('Error loading tasks:', err);
      throw err;
    }
  }, [getTasks]);

  // ============================================================================
  // ACTIVITY METHODS (within opportunities)
  // ============================================================================

  // Get activities by opportunity
  const getActivitiesByOpportunity = useCallback(async (opportunityId: string, options: ActivitiesQueryOptions = {}): Promise<Activity[]> => {
    try {
      const response = await callFunction('getActivitiesByOpportunity', {
        opportunityId,
        ...options
      });
      return response.activities as Activity[];
    } catch (err) {
      console.error('Error getting activities:', err);
      throw err;
    }
  }, [callFunction]);

  // Add activity to opportunity
  const addActivityToOpportunity = useCallback(async (
    opportunityId: string, 
    activityData: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>
  ): Promise<Activity> => {
    try {
      // Convert Date to Timestamp if needed
      const processedData = {
        ...activityData,
        dateTime: activityData.dateTime instanceof Date ? Timestamp.fromDate(activityData.dateTime) : activityData.dateTime,
        ...(activityData.followUpDate && activityData.followUpDate instanceof Date && {
          followUpDate: Timestamp.fromDate(activityData.followUpDate)
        }),
        ...(activityData.completedAt && activityData.completedAt instanceof Date && {
          completedAt: Timestamp.fromDate(activityData.completedAt)
        })
      };

      const response = await callFunction('addActivityToOpportunity', {
        opportunityId,
        ...processedData
      });
      const newActivity = response.activity as Activity;
      
      // Update local state
      setActivities(prev => [newActivity, ...prev]);
      
      return newActivity;
    } catch (err) {
      console.error('Error adding activity:', err);
      throw err;
    }
  }, [callFunction]);

  // Update activity in opportunity
  const updateActivityInOpportunity = useCallback(async (
    opportunityId: string, 
    activityId: string, 
    updates: Partial<Omit<Activity, 'id' | 'createdAt' | 'createdBy'>>
  ): Promise<Activity> => {
    try {
      // Convert Date to Timestamp if needed
      const processedUpdates = {
        ...updates,
        ...(updates.dateTime && updates.dateTime instanceof Date && {
          dateTime: Timestamp.fromDate(updates.dateTime)
        }),
        ...(updates.followUpDate && updates.followUpDate instanceof Date && {
          followUpDate: Timestamp.fromDate(updates.followUpDate)
        }),
        ...(updates.completedAt && updates.completedAt instanceof Date && {
          completedAt: Timestamp.fromDate(updates.completedAt)
        })
      };

      const response = await callFunction('updateActivityInOpportunity', {
        opportunityId,
        activityId,
        ...processedUpdates
      });
      const updatedActivity = response.activity as Activity;
      
      // Update local state
      setActivities(prev => prev.map(activity => 
        activity.id === activityId ? updatedActivity : activity
      ));
      
      return updatedActivity;
    } catch (err) {
      console.error('Error updating activity:', err);
      throw err;
    }
  }, [callFunction]);

  // Delete activity from opportunity
  const deleteActivityFromOpportunity = useCallback(async (opportunityId: string, activityId: string): Promise<void> => {
    try {
      await callFunction('deleteActivityFromOpportunity', { opportunityId, activityId });
      
      // Update local state
      setActivities(prev => prev.filter(activity => activity.id !== activityId));
    } catch (err) {
      console.error('Error deleting activity:', err);
      throw err;
    }
  }, [callFunction]);

  // Load activities for an opportunity (convenience method)
  const loadActivitiesForOpportunity = useCallback(async (opportunityId: string, options: ActivitiesQueryOptions = {}) => {
    try {
      const response = await getActivitiesByOpportunity(opportunityId, options);
      setActivities(response);
      return response;
    } catch (err) {
      console.error('Error loading activities:', err);
      throw err;
    }
  }, [getActivitiesByOpportunity]);

  // ============================================================================
  // CHECKLIST METHODS (within opportunities)
  // ============================================================================

  // Get checklist by opportunity
  const getChecklistByOpportunity = useCallback(async (opportunityId: string): Promise<ChecklistItem[]> => {
    try {
      const response = await callFunction('getChecklistByOpportunity', { opportunityId });
      return response.checklist as ChecklistItem[];
    } catch (err) {
      console.error('Error getting checklist:', err);
      throw err;
    }
  }, [callFunction]);

  // Add checklist item to opportunity
  const addChecklistItemToOpportunity = useCallback(async (opportunityId: string, text: string): Promise<ChecklistItem> => {
    try {
      const response = await callFunction('addChecklistItemToOpportunity', {
        opportunityId,
        text
      });
      const newItem = response.item as ChecklistItem;
      
      // Update local state
      setChecklist(prev => [newItem, ...prev]);
      
      return newItem;
    } catch (err) {
      console.error('Error adding checklist item:', err);
      throw err;
    }
  }, [callFunction]);

  // Update checklist item in opportunity
  const updateChecklistItemInOpportunity = useCallback(async (
    opportunityId: string, 
    itemId: string, 
    updates: Partial<Omit<ChecklistItem, 'id' | 'createdAt'>>
  ): Promise<ChecklistItem> => {
    try {
      const response = await callFunction('updateChecklistItemInOpportunity', {
        opportunityId,
        itemId,
        ...updates
      });
      const updatedItem = response.item as ChecklistItem;
      
      // Update local state
      setChecklist(prev => prev.map(item => 
        item.id === itemId ? updatedItem : item
      ));
      
      return updatedItem;
    } catch (err) {
      console.error('Error updating checklist item:', err);
      throw err;
    }
  }, [callFunction]);

  // Delete checklist item from opportunity
  const deleteChecklistItemFromOpportunity = useCallback(async (opportunityId: string, itemId: string): Promise<void> => {
    try {
      await callFunction('deleteChecklistItemFromOpportunity', { opportunityId, itemId });
      
      // Update local state
      setChecklist(prev => prev.filter(item => item.id !== itemId));
    } catch (err) {
      console.error('Error deleting checklist item:', err);
      throw err;
    }
  }, [callFunction]);

  // Load checklist for an opportunity (convenience method)
  const loadChecklistForOpportunity = useCallback(async (opportunityId: string) => {
    try {
      const response = await getChecklistByOpportunity(opportunityId);
      setChecklist(response);
      return response;
    } catch (err) {
      console.error('Error loading checklist:', err);
      throw err;
    }
  }, [getChecklistByOpportunity]);

  // Toggle checklist item (convenience method)
  const toggleChecklistItem = useCallback(async (opportunityId: string, itemId: string, completed: boolean): Promise<ChecklistItem> => {
    try {
      return await updateChecklistItemInOpportunity(opportunityId, itemId, { completed });
    } catch (err) {
      console.error('Error toggling checklist item:', err);
      throw err;
    }
  }, [updateChecklistItemInOpportunity]);

  return {
    // Data
    tasks,
    activities,
    checklist,
    
    // Loading states
    loading,
    error,
    
    // Standalone Tasks API methods
    getTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    loadTasks,
    
    // Activities API methods
    getActivitiesByOpportunity,
    addActivityToOpportunity,
    updateActivityInOpportunity,
    deleteActivityFromOpportunity,
    loadActivitiesForOpportunity,
    
    // Checklist API methods
    getChecklistByOpportunity,
    addChecklistItemToOpportunity,
    updateChecklistItemInOpportunity,
    deleteChecklistItemFromOpportunity,
    loadChecklistForOpportunity,
    toggleChecklistItem,
    
    // State setters (for direct manipulation if needed)
    setTasks,
    setActivities,
    setChecklist
  };
}; 