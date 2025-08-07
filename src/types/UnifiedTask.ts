import { Timestamp } from 'firebase/firestore';

/**
 * @interface UnifiedTask
 * @description Represents a normalized task or checklist item for display on a unified dashboard.
 * Combines data from Opportunity Activities, Checklists, Blockers, and Assignment Checklists.
 */
export interface UnifiedTask {
  id: string; // Unique ID of the original item (Activity, ChecklistItem)
  title: string; // Subject for Activities, text for ChecklistItems
  type: 'OpportunityActivity' | 'OpportunityChecklist' | 'OpportunityBlocker' | 'AssignmentActivity' | 'AssignmentChecklist'; // Origin of the item
  parentId: string; // ID of the parent Opportunity or Assignment
  parentTitle: string; // Title of the parent Opportunity or Assignment, for context
  dueDate: Date; // The date the item is due
  status: 'Overdue' | 'Due Today' | 'Upcoming' | 'Completed'; // Calculated status for dashboard display
  priority?: 'High' | 'Medium' | 'Low' | 'Critical'; // Priority, inherited or inferred
  isComplete: boolean; // True if the item is completed
  linkedUrl: string; // URL to navigate to the parent Opportunity or Assignment detail page
  parentType: 'Opportunity' | 'Assignment'; // Type of parent for additional context
  notes?: string; // Notes from activities
  assignedTo?: string; // User assigned to the task (ID)
  assignedToName?: string; // Display name of the assigned user
  createdAt: Timestamp; // When the item was created
  completedAt?: Timestamp; // When the item was completed
}

/**
 * @interface UnifiedTaskFilters
 * @description Filter options for the unified task dashboard
 */
export interface UnifiedTaskFilters {
  status?: UnifiedTask['status'];
  priority?: UnifiedTask['priority'];
  type?: UnifiedTask['type'];
  parentType?: UnifiedTask['parentType'];
  assignedTo?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * @interface UnifiedTaskSortOptions
 * @description Sorting options for the unified task dashboard
 */
export interface UnifiedTaskSortOptions {
  field: 'dueDate' | 'priority' | 'title' | 'parentTitle' | 'createdAt';
  direction: 'asc' | 'desc';
}

/**
 * @type UnifiedTaskType
 * @description Union type for all possible task types
 */
export type UnifiedTaskType = UnifiedTask['type'];

/**
 * @type UnifiedTaskStatus
 * @description Union type for all possible task statuses
 */
export type UnifiedTaskStatus = UnifiedTask['status'];

/**
 * @type UnifiedTaskPriority
 * @description Union type for all possible task priorities
 */
export type UnifiedTaskPriority = UnifiedTask['priority']; 