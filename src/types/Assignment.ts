import { Timestamp } from 'firebase/firestore';

export interface ChecklistItem {
  id: string;
  label: string;
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

export interface Assignment {
  taskId: string;
  title: string;
  details?: string;
  status: 'todo' | 'in_progress' | 'done';
  dueDate?: Date;
  ownerId: string;
  oneDriveLink?: string;
  checklist: ChecklistItem[];
  progressLog: ProgressLogEntry[];
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
}

export interface AddChecklistItemRequest {
  taskId: string;
  label: string;
  completed?: boolean;
  dueDate?: string; // ISO date string
}

export interface UpdateChecklistItemRequest {
  taskId: string;
  itemId: string;
  label?: string;
  completed?: boolean;
  dueDate?: string; // ISO date string
}

export interface AddProgressLogEntryRequest {
  taskId: string;
  message: string;
}

export interface RemoveChecklistItemRequest {
  taskId: string;
  itemId: string;
}

// Status options for easier use in components
export const ASSIGNMENT_STATUSES = [
  { value: 'todo', label: 'To Do', color: 'text-gray-600' },
  { value: 'in_progress', label: 'In Progress', color: 'text-blue-600' },
  { value: 'done', label: 'Done', color: 'text-green-600' },
] as const;

export type AssignmentStatus = typeof ASSIGNMENT_STATUSES[number]['value']; 