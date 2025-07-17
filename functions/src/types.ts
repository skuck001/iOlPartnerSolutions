import { Timestamp } from 'firebase-admin/firestore';

// Re-export types needed for Cloud Functions
export type ContactType = 'Primary Contact' | 'Technical Contact' | 'Decision Maker' | 'Influencer' | 'Champion' | 'Other';

export interface Contact {
  id?: string;
  name: string;
  email: string;
  position?: string;
  phone?: string;
  accountId: string;
  contactType?: ContactType;
  region?: string;
  company?: string;
  department?: string;
  notes?: string;
  lastContactDate?: Timestamp | null;
  tags?: string[];
  productIds?: string[];
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ProductCategory = 'GDS' | 'PMS' | 'CRS' | 'API' | 'Middleware' | 'Other';
export type ProductSubcategory = 'Booking Engine' | 'Payment Gateway' | 'Property Management' | 'Channel Manager' | 'Rate Management' | 'Analytics' | 'Integration Platform' | 'API Gateway' | 'Other';

export interface Product {
  id?: string;
  name: string;
  accountId: string;
  category: ProductCategory;
  subcategory?: ProductSubcategory;
  description?: string;
  businessType?: string;
  status?: string;
  version?: string;
  features?: string[];
  integrations?: string[];
  documentation?: string;
  support?: string;
  pricing?: string;
  tags?: string[];
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type OpportunityStage = 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Closed-Won' | 'Closed-Lost';
export type OpportunityPriority = 'Low' | 'Medium' | 'High' | 'Critical';

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

export interface Opportunity {
  id?: string;
  title: string;
  description?: string;
  accountId: string;
  contactIds: string[];
  productId?: string;
  stage: OpportunityStage;
  priority?: OpportunityPriority;
  estimatedDealValue?: number;
  probability?: number;
  expectedCloseDate?: Timestamp;
  lastActivityDate?: Timestamp;
  region?: string;
  notes?: Note[];
  activities?: Activity[];
  documents?: Document[];
  tags?: string[];
  // AI Summary fields
  aiSummary?: string;
  aiSummaryGeneratedAt?: Timestamp;
  aiSummaryManuallyRequested?: boolean;
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
} 