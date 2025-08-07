import type { 
  UnifiedTask,
  Opportunity, 
  ChecklistItem,
  Assignment,
  AssignmentActivity
} from '../types';
import { Timestamp } from 'firebase/firestore';

// Import Activity type separately to avoid potential conflicts
type Activity = {
  id: string;
  activityType: 'Meeting' | 'Email' | 'Call' | 'WhatsApp' | 'Demo' | 'Workshop';
  dateTime: Timestamp;
  relatedContactIds: string[];
  method: 'In-person' | 'Zoom' | 'Phone' | 'Teams' | 'Email';
  subject: string;
  notes: string;
  assignedTo: string;
  attachments?: string[];
  followUpNeeded: boolean;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  completedAt?: Timestamp;
  followUpDate?: Timestamp;
  followUpSubject?: string;
  priority?: 'High' | 'Medium' | 'Low';
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
};

/**
 * @function getTaskStatus
 * @description Determines the status of a task (Overdue, Due Today, Upcoming, Completed) based on its due date and completion status.
 * @param {Date} dueDate - The due date of the task.
 * @param {boolean} isCompleted - Whether the task is marked as completed.
 * @returns {UnifiedTask['status']} The calculated status string.
 */
function getTaskStatus(dueDate: Date, isCompleted: boolean): UnifiedTask['status'] {
  if (isCompleted) {
    return 'Completed';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize to start of day

  const dueDay = new Date(dueDate);
  dueDay.setHours(0, 0, 0, 0); // Normalize to start of day

  if (dueDay.getTime() < today.getTime()) {
    return 'Overdue';
  } else if (dueDay.getTime() === today.getTime()) {
    return 'Due Today';
  } else {
    return 'Upcoming';
  }
}

/**
 * @function getAssignmentPriority
 * @description Infers a priority for an assignment-related task based on the assignment's status.
 * @param {Assignment['status']} status - The status of the parent assignment.
 * @returns {UnifiedTask['priority']} The inferred priority.
 */
function getAssignmentPriority(status: Assignment['status']): UnifiedTask['priority'] {
  switch (status) {
    case 'todo':
      return 'Medium';
    case 'in_progress':
      return 'High';
    case 'done':
      return 'Low';
    default:
      return 'Low'; // Default for any unhandled status
  }
}

/**
 * @function convertTimestampToDate
 * @description Converts a Firestore Timestamp to a JavaScript Date object.
 * @param {Timestamp | Date | undefined} timestamp - The timestamp to convert.
 * @returns {Date | undefined} The converted date or undefined if no timestamp provided.
 */
function convertTimestampToDate(timestamp: Timestamp | Date | undefined): Date | undefined {
  if (!timestamp) return undefined;
  
  if (timestamp instanceof Date) {
    return timestamp;
  }
  
  // Handle Firestore Timestamp
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return (timestamp as Timestamp).toDate();
  }
  
  // Handle timestamp objects with seconds/nanoseconds (both formats)
  if (timestamp && typeof timestamp === 'object') {
    // Handle {seconds: ..., nanoseconds: ...} format
    if ('seconds' in timestamp) {
      return new Date((timestamp as any).seconds * 1000);
    }
    // Handle {_seconds: ..., _nanoseconds: ...} format  
    if ('_seconds' in timestamp) {
      return new Date((timestamp as any)._seconds * 1000);
    }
  }
  
  // Handle string dates
  if (typeof timestamp === 'string') {
    try {
      return new Date(timestamp);
    } catch {
      return undefined;
    }
  }
  
  // Fallback - try to convert to Date
  try {
    return new Date(timestamp as any);
  } catch {
    return undefined;
  }
}

/**
 * @function getTimestampMillis
 * @description Gets milliseconds from a Timestamp or Date object.
 * @param {Timestamp | Date} timestamp - The timestamp to convert.
 * @returns {number} The timestamp in milliseconds.
 */
function getTimestampMillis(timestamp: Timestamp | Date): number {
  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }
  
  // Handle Firestore Timestamp
  if (timestamp && typeof timestamp === 'object' && 'toMillis' in timestamp) {
    return (timestamp as Timestamp).toMillis();
  }
  
  // Handle timestamp objects with seconds/nanoseconds (both formats)
  if (timestamp && typeof timestamp === 'object') {
    // Handle {seconds: ..., nanoseconds: ...} format
    if ('seconds' in timestamp) {
      return (timestamp as any).seconds * 1000;
    }
    // Handle {_seconds: ..., _nanoseconds: ...} format
    if ('_seconds' in timestamp) {
      return (timestamp as any)._seconds * 1000;
    }
  }
  
  // Fallback - try to convert to Date and get time
  try {
    return new Date(timestamp as any).getTime();
  } catch {
    return 0;
  }
}

