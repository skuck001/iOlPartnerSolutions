import { Timestamp } from 'firebase/firestore';

// Static Enums as defined in Node Brief
export enum NodeCategory {
  PMS = 'PMS', // Property Management System
  CRS = 'CRS', // Central Reservation System
  CM = 'CM', // Channel Manager
  BookingEngine = 'BookingEngine', // B2C booking interface
  RMS = 'RMS', // Revenue Management System
  Switch = 'Switch', // Connectivity hub (e.g., Juniper)
  Aggregator = 'Aggregator', // Consolidates inventory from multiple suppliers
  Distributor = 'Distributor', // Redistributes inventory to third parties
  Meta = 'Meta', // Metasearch engine
  OTA = 'OTA', // Online Travel Agency
  Wholesaler = 'Wholesaler', // B2B buyer/seller
  CMS = 'CMS', // Content system
  Enrichment = 'Enrichment', // Review, rate shopping, content enrichment
  PaymentGateway = 'PaymentGateway', // Payment and VCC systems
  Other = 'Other' // Custom or undefined
}

export enum Direction {
  Supply = 'Supply', // Originates ARI or content
  Demand = 'Demand', // Receives inventory and makes bookings
  SupplySwitch = 'Supply Switch', // Pure connector
  DemandSwitch = 'Demand Switch', // Pure connector
  None = 'None' // Internal use only (e.g., analytics tool)
}

export enum ProtocolSupported {
  PushAPI = 'PushAPI',
  PullAPI = 'PullAPI',
  LiveSearch = 'LiveSearch',
  Other = 'Other'
}

export enum DataTypeSupported {
  Availability = 'Availability',
  Rates = 'Rates',
  Restrictions = 'Restrictions',
  Bookings = 'Bookings',
  Content = 'Content',
  Policies = 'Policies',
  PaymentDetails = 'PaymentDetails',
  Analytics = 'Analytics'
}

// Entity interface (companies/providers)
export interface Entity {
  entity_id: string;
  master_entity_name: string;
  alternate_names: string[];
  website: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  ownerId: string;
}

// Node interface (specific systems/products)
export interface Node {
  node_id: string;
  node_name: string;
  entity_id: string;
  entity_name: string;
  node_category: NodeCategory;
  direction: Direction;
  connects_to: string[];
  protocols_supported: ProtocolSupported[];
  data_types_supported: DataTypeSupported[];
  is_active: boolean;
  last_verified: Timestamp;
  notes: string;
  node_aliases: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  ownerId: string;
}

// Staging table for batch uploads
export interface StagingNode {
  id: string;
  batch_id: string;
  node_name: string;
  website: string;
  entity_name: string;
  node_category: NodeCategory;
  direction: Direction;
  notes: string;
  connect_targets: string[];
  protocols_supported: ProtocolSupported[];
  data_types_supported: DataTypeSupported[];
  confidence_score?: number;
  duplicate_matches?: string[];
  status: 'pending' | 'reviewed' | 'approved' | 'rejected' | 'merged';
  createdAt: Timestamp;
  ownerId: string;
}

// Batch processing log
export interface BatchLog {
  batch_id: string;
  created_by: string;
  status: 'pending' | 'processed' | 'error' | 'cancelled';
  total_records: number;
  processed_records: number;
  error_records: number;
  error_report?: any;
  createdAt: Timestamp;
  completedAt?: Timestamp;
  ownerId: string;
}

// Request/Response interfaces for API
export interface CreateEntityRequest {
  master_entity_name: string;
  alternate_names?: string[];
  website: string;
}

export interface UpdateEntityRequest {
  entity_id: string;
  master_entity_name?: string;
  alternate_names?: string[];
  website?: string;
}

export interface CreateNodeRequest {
  node_name: string;
  entity_id: string;
  entity_name: string;
  node_category: NodeCategory;
  direction: Direction;
  connects_to?: string[];
  protocols_supported?: ProtocolSupported[];
  data_types_supported?: DataTypeSupported[];
  is_active?: boolean;
  notes?: string;
  node_aliases?: string[];
}

export interface UpdateNodeRequest {
  node_id: string;
  node_name?: string;
  entity_id?: string;
  entity_name?: string;
  node_category?: NodeCategory;
  direction?: Direction;
  connects_to?: string[];
  protocols_supported?: ProtocolSupported[];
  data_types_supported?: DataTypeSupported[];
  is_active?: boolean;
  notes?: string;
  node_aliases?: string[];
}

export interface BatchUploadRequest {
  csv_data: string;
  batch_name?: string;
}

export interface StagingNodeReview {
  staging_id: string;
  action: 'approve' | 'reject' | 'merge';
  merge_with_node_id?: string;
  updated_data?: Partial<CreateNodeRequest>;
}

// Utility types for frontend components
export interface NodeWithEntity extends Node {
  entity: Entity;
}

export interface DuplicateMatch {
  staging_node: StagingNode;
  potential_matches: Node[];
  confidence_scores: number[];
}

// Chart/visualization data types
export interface NetworkMapData {
  nodes: Array<{
    id: string;
    label: string;
    category: NodeCategory;
    direction: Direction;
    size?: number;
    color?: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    label?: string;
  }>;
}

// Search and filter types
export interface NodeSearchFilters {
  entity_name?: string;
  node_category?: NodeCategory[];
  direction?: Direction[];
  protocols_supported?: ProtocolSupported[];
  data_types_supported?: DataTypeSupported[];
  is_active?: boolean;
  search_text?: string;
} 