import { Timestamp } from 'firebase-admin/firestore';

// Re-export types needed for Cloud Functions
export type ContactType = 'Primary' | 'Secondary' | 'Technical' | 'Billing' | 'Decision Maker' | 'Other';

export interface Contact {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  position?: string;
  department?: string;
  contactType?: ContactType;
  accountId: string;
  productIds?: string[];
  linkedIn?: string;
  timezone?: string;
  preferredContactMethod?: 'Email' | 'Phone' | 'LinkedIn' | 'Teams';
  isDecisionMaker?: boolean;
  lastContactDate?: Timestamp | null;
  notes?: string;
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ProductCategory = 'Business Intelligence' | 'Revenue Management' | 'Distribution' | 'Guest Experience' | 'Operations' | 'Connectivity' | 'Booking Engine' | 'Channel Management' | 'Other';
export type ProductSubcategory = 'Rate Shopping Tools' | 'Competitive Intelligence' | 'Market Analytics' | 'Demand Forecasting' | 'Pricing Optimization' | 'Reservation Systems' | 'Property Management' | 'Guest Communication' | 'Loyalty Programs' | 'API Integration' | 'Data Connectivity' | 'Other';

export interface Product {
  id?: string;
  name: string;
  accountId: string;
  category: ProductCategory;
  subcategory?: ProductSubcategory;
  description?: string;
  version?: string;
  status?: 'Active' | 'Deprecated' | 'Development' | 'Beta';
  website?: string;
  contactIds?: string[];
  tags?: string[];
  targetMarket?: string;
  pricing?: string;
  notes?: string;
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type OpportunityStage = 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Closed-Won' | 'Closed-Lost';
export type OpportunityPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export interface Note {
  id: string;
  content: string;
  author: string;
  createdAt: Timestamp;
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  dateTime: Timestamp;
  status: string;
  assignedTo?: string;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: Timestamp;
  uploadedBy: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

export type TaskStatus = 'To do' | 'In progress' | 'Done';

export interface Task {
  id?: string;
  title: string;
  opportunityId?: string;
  assignedTo: string;
  ownerId: string;
  dueDate: Timestamp;
  status: TaskStatus;
  bucket?: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface Opportunity {
  id?: string;
  title: string;
  summary?: string;
  accountId: string;
  productId?: string;
  contactIds: string[];
  stage: OpportunityStage;
  priority?: OpportunityPriority;
  useCase?: string;
  iolProducts?: string[];
  notes?: string;
  commercialModel?: string;
  potentialVolume?: number;
  estimatedDealValue?: number;
  expectedCloseDate?: Timestamp;
  lastActivityDate?: Timestamp;
  activities?: Activity[];
  tags?: string[];
  checklist?: ChecklistItem[];
  blockers?: ChecklistItem[];
  // AI Summary fields
  aiSummary?: string;
  aiSummaryGeneratedAt?: Timestamp;
  aiSummaryManuallyRequested?: boolean;
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
} 