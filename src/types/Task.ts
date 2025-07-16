import { Timestamp } from 'firebase/firestore';

export type TaskStatus = 'To do' | 'In progress' | 'Done';

export interface Task {
  id: string;
  title: string;
  opportunityId?: string;
  assignedTo: string; // Keep for backward compatibility
  ownerId: string; // User ID of the task owner (primary field going forward)
  dueDate: Timestamp;
  status: TaskStatus;
  bucket?: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
} 