import { Timestamp } from 'firebase/firestore';

export type Industry = 'PMS' | 'CRS' | 'ChannelManager' | 'GDS' | 'Connectivity' | 'Business Intelligence' | 'Revenue Management' | 'Distribution' | 'Other';

export type CompanySize = 'Startup' | 'Small' | 'Medium' | 'Large' | 'Enterprise';

export interface Account {
  id: string;
  name: string;
  industry: Industry;
  region: string;
  website?: string;
  parentAccountId?: string;
  headquarters?: string;
  companySize?: CompanySize;
  description?: string;
  logo?: string;
  primaryContact?: string;
  status: 'Active' | 'Inactive' | 'Prospect' | 'Partner';
  tags: string[];
  notes?: string;
  ownerId: string; // User ID of the account owner
  createdAt: Timestamp;
  updatedAt?: Timestamp;
} 