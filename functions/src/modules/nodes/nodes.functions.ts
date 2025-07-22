import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { withErrorHandling } from '../../shared/errors';
import { authenticateUser } from '../../shared/auth.middleware';
import { RateLimiter, RateLimitPresets } from '../../shared/rateLimiter';
// Removed unused validateData import
import { NodesService } from './nodes.service';
import { CSVProcessingService } from './csv-processing.service';
import { DeduplicationService } from './deduplication.service';
import {
  CreateEntityRequest,
  UpdateEntityRequest,
  GetEntityRequest,
  DeleteEntityRequest,
  CreateNodeRequest,
  UpdateNodeRequest,
  GetNodeRequest,
  DeleteNodeRequest,
  SearchNodesRequest,
  CreateBatchRequest,
  ProcessBatchCSVRequest,
  GetStagingNodesRequest,
  AnalyzeDeduplicationRequest,
  ProcessDeduplicationDecisionsRequest,
  // GetBatchLogsRequest,
  UpdateBatchStatusRequest,
  RollbackBatchRequest
} from './nodes.types';

const db = getFirestore();

// Simple validation helper that just returns the data for now
// In a production system, you would implement proper Zod schemas
const validateInput = <T>(data: any, functionName: string): T => {
  if (!data) {
    throw new HttpsError('invalid-argument', `Request data is required for ${functionName}`);
  }
  return data as T;
};

// Entity CRUD Functions

export const createEntity = onCall(
  {
    enforceAppCheck: true,
    cors: true
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.write.maxRequests, 
        RateLimitPresets.write.windowMs, 
        'createEntity'
      );

      const validatedData = await validateInput<CreateEntityRequest>(
        request.data,
        'createEntity'
      );

      const nodesService = new NodesService();
      const result = await nodesService.createEntity(validatedData, user.uid);

      return result;
    }, {
      functionName: 'createEntity',
      action: 'create'
    });
  }
);

export const getEntities = onCall(
  {
    enforceAppCheck: true,
    cors: true
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.read.maxRequests, 
        RateLimitPresets.read.windowMs, 
        'getEntities'
      );

      const nodesService = new NodesService();
      const result = await nodesService.getEntitiesByOwner(user.uid);

      return result;
    }, {
      functionName: 'getEntities',
      action: 'read'
    });
  }
);

export const getEntity = onCall(
  {
    enforceAppCheck: true,
    cors: true
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.read.maxRequests, 
        RateLimitPresets.read.windowMs, 
        'getEntity'
      );

      const validatedData = await validateInput<GetEntityRequest>(
        request.data,
        'getEntity'
      );

      const nodesService = new NodesService();
      const result = await nodesService.getEntity(validatedData.entity_id);

      if (!result) {
        throw new HttpsError('not-found', 'Entity not found');
      }

      return result;
    }, {
      functionName: 'getEntity',
      action: 'read'
    });
  }
);

export const updateEntity = onCall(
  {
    enforceAppCheck: true,
    cors: true
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.write.maxRequests, 
        RateLimitPresets.write.windowMs, 
        'updateEntity'
      );

      const validatedData = await validateInput<UpdateEntityRequest>(
        request.data,
        'updateEntity'
      );

      const nodesService = new NodesService();
      const result = await nodesService.updateEntity(
        validatedData.entity_id,
        validatedData.updates,
        user.uid
      );

      return result;
    }, {
      functionName: 'updateEntity',
      action: 'update'
    });
  }
);

export const deleteEntity = onCall(
  {
    enforceAppCheck: true,
    cors: true
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.write.maxRequests, 
        RateLimitPresets.write.windowMs, 
        'deleteEntity'
      );

      const validatedData = await validateInput<DeleteEntityRequest>(
        request.data,
        'deleteEntity'
      );

      const nodesService = new NodesService();
      await nodesService.deleteEntity(validatedData.entity_id, user.uid);

      return { success: true };
    }, {
      functionName: 'deleteEntity',
      action: 'delete'
    });
  }
);

// Node CRUD Functions

