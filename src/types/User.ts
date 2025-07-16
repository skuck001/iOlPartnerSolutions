import { Timestamp } from 'firebase/firestore';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  location?: string;
  bio?: string;
  avatar?: string;
  role?: string;
  permissions?: string[];
  timezone?: string;
  notifications?: {
    email: boolean;
    push: boolean;
    weekly: boolean;
  };
  
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  updatedAt?: Timestamp;
} 