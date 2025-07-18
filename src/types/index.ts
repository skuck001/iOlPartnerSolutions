// Account types (Industry and CompanySize removed)
export type { Account } from './Account';
export type { ContactType } from './Contact';
export type { Contact } from './Contact';
export type { ProductCategory, ProductSubcategory } from './Product';
export type { Product } from './Product';
export type { Opportunity, OpportunityStage, OpportunityPriority, MeetingHistory, Activity, ActivityStatus, ChecklistItem } from './Opportunity';
export type { Task, TaskStatus } from './Task';
export type { User } from './User';
export type { 
  Assignment, 
  AssignmentStatus, 
  ChecklistItem as AssignmentChecklistItem, 
  ProgressLogEntry, 
  CreateAssignmentRequest, 
  UpdateAssignmentRequest,
  AddChecklistItemRequest,
  UpdateChecklistItemRequest,
  AddProgressLogEntryRequest,
  RemoveChecklistItemRequest
} from './Assignment'; 