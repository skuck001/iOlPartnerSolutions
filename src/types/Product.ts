export type ProductCategory = 
  | 'Business Intelligence' 
  | 'Revenue Management' 
  | 'Distribution' 
  | 'Guest Experience' 
  | 'Operations' 
  | 'Connectivity' 
  | 'Booking Engine' 
  | 'Channel Management'
  | 'Other';

export type ProductSubcategory = 
  | 'Rate Shopping Tools'
  | 'Competitive Intelligence'
  | 'Market Analytics'
  | 'Demand Forecasting'
  | 'Pricing Optimization'
  | 'Reservation Systems'
  | 'Property Management'
  | 'Guest Communication'
  | 'Loyalty Programs'
  | 'API Integration'
  | 'Data Connectivity'
  | 'Other';

// Firebase Timestamp-like interface
interface FirebaseTimestamp {
  toDate(): Date;
  toMillis(): number;
}

export interface Product {
  id: string;
  name: string;
  accountId: string;
  category: ProductCategory;
  subcategory: ProductSubcategory;
  description?: string;
  version?: string;
  status: 'Active' | 'Deprecated' | 'Development' | 'Beta';
  website?: string;
  contactIds: string[];
  tags: string[];
  targetMarket?: string;
  pricing?: string;
  notes?: string;
  ownerId: string;
  createdAt: FirebaseTimestamp;
  updatedAt?: FirebaseTimestamp;
}