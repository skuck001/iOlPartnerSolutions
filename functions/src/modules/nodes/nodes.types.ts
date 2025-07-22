// Request/Response type definitions for the nodes module

// Entity types
export interface CreateEntityRequest {
  master_entity_name: string;
  alternate_names?: string[];
  website: string;
}

export interface UpdateEntityRequest {
  entity_id: string;
  updates: {
    master_entity_name?: string;
    alternate_names?: string[];
    website?: string;
  };
}

export interface GetEntityRequest {
  entity_id: string;
}

export interface DeleteEntityRequest {
  entity_id: string;
}

// Node types
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
  updates: {
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
  };
}

export interface GetNodeRequest {
  node_id: string;
}

export interface DeleteNodeRequest {
  node_id: string;
}

// Search types
export interface SearchNodesRequest {
  entity_name?: string;
  node_category?: NodeCategory[];
  direction?: Direction[];
  protocols_supported?: ProtocolSupported[];
  data_types_supported?: DataTypeSupported[];
  is_active?: boolean;
  search_text?: string;
}

// Batch processing types
export interface CreateBatchRequest {
  batch_name: string;
  source_type?: string;
}

export interface ProcessBatchCSVRequest {
  csv_content: string;
  batch_name: string;
}

export interface GetStagingNodesRequest {
  batch_id: string;
}

export interface AnalyzeDeduplicationRequest {
  batch_id: string;
}

export interface ProcessDeduplicationDecisionsRequest {
  decisions: DeduplicationDecision[];
}

export interface GetBatchLogsRequest {
  limit?: number;
}

export interface UpdateBatchStatusRequest {
  batch_id: string;
  status: BatchStatus;
  processing_notes?: string;
}

export interface RollbackBatchRequest {
  batch_id: string;
}

// Deduplication types
export interface DeduplicationDecision {
  staging_id: string;
  action: 'approve_new' | 'merge_with_entity' | 'merge_with_node' | 'reject';
  target_id?: string;
  manual_edits?: any;
}

// Enum types
export type NodeCategory = 
  | 'PMS' 
  | 'CRS' 
  | 'CM' 
  | 'BookingEngine' 
  | 'RMS' 
  | 'Switch' 
  | 'Aggregator'
  | 'Distributor' 
  | 'Meta' 
  | 'OTA' 
  | 'Wholesaler' 
  | 'CMS' 
  | 'Enrichment'
  | 'PaymentGateway' 
  | 'Other';

export type Direction = 
  | 'Supply' 
  | 'Demand' 
  | 'Supply Switch' 
  | 'Demand Switch' 
  | 'None';

export type ProtocolSupported = 
  | 'PushAPI' 
  | 'PullAPI' 
  | 'LiveSearch' 
  | 'Other';

export type DataTypeSupported = 
  | 'Availability' 
  | 'Rates' 
  | 'Restrictions' 
  | 'Bookings' 
  | 'Content'
  | 'Policies' 
  | 'PaymentDetails' 
  | 'Analytics';

export type BatchStatus = 
  | 'pending' 
  | 'processed' 
  | 'error' 
  | 'cancelled' 
  | 'rolled_back'; 