import { Timestamp } from 'firebase/firestore';

export interface Account {
  id: string;
  name: string;
  region: string; // Now represents "Headoffice Country" 
  website?: string;
  parentAccountId?: string;
  headquarters?: string;
  description?: string;
  logo?: string;
  primaryContact?: string;
  tags: string[];
  notes?: string;
  ownerId: string; // User ID of the account owner
  createdAt: Timestamp;
  updatedAt?: Timestamp;
} 