/**
 * @function transformDataForDashboard
 * @description Transforms raw Opportunity and Assignment data into a unified list of tasks for the dashboard.
 * Only includes items that have a defined due date.
 * @param {Opportunity[]} opportunities - Array of Opportunity objects.
 * @param {Assignment[]} assignments - Array of Assignment objects.
 * @returns {UnifiedTask[]} A sorted array of UnifiedTask objects.
 */
export function transformDataForDashboard(opportunities: Opportunity[], assignments: Assignment[]): UnifiedTask[] {
  const unifiedTasks: UnifiedTask[] = [];

  // Process Opportunities
  opportunities.forEach(opportunity => {
    // 1. Process Opportunity Activities (using followUpDate as primary, dateTime as fallback for scheduled items)
    opportunity.activities?.forEach(activity => {
      // Skip completed activities
      if (activity.status === 'Completed') {
        return;
      }

      let dueDate = convertTimestampToDate(activity.followUpDate);
      
      // Fallback: Use scheduled activities (including overdue ones)
      if (!dueDate && activity.status === 'Scheduled') {
        const activityDateTime = convertTimestampToDate(activity.dateTime);
        if (activityDateTime) {
          dueDate = activityDateTime;
        }
      }
      
      if (dueDate) {
        unifiedTasks.push({
          id: activity.id,
          title: activity.subject,
          type: 'OpportunityActivity',
          parentId: opportunity.id,
          parentTitle: opportunity.title,
          dueDate: dueDate,
          status: getTaskStatus(dueDate, activity.status === 'Completed'),
          priority: activity.priority,
          isComplete: activity.status === 'Completed',
          linkedUrl: `/opportunities/${opportunity.id}`,
          parentType: 'Opportunity',
          notes: activity.notes,
          assignedTo: activity.assignedTo,
          createdAt: activity.createdAt,
          completedAt: convertTimestampToDate(activity.completedAt)
        });
      }
    });

    // 2. Process Opportunity Checklist Items (using dueDate)
    if (opportunity.checklist) {
      opportunity.checklist.forEach(item => {
        // Skip completed checklist items
        if (item.completed) {
          return;
        }

        if (item.dueDate) {
          unifiedTasks.push({
            id: item.id,
            title: item.text,
            type: 'OpportunityChecklist',
            parentId: opportunity.id,
            parentTitle: opportunity.title,
            dueDate: new Date(item.dueDate),
            status: getTaskStatus(new Date(item.dueDate), item.completed),
            priority: opportunity.priority, // Inherit priority from parent opportunity
            isComplete: item.completed,
            linkedUrl: `/opportunities/${opportunity.id}`,
            parentType: 'Opportunity',
            createdAt: item.createdAt,
            completedAt: convertTimestampToDate(item.completedAt)
          });
        }
      });
    }

    // 3. Process Opportunity Blockers (using dueDate)
    if (opportunity.blockers) {
      opportunity.blockers.forEach(blocker => {
        // Skip completed blockers
        if (blocker.completed) {
          return;
        }

        if (blocker.dueDate) {
          unifiedTasks.push({
            id: blocker.id,
            title: blocker.text,
            type: 'OpportunityBlocker',
            parentId: opportunity.id,
            parentTitle: opportunity.title,
            dueDate: new Date(blocker.dueDate),
            status: getTaskStatus(new Date(blocker.dueDate), blocker.completed),
            priority: 'Critical', // Blockers are typically critical
            isComplete: blocker.completed,
            linkedUrl: `/opportunities/${opportunity.id}`,
            parentType: 'Opportunity',
            createdAt: blocker.createdAt,
            completedAt: convertTimestampToDate(blocker.completedAt)
          });
        }
      });
    }
  });

  // Process Assignments
  assignments.forEach(assignment => {
    // 1. Process Assignment Checklist Items (using dueDate)
    if (assignment.checklist) {
      assignment.checklist.forEach(item => {
        // Skip completed checklist items
        if (item.completed) {
          return;
        }

        // Handle potential missing text field
        const itemText = item.text || item.id || 'Untitled Task';
        
        if (item.dueDate) {
          unifiedTasks.push({
            id: item.id,
            title: itemText,
            type: 'AssignmentChecklist',
            parentId: assignment.taskId,
            parentTitle: assignment.title,
            dueDate: new Date(item.dueDate),
            status: getTaskStatus(new Date(item.dueDate), item.completed),
            priority: getAssignmentPriority(assignment.status), // Infer priority from assignment status
            isComplete: item.completed,
            linkedUrl: `/assignments/${assignment.taskId}`,
            parentType: 'Assignment',
            createdAt: item.createdAt || assignment.createdAt, // Fallback to assignment creation date
            completedAt: convertTimestampToDate(item.completedAt)
          });
        }
      });
    }

    // 2. Process Assignment Activities (using followUpDate)
    if (assignment.activities) {
      assignment.activities.forEach(activity => {
        // Skip completed activities
        if (activity.status === 'Completed') {
          return;
        }

        let dueDate = convertTimestampToDate(activity.followUpDate);
        
        // Fallback: Use scheduled activities (including overdue ones)
        if (!dueDate && activity.status === 'Scheduled') {
          const activityDateTime = convertTimestampToDate(activity.dateTime);
          if (activityDateTime) {
            dueDate = activityDateTime;
          }
        }
        
        if (dueDate) {
          unifiedTasks.push({
            id: activity.id,
            title: activity.subject,
            type: 'AssignmentActivity',
            parentId: assignment.taskId,
            parentTitle: assignment.title,
            dueDate: dueDate,
            status: getTaskStatus(dueDate, activity.status === 'Completed'),
            priority: activity.priority || getAssignmentPriority(assignment.status),
            isComplete: activity.status === 'Completed',
            linkedUrl: `/assignments/${assignment.taskId}`,
            parentType: 'Assignment',
            notes: activity.notes,
            assignedTo: activity.assignedTo,
            createdAt: activity.createdAt,
            completedAt: convertTimestampToDate(activity.completedAt)
          });
        }
      });
    }
  });

  // Count tasks by status for debugging
  const statusCounts = unifiedTasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log(`Planner: Generated ${unifiedTasks.length} active tasks from ${opportunities.length} opportunities and ${assignments.length} assignments`);
  console.log('Task status breakdown:', statusCounts);
  
  // Sort tasks by due date
  return unifiedTasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/**
 * @function filterUnifiedTasks
 * @description Filters unified tasks based on provided criteria.
 * @param {UnifiedTask[]} tasks - Array of unified tasks to filter.
 * @param {UnifiedTaskFilters} filters - Filter criteria.
 * @returns {UnifiedTask[]} Filtered array of tasks.
 */
export function filterUnifiedTasks(tasks: UnifiedTask[], filters: {
  status?: UnifiedTask['status'];
  priority?: UnifiedTask['priority'];
  type?: UnifiedTask['type'];
  parentType?: UnifiedTask['parentType'];
  assignedTo?: string;
  dateRange?: { start: Date; end: Date };
}): UnifiedTask[] {
  return tasks.filter(task => {
    // Filter by status
    if (filters.status && task.status !== filters.status) {
      return false;
    }

    // Filter by priority
    if (filters.priority && task.priority !== filters.priority) {
      return false;
    }

    // Filter by type
    if (filters.type && task.type !== filters.type) {
      return false;
    }

    // Filter by parent type
    if (filters.parentType && task.parentType !== filters.parentType) {
      return false;
    }

    // Filter by assigned user
    if (filters.assignedTo && task.assignedTo !== filters.assignedTo) {
      return false;
    }

    // Filter by date range
    if (filters.dateRange) {
      const taskDate = task.dueDate;
      if (taskDate < filters.dateRange.start || taskDate > filters.dateRange.end) {
        return false;
      }
    }

    return true;
  });
}

/**
 * @function sortUnifiedTasks
 * @description Sorts unified tasks based on specified field and direction.
 * @param {UnifiedTask[]} tasks - Array of unified tasks to sort.
 * @param {UnifiedTaskSortOptions} sortOptions - Sorting criteria.
 * @returns {UnifiedTask[]} Sorted array of tasks.
 */
export function sortUnifiedTasks(tasks: UnifiedTask[], sortOptions: {
  field: 'dueDate' | 'priority' | 'title' | 'parentTitle' | 'createdAt';
  direction: 'asc' | 'desc';
}): UnifiedTask[] {
  const { field, direction } = sortOptions;

  return [...tasks].sort((a, b) => {
    let comparison = 0;

    switch (field) {
      case 'dueDate':
        comparison = a.dueDate.getTime() - b.dueDate.getTime();
        break;
      case 'priority':
        const priorityOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
        const aPriority = priorityOrder[a.priority || 'Low'] || 0;
        const bPriority = priorityOrder[b.priority || 'Low'] || 0;
        comparison = aPriority - bPriority;
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
      case 'parentTitle':
        comparison = a.parentTitle.localeCompare(b.parentTitle);
        break;
      case 'createdAt':
        comparison = getTimestampMillis(a.createdAt) - getTimestampMillis(b.createdAt);
        break;
    }

    return direction === 'asc' ? comparison : -comparison;
  });
} 