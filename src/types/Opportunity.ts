import { Timestamp } from 'firebase/firestore';

export type OpportunityStage = 'Lead' | 'Qualified' | 'Proposal' | 'Negotiation' | 'Closed-Won' | 'Closed-Lost';
export type OpportunityPriority = 'Critical' | 'High' | 'Medium' | 'Low';

// Add activity status type
export type ActivityStatus = 'Scheduled' | 'Completed' | 'Cancelled';

export interface MeetingHistory {
  date: Timestamp;
  location?: string;
  summary: string;
}

export interface Activity {
  id: string;
  activityType: 'Meeting' | 'Email' | 'Call' | 'WhatsApp' | 'Demo' | 'Workshop';
  dateTime: Timestamp;
  relatedContactIds: string[]; // contact IDs involved
  method: 'In-person' | 'Zoom' | 'Phone' | 'Teams' | 'Email';
  subject: string;
  notes: string;
  assignedTo: string; // iOL owner/user ID
  attachments?: string[]; // file URLs or references
  followUpNeeded: boolean;
  // Enhanced fields for task replacement
  status: ActivityStatus; // New field to track activity status
  completedAt?: Timestamp; // When the activity was completed
  followUpDate?: Timestamp; // When follow-up is scheduled
  followUpSubject?: string; // Subject for follow-up activity
  priority?: 'High' | 'Medium' | 'Low'; // Priority for scheduled activities
  createdAt: Timestamp;
  createdBy: string; // user ID who created this activity
  updatedAt?: Timestamp; // Track when activity was last modified
  updatedBy?: string; // Who last updated the activity
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: Date; // Add due date support to match Assignments
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

export interface Opportunity {
  id: string;
  title: string;
  summary: string;
  accountId: string;
  productId?: string;
  contactIds: string[]; // Assigned contacts for this opportunity
  stage: OpportunityStage;
  priority: OpportunityPriority;
  useCase: string; // Legacy field - replaced by iolProducts
  iolProducts?: string[]; // New field for iOL product selection
  notes: string;
  
  // Commercial fields
  commercialModel: string; // e.g., "1% issuing fee", "rev share %"
  potentialVolume: number; // e.g., # of hotels, bookings/month
  estimatedDealValue: number; // currency value
  
  // Legacy field for backward compatibility
  contactsInvolved: string[];
  meetingHistory: MeetingHistory[];
  
  // Activity tracking
  activities: Activity[];
  
  tasks: string[];
  tags: string[];
  checklist?: ChecklistItem[]; // Optional for backward compatibility
  blockers?: ChecklistItem[]; // Blockers checklist - same structure as regular checklist
  
  // Timeline fields
  expectedCloseDate?: Timestamp;
  lastActivityDate?: Timestamp;
  
  // File management fields (to match Assignments)
  oneDriveLink?: string;
  oneDriveTitle?: string;
  
  // AI Summary fields
  aiSummary?: string;
  aiSummaryGeneratedAt?: Timestamp;
  aiSummaryManuallyRequested?: boolean; // Skip next auto-run if true
  
  ownerId: string; // User ID of the opportunity owner
  createdAt: Timestamp;
  updatedAt?: Timestamp;
} 