export const createNode = onCall(
  {
    enforceAppCheck: true,
    cors: true
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.write.maxRequests, 
        RateLimitPresets.write.windowMs, 
        'createNode'
      );

      const validatedData = await validateInput<CreateNodeRequest>(
        request.data,
        'createNode'
      );

      const nodesService = new NodesService();
      const result = await nodesService.createNode(validatedData, user.uid);

      return result;
    }, {
      functionName: 'createNode',
      action: 'create'
    });
  }
);

export const getNodes = onCall(
  {
    enforceAppCheck: true,
    cors: true
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.read.maxRequests, 
        RateLimitPresets.read.windowMs, 
        'getNodes'
      );

      const nodesService = new NodesService();
      const result = await nodesService.getNodesByOwner(user.uid);

      return result;
    }, {
      functionName: 'getNodes',
      action: 'read'
    });
  }
);

export const getNode = onCall(
  {
    enforceAppCheck: true,
    cors: true
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.read.maxRequests, 
        RateLimitPresets.read.windowMs, 
        'getNode'
      );

      const validatedData = await validateInput<GetNodeRequest>(
        request.data,
        'getNode'
      );

      const nodesService = new NodesService();
      const result = await nodesService.getNode(validatedData.node_id);

      if (!result) {
        throw new HttpsError('not-found', 'Node not found');
      }

      return result;
    }, {
      functionName: 'getNode',
      action: 'read'
    });
  }
);

export const updateNode = onCall(
  {
    enforceAppCheck: true,
    cors: true
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.write.maxRequests, 
        RateLimitPresets.write.windowMs, 
        'updateNode'
      );

      const validatedData = await validateInput<UpdateNodeRequest>(
        request.data,
        'updateNode'
      );

      const nodesService = new NodesService();
      const result = await nodesService.updateNode(
        validatedData.node_id,
        validatedData.updates,
        user.uid
      );

      return result;
    }, {
      functionName: 'updateNode',
      action: 'update'
    });
  }
);

export const deleteNode = onCall(
  {
    enforceAppCheck: true,
    cors: true
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.write.maxRequests, 
        RateLimitPresets.write.windowMs, 
        'deleteNode'
      );

      const validatedData = await validateInput<DeleteNodeRequest>(
        request.data,
        'deleteNode'
      );

      const nodesService = new NodesService();
      await nodesService.deleteNode(validatedData.node_id, user.uid);

      return { success: true };
    }, {
      functionName: 'deleteNode',
      action: 'delete'
    });
  }
);

// Search and Query Functions

export const searchNodes = onCall(
  {
    enforceAppCheck: true,
    cors: true
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.read.maxRequests, 
        RateLimitPresets.read.windowMs, 
        'searchNodes'
      );

      const validatedData = await validateInput<SearchNodesRequest>(
        request.data,
        'searchNodes'
      );

      const nodesService = new NodesService();
      const result = await nodesService.searchNodes(validatedData, user.uid);

      return result;
    }, {
      functionName: 'searchNodes',
      action: 'read'
    });
  }
);

// Batch Processing Functions

export const createBatch = onCall(
  {
    enforceAppCheck: true,
    cors: true
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.write.maxRequests, 
        RateLimitPresets.write.windowMs, 
        'createBatch'
      );

      const validatedData = await validateInput<CreateBatchRequest>(
        request.data,
        'createBatch'
      );

      const nodesService = new NodesService();
      const batchData = {
        batch_name: validatedData.batch_name,
        source_type: validatedData.source_type || 'csv_upload'
      };
      const result = await nodesService.createBatchLog(batchData, user.uid);

      return result;
    }, {
      functionName: 'createBatch',
      action: 'create'
    });
  }
);

export const processBatchCSV = onCall(
  {
    enforceAppCheck: true,
    cors: true,
    timeoutSeconds: 540,
    memory: '1GiB'
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        5, // Lower limit for intensive operations
        300000, // 5 minute window
        'processBatchCSV'
      );

      const validatedData = await validateInput<ProcessBatchCSVRequest>(
        request.data,
        'processBatchCSV'
      );

      const csvService = new CSVProcessingService();
      const result = await csvService.processBatchUpload(
        validatedData.csv_content,
        validatedData.batch_name,
        user.uid
      );

      return result;
    }, {
      functionName: 'processBatchCSV',
      action: 'process'
    });
  }
);

