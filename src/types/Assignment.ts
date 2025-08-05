import { Timestamp } from 'firebase/firestore';

export interface ChecklistItem {
  id: string;
  text: string; // Changed from 'label' to 'text' to match Opportunity type
  completed: boolean;
  dueDate?: Date;
  completedAt?: Timestamp;
}

export interface ProgressLogEntry {
  id: string;
  timestamp: Timestamp;
  userId: string;
  message: string;
}

// Activity status for assignments
export type AssignmentActivityStatus = 'Scheduled' | 'Completed' | 'Cancelled';

// Activity interface for assignments (similar to Opportunities)
export interface AssignmentActivity {
  id: string;
  activityType: 'Meeting' | 'Email' | 'Call' | 'WhatsApp' | 'Demo' | 'Workshop' | 'Review' | 'Update';
  dateTime: Timestamp;
  relatedContactIds?: string[]; // Optional for assignments
  method: 'In-person' | 'Zoom' | 'Phone' | 'Teams' | 'Email' | 'Document' | 'Other';
  subject: string;
  notes: string;
  assignedTo: string; // Assignment owner or assigned user ID
  attachments?: string[]; // file URLs or references
  followUpNeeded: boolean;
  status: AssignmentActivityStatus;
  completedAt?: Timestamp;
  followUpDate?: Timestamp;
  followUpSubject?: string;
  priority?: 'High' | 'Medium' | 'Low';
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export interface Assignment {
  taskId: string;
  title: string;
  details?: string;
  status: 'todo' | 'in_progress' | 'done';
  dueDate?: Date;
  ownerId: string;
  oneDriveLink?: string;
  oneDriveTitle?: string;
  checklist: ChecklistItem[];
  progressLog: ProgressLogEntry[]; // Keep for backward compatibility
  activities: AssignmentActivity[]; // New activity tracking (similar to Opportunities)
  lastActivityDate?: Timestamp; // Track when last activity was added
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateAssignmentRequest {
  title: string;
  details?: string;
  status?: 'todo' | 'in_progress' | 'done';
  dueDate?: string; // ISO date string
  ownerId?: string;
  oneDriveLink?: string;
  oneDriveTitle?: string;
  checklist?: Omit<ChecklistItem, 'id' | 'completedAt'>[];
  progressLog?: Omit<ProgressLogEntry, 'id' | 'timestamp'>[];
}

export interface UpdateAssignmentRequest {
  taskId: string;
  title?: string;
  details?: string;
  status?: 'todo' | 'in_progress' | 'done';
  dueDate?: string; // ISO date string
  ownerId?: string;
  oneDriveLink?: string;
  oneDriveTitle?: string;
}

export interface AddChecklistItemRequest {
  taskId: string;
  text: string; // Changed from 'label' to 'text' to match Opportunity type
  completed?: boolean;
  dueDate?: string; // ISO date string
}

export interface UpdateChecklistItemRequest {
  taskId: string;
  itemId: string;
  text?: string; // Changed from 'label' to 'text' to match Opportunity type
  completed?: boolean;
  dueDate?: string; // ISO date string
}

export interface AddProgressLogEntryRequest {
  taskId: string;
  message: string;
}

export interface UpdateProgressLogEntryRequest {
  taskId: string;
  entryId: string;
  message: string;
}

export interface RemoveProgressLogEntryRequest {
  taskId: string;
  entryId: string;
}

export interface RemoveChecklistItemRequest {
  taskId: string;
  itemId: string;
}

// Activity management request interfaces
export interface AddAssignmentActivityRequest {
  taskId: string;
  activityType: 'Meeting' | 'Email' | 'Call' | 'WhatsApp' | 'Demo' | 'Workshop' | 'Review' | 'Update';
  dateTime: string; // ISO date string
  method: 'In-person' | 'Zoom' | 'Phone' | 'Teams' | 'Email' | 'Document' | 'Other';
  subject: string;
  notes: string;
  assignedTo: string;
  relatedContactIds?: string[];
  attachments?: string[];
  followUpNeeded: boolean;
  status: AssignmentActivityStatus;
  followUpDate?: string; // ISO date string
  followUpSubject?: string;
  priority?: 'High' | 'Medium' | 'Low';
}

export interface UpdateAssignmentActivityRequest {
  taskId: string;
  activityId: string;
  activityType?: 'Meeting' | 'Email' | 'Call' | 'WhatsApp' | 'Demo' | 'Workshop' | 'Review' | 'Update';
  dateTime?: string; // ISO date string
  method?: 'In-person' | 'Zoom' | 'Phone' | 'Teams' | 'Email' | 'Document' | 'Other';
  subject?: string;
  notes?: string;
  assignedTo?: string;
  relatedContactIds?: string[];
  attachments?: string[];
  followUpNeeded?: boolean;
  status?: AssignmentActivityStatus;
  completedAt?: string; // ISO date string
  followUpDate?: string; // ISO date string
  followUpSubject?: string;
  priority?: 'High' | 'Medium' | 'Low';
}

export interface RemoveAssignmentActivityRequest {
  taskId: string;
  activityId: string;
}

// Status options for easier use in components
export const ASSIGNMENT_STATUSES = [
  { value: 'todo', label: 'To Do', color: 'text-gray-600' },
  { value: 'in_progress', label: 'In Progress', color: 'text-blue-600' },
  { value: 'done', label: 'Done', color: 'text-green-600' },
] as const;

export type AssignmentStatus = typeof ASSIGNMENT_STATUSES[number]['value'];

// Activity options for assignments
export const ASSIGNMENT_ACTIVITY_TYPES = [
  'Meeting', 'Email', 'Call', 'WhatsApp', 'Demo', 'Workshop', 'Review', 'Update'
] as const;

export const ASSIGNMENT_ACTIVITY_METHODS = [
  'In-person', 'Zoom', 'Phone', 'Teams', 'Email', 'Document', 'Other'
] as const;

export const ASSIGNMENT_ACTIVITY_PRIORITIES = [
  'High', 'Medium', 'Low'
] as const;

export const ASSIGNMENT_ACTIVITY_STATUSES = [
  { value: 'Scheduled', label: 'Scheduled', color: 'text-blue-600' },
  { value: 'Completed', label: 'Completed', color: 'text-green-600' },
  { value: 'Cancelled', label: 'Cancelled', color: 'text-red-600' },
] as const; 