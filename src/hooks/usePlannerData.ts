import { useState, useEffect, useCallback } from 'react';
import { useOpportunitiesApi } from './useOpportunitiesApi';
import { useAssignmentsApi } from './useAssignmentsApi';
import { useUsersApi } from './useUsersApi';
import { transformDataForDashboard, filterUnifiedTasks, sortUnifiedTasks } from '../utils/dataTransformers';
import type { 
  UnifiedTask, 
  UnifiedTaskFilters, 
  UnifiedTaskSortOptions 
} from '../types';

export interface PlannerDataState {
  tasks: UnifiedTask[];
  filteredTasks: UnifiedTask[];
  loading: boolean;
  error: string | null;
  filters: UnifiedTaskFilters;
  sortOptions: UnifiedTaskSortOptions;
}

export const usePlannerData = () => {
  const { getOpportunities, loading: opportunitiesLoading, error: opportunitiesError } = useOpportunitiesApi();
  const { getAssignments, loading: assignmentsLoading, error: assignmentsError } = useAssignmentsApi();
  const { getAllUsers, getUserDisplayName } = useUsersApi();
  
  const [state, setState] = useState<PlannerDataState>({
    tasks: [],
    filteredTasks: [],
    loading: false,
    error: null,
    filters: {},
    sortOptions: { field: 'dueDate', direction: 'asc' }
  });

  // Fetch all data
  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // Try to fetch data with error handling and fallbacks
      let opportunities: any[] = [];
      let assignments: any[] = [];
      
      try {
        const opportunitiesResponse = await getOpportunities({ limit: 100 });
        opportunities = opportunitiesResponse.opportunities || [];
      } catch (oppError) {
        console.error('Error fetching opportunities:', oppError);
        // Continue without opportunities data
        opportunities = [];
      }
      
      try {
        assignments = await getAssignments();
      } catch (assignError) {
        console.error('Error fetching assignments:', assignError);
        // Continue without assignments data
        assignments = [];
      }

      // Fetch users to map IDs to names
      let users: any[] = [];
      try {
        users = await getAllUsers();
      } catch (userError) {
        console.error('Error fetching users:', userError);
        // Continue without user names
      }

      const unifiedTasks = transformDataForDashboard(opportunities, assignments);
      
      // Map user IDs to display names
      const tasksWithUserNames = unifiedTasks.map(task => {
        if (task.assignedTo && users.length > 0) {
          const user = users.find(u => u.id === task.assignedTo);
          if (user) {
            return {
              ...task,
              assignedToName: getUserDisplayName(user),
              assignedTo: task.assignedTo // Keep the ID for filtering
            };
          }
        }
        return {
          ...task,
          assignedToName: task.assignedTo // Fallback to ID if user not found
        };
      });
      
      setState(prev => ({
        ...prev,
        tasks: tasksWithUserNames,
        loading: false,
        error: opportunities.length === 0 && assignments.length === 0 
          ? 'Failed to load any data. Please check your connection and try again.'
          : null
      }));
    } catch (error) {
      console.error('Error fetching planner data:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to load planner data',
        loading: false
      }));
    }
  }, [getOpportunities, getAssignments, getAllUsers, getUserDisplayName]);

  // Apply filters and sorting
  const applyFiltersAndSort = useCallback((tasks: UnifiedTask[], filters: UnifiedTaskFilters, sortOptions: UnifiedTaskSortOptions) => {
    let filtered = filterUnifiedTasks(tasks, filters);
    return sortUnifiedTasks(filtered, sortOptions);
  }, []);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<UnifiedTaskFilters> | UnifiedTaskFilters) => {
    setState(prev => {
      // If newFilters is a complete replacement (from filter removal), use it directly
      // Otherwise merge with existing filters
      const updatedFilters = Object.keys(newFilters).length === 0 || 
        (newFilters as any)._isCompleteReplacement 
        ? newFilters as UnifiedTaskFilters
        : { ...prev.filters, ...newFilters };
      
      const filteredTasks = applyFiltersAndSort(prev.tasks, updatedFilters, prev.sortOptions);
      
      return {
        ...prev,
        filters: updatedFilters,
        filteredTasks
      };
    });
  }, [applyFiltersAndSort]);

  // Update sort options
  const updateSortOptions = useCallback((newSortOptions: Partial<UnifiedTaskSortOptions>) => {
    setState(prev => {
      const updatedSortOptions = { ...prev.sortOptions, ...newSortOptions };
      const filteredTasks = applyFiltersAndSort(prev.tasks, prev.filters, updatedSortOptions);
      
      return {
        ...prev,
        sortOptions: updatedSortOptions,
        filteredTasks
      };
    });
  }, [applyFiltersAndSort]);

  // Clear filters
  const clearFilters = useCallback(() => {
    setState(prev => {
      const filteredTasks = applyFiltersAndSort(prev.tasks, {}, prev.sortOptions);
      
      return {
        ...prev,
        filters: {},
        filteredTasks
      };
    });
  }, [applyFiltersAndSort]);

  // Get task statistics
  const getTaskStats = useCallback(() => {
    const { tasks } = state;
    
    return {
      total: tasks.length,
      overdue: tasks.filter(task => task.status === 'Overdue').length,
      dueToday: tasks.filter(task => task.status === 'Due Today').length,
      upcoming: tasks.filter(task => task.status === 'Upcoming').length,
      completed: tasks.filter(task => task.status === 'Completed').length,
      byPriority: {
        Critical: tasks.filter(task => task.priority === 'Critical').length,
        High: tasks.filter(task => task.priority === 'High').length,
        Medium: tasks.filter(task => task.priority === 'Medium').length,
        Low: tasks.filter(task => task.priority === 'Low').length,
      },
      byType: {
        OpportunityActivity: tasks.filter(task => task.type === 'OpportunityActivity').length,
        OpportunityChecklist: tasks.filter(task => task.type === 'OpportunityChecklist').length,
        OpportunityBlocker: tasks.filter(task => task.type === 'OpportunityBlocker').length,
        AssignmentActivity: tasks.filter(task => task.type === 'AssignmentActivity').length,
        AssignmentChecklist: tasks.filter(task => task.type === 'AssignmentChecklist').length,
      }
    };
  }, [state.tasks]);

  // Initialize data on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Update filtered tasks when tasks change
  useEffect(() => {
    setState(prev => {
      const filteredTasks = applyFiltersAndSort(prev.tasks, prev.filters, prev.sortOptions);
      return { ...prev, filteredTasks };
    });
  }, [state.tasks, applyFiltersAndSort]);

  return {
    ...state,
    fetchData,
    updateFilters,
    updateSortOptions,
    clearFilters,
    getTaskStats,
    loading: state.loading || opportunitiesLoading || assignmentsLoading,
    error: state.error || opportunitiesError || assignmentsError
  };
}; 