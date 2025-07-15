import { Timestamp } from 'firebase/firestore';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  role?: string;
  permissions?: string[];
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
} 