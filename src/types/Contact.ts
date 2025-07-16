import { Timestamp } from 'firebase/firestore';

export type ContactType = 'Primary' | 'Secondary' | 'Technical' | 'Billing' | 'Decision Maker' | 'Other';

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  position?: string;
  department?: string;
  contactType: ContactType;
  accountId: string;
  productIds: string[]; // Multiple products per contact
  linkedIn?: string;
  timezone?: string;
  preferredContactMethod?: 'Email' | 'Phone' | 'LinkedIn' | 'Teams';
  isDecisionMaker?: boolean;
  lastContactDate?: Timestamp;
  notes?: string;
  ownerId: string; // User ID of the contact owner
  createdAt: Timestamp;
  updatedAt?: Timestamp;
} 