export const getStagingNodes = onCall(
  {
    enforceAppCheck: true,
    cors: true
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.read.maxRequests, 
        RateLimitPresets.read.windowMs, 
        'getStagingNodes'
      );

      const validatedData = await validateInput<GetStagingNodesRequest>(
        request.data,
        'getStagingNodes'
      );

      const nodesService = new NodesService();
      const result = await nodesService.getStagingNodesByBatch(validatedData.batch_id, user.uid);

      return result;
    }, {
      functionName: 'getStagingNodes',
      action: 'read'
    });
  }
);

export const analyzeDeduplication = onCall(
  {
    enforceAppCheck: true,
    cors: true,
    timeoutSeconds: 300
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        10, // Moderate limit for analysis
        600000, // 10 minute window
        'analyzeDeduplication'
      );

      const validatedData = await validateInput<AnalyzeDeduplicationRequest>(
        request.data,
        'analyzeDeduplication'
      );

      // First get staging nodes for the batch
      const nodesService = new NodesService();
      const stagingNodes = await nodesService.getStagingNodesByBatch(validatedData.batch_id, user.uid);
      
      const deduplicationService = new DeduplicationService();
      const result = await deduplicationService.analyzeDeduplication(stagingNodes, user.uid);

      return result;
    }, {
      functionName: 'analyzeDeduplication',
      action: 'analyze'
    });
  }
);

export const processDeduplicationDecisions = onCall(
  {
    enforceAppCheck: true,
    cors: true,
    timeoutSeconds: 540
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        5, // Lower limit for intensive operations
        300000, // 5 minute window
        'processDeduplicationDecisions'
      );

      const validatedData = await validateInput<ProcessDeduplicationDecisionsRequest>(
        request.data,
        'processDeduplicationDecisions'
      );

      const deduplicationService = new DeduplicationService();
      const result = await deduplicationService.processDeduplicationDecisions(
        validatedData.decisions,
        user.uid
      );

      return result;
    }, {
      functionName: 'processDeduplicationDecisions',
      action: 'process'
    });
  }
);

// Batch Management Functions

export const getBatchLogs = onCall(
  {
    enforceAppCheck: true,
    cors: true
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.read.maxRequests, 
        RateLimitPresets.read.windowMs, 
        'getBatchLogs'
      );

      // Use direct database access instead of nodesService.db
      const snapshot = await db.collection('batch_logs')
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();

      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      return logs;
    }, {
      functionName: 'getBatchLogs',
      action: 'read'
    });
  }
);

export const updateBatchStatus = onCall(
  {
    enforceAppCheck: true,
    cors: true
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.write.maxRequests, 
        RateLimitPresets.write.windowMs, 
        'updateBatchStatus'
      );

      const validatedData = await validateInput<UpdateBatchStatusRequest>(
        request.data,
        'updateBatchStatus'
      );

      const nodesService = new NodesService();
      const updateData = {
        status: validatedData.status,
        processing_notes: validatedData.processing_notes,
        updatedAt: new Date()
      };
      await nodesService.updateBatchLog(validatedData.batch_id, updateData);

      return { success: true };
    }, {
      functionName: 'updateBatchStatus',
      action: 'update'
    });
  }
);

export const rollbackBatch = onCall(
  {
    enforceAppCheck: true,
    cors: true,
    timeoutSeconds: 540
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        2, // Very low limit for destructive operations
        600000, // 10 minute window
        'rollbackBatch'
      );

      const validatedData = await validateInput<RollbackBatchRequest>(
        request.data,
        'rollbackBatch'
      );

      // Basic rollback implementation - delete staging nodes and update batch status
      const batch = db.batch();
      
      // Delete staging nodes
      const stagingSnapshot = await db.collection('staging_nodes')
        .where('batch_id', '==', validatedData.batch_id)
        .get();

      stagingSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Update batch status
      batch.update(
        db.collection('batch_logs').doc(validatedData.batch_id),
        { 
          status: 'rolled_back',
          rollback_timestamp: new Date(),
          rollback_by: user.uid
        }
      );

      await batch.commit();

      return { 
        success: true, 
        staging_nodes_deleted: stagingSnapshot.docs.length
      };
    }, {
      functionName: 'rollbackBatch',
      action: 'rollback'
    });
  }
); 