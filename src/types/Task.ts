import { Timestamp } from 'firebase/firestore';

export type TaskStatus = 'To do' | 'In progress' | 'Done';

export interface Task {
  id: string;
  title: string;
  opportunityId?: string;
  assignedTo: string;
  dueDate: Timestamp;
  status: TaskStatus;
  bucket?: string;
} 