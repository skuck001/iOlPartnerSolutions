import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { AuditService } from '../../shared/audit.service';

export class NodesService {
  private db = getFirestore();
  private nodesCollection = this.db.collection('nodes');
  private entitiesCollection = this.db.collection('entities');
  private stagingNodesCollection = this.db.collection('staging_nodes');
  private batchLogsCollection = this.db.collection('batch_logs');
  // Removed auditService instance

  // Entity Methods
  async createEntity(data: any, userId: string): Promise<any> {
    const docRef = this.entitiesCollection.doc();
    const entityData = {
      entity_id: docRef.id,
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ownerId: userId,
    };

    await docRef.set(entityData);

    await AuditService.log({
      action: 'ENTITY_CREATE',
      userId,
      resourceType: 'entity',
      resourceId: docRef.id,
      data: { action: 'Entity created', entityData }
    });

    return entityData;
  }

  async getEntity(id: string): Promise<any | null> {
    const doc = await this.entitiesCollection.doc(id).get();
    return doc.exists ? doc.data() : null;
  }

  async updateEntity(id: string, updateData: any, userId: string): Promise<any> {
    const docRef = this.entitiesCollection.doc(id);
    const updatedData = {
      ...updateData,
      updatedAt: Timestamp.now(),
    };

    await docRef.update(updatedData);

    await AuditService.log({
      action: 'ENTITY_UPDATE',
      userId,
      resourceType: 'entity',
      resourceId: id,
      data: { action: 'Entity updated', updatedFields: Object.keys(updateData) }
    });

    const updated = await docRef.get();
    return updated.data();
  }

  async deleteEntity(id: string, userId: string): Promise<void> {
    // Check if entity has associated nodes
    const nodesSnapshot = await this.nodesCollection
      .where('entity_id', '==', id)
      .get();

    if (!nodesSnapshot.empty) {
      throw new Error('Cannot delete entity with associated nodes');
    }

    await this.entitiesCollection.doc(id).delete();

    await AuditService.log({
      action: 'ENTITY_DELETE',
      userId,
      resourceType: 'entity',
      resourceId: id,
      data: { action: 'Entity deleted' }
    });
  }

  async getEntitiesByOwner(ownerId: string): Promise<any[]> {
    const snapshot = await this.entitiesCollection
      .where('ownerId', '==', ownerId)
      .orderBy('master_entity_name', 'asc')
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  // Node Methods
  async createNode(data: any, userId: string): Promise<any> {
    const docRef = this.nodesCollection.doc();
    
    // Generate human-readable node_id from entity_name + category
    const nodeId = this.generateNodeId(data.entity_name, data.node_category, docRef.id);
    
    const nodeData = {
      node_id: nodeId,
      ...data,
      last_verified: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ownerId: userId,
      is_active: data.is_active ?? true,
      connects_to: data.connects_to || [],
      protocols_supported: data.protocols_supported || [],
      data_types_supported: data.data_types_supported || [],
      node_aliases: data.node_aliases || [],
      notes: data.notes || '',
    };

    await docRef.set(nodeData);

    await AuditService.log({
      action: 'NODE_CREATE',
      userId,
      resourceType: 'node',
      resourceId: docRef.id,
      data: { action: 'Node created', nodeData }
    });

    return nodeData;
  }

  async getNode(id: string): Promise<any | null> {
    const doc = await this.nodesCollection.doc(id).get();
    return doc.exists ? doc.data() : null;
  }

  async updateNode(id: string, updateData: any, userId: string): Promise<any> {
    const docRef = this.nodesCollection.doc(id);
    const updatedData = {
      ...updateData,
      updatedAt: Timestamp.now(),
    };

    await docRef.update(updatedData);

    await AuditService.log({
      action: 'NODE_UPDATE',
      userId,
      resourceType: 'node',
      resourceId: id,
      data: { action: 'Node updated', updatedFields: Object.keys(updateData) }
    });

    const updated = await docRef.get();
    return updated.data();
  }

  async deleteNode(id: string, userId: string): Promise<void> {
    await this.nodesCollection.doc(id).delete();

    await AuditService.log({
      action: 'NODE_DELETE',
      userId,
      resourceType: 'node',
      resourceId: id,
      data: { action: 'Node deleted' }
    });
  }

  async getNodesByOwner(ownerId: string): Promise<any[]> {
    const snapshot = await this.nodesCollection
      .where('ownerId', '==', ownerId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  async getNodesByEntity(entityId: string, ownerId: string): Promise<any[]> {
    const snapshot = await this.nodesCollection
      .where('entity_id', '==', entityId)
      .where('ownerId', '==', ownerId)
      .orderBy('node_name', 'asc')
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  // Search and filtering methods
  async searchNodes(filters: any, ownerId: string): Promise<any[]> {
    let query = this.nodesCollection.where('ownerId', '==', ownerId);

    if (filters.node_category?.length) {
      query = query.where('node_category', 'in', filters.node_category);
    }

    if (filters.direction?.length) {
      query = query.where('direction', 'in', filters.direction);
    }

    if (filters.is_active !== undefined) {
      query = query.where('is_active', '==', filters.is_active);
    }

    const snapshot = await query.get();
    let results = snapshot.docs.map(doc => doc.data());

    // Apply additional filters that can't be done in Firestore
    if (filters.search_text) {
      const searchTerm = filters.search_text.toLowerCase();
      results = results.filter(node => 
        node.node_name.toLowerCase().includes(searchTerm) ||
        node.entity_name.toLowerCase().includes(searchTerm) ||
        node.notes.toLowerCase().includes(searchTerm)
      );
    }

    if (filters.protocols_supported?.length) {
      results = results.filter(node =>
        filters.protocols_supported.some((protocol: string) =>
          node.protocols_supported.includes(protocol)
        )
      );
    }

    if (filters.data_types_supported?.length) {
      results = results.filter(node =>
        filters.data_types_supported.some((dataType: string) =>
          node.data_types_supported.includes(dataType)
        )
      );
    }

    return results;
  }

  // Batch processing methods
  async createBatchLog(batchData: any, userId: string): Promise<string> {
    const docRef = this.batchLogsCollection.doc();
    const batchId = docRef.id;
    
    const logData = {
      batch_id: batchId,
      created_by: userId,
      status: 'pending',
      total_records: 0,
      processed_records: 0,
      error_records: 0,
      createdAt: Timestamp.now(),
      ownerId: userId,
      ...batchData,
    };

    await docRef.set(logData);
    return batchId;
  }

  async updateBatchLog(batchId: string, updateData: any): Promise<void> {
    await this.batchLogsCollection.doc(batchId).update({
      ...updateData,
      updatedAt: Timestamp.now(),
    });
  }

  async createStagingNode(data: any, userId: string): Promise<any> {
    const docRef = this.stagingNodesCollection.doc();
    const stagingData = {
      id: docRef.id,
      ...data,
      status: 'pending',
      createdAt: Timestamp.now(),
      ownerId: userId,
    };

    await docRef.set(stagingData);
    return stagingData;
  }

  async getStagingNodesByBatch(batchId: string, ownerId: string): Promise<any[]> {
    const snapshot = await this.stagingNodesCollection
      .where('batch_id', '==', batchId)
      .where('ownerId', '==', ownerId)
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  // Utility methods
  private generateNodeId(entityName: string, category: string, fallbackId: string): string {
    const cleanEntityName = entityName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanCategory = category.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `${cleanEntityName}_${cleanCategory}_${fallbackId.slice(-6)}`;
  }

  // Fuzzy matching for deduplication
  async findPotentialDuplicates(stagingNode: any, ownerId: string): Promise<any[]> {
    // Get all nodes for the owner
    const allNodes = await this.getNodesByOwner(ownerId);
    const allEntities = await this.getEntitiesByOwner(ownerId);

    // Basic duplicate detection - implement your matching logic here

    // Check for entity name matches first
    const entityMatches = allEntities.filter(entity => {
      const similarity = this.calculateStringSimilarity(
        stagingNode.entity_name.toLowerCase(),
        entity.master_entity_name.toLowerCase()
      );
      return similarity > 0.7; // 70% similarity threshold
    });

    // Check for node name matches
    const nodeMatches = allNodes.filter(node => {
      const nameSimilarity = this.calculateStringSimilarity(
        stagingNode.node_name.toLowerCase(),
        node.node_name.toLowerCase()
      );
      const entitySimilarity = this.calculateStringSimilarity(
        stagingNode.entity_name.toLowerCase(),
        node.entity_name.toLowerCase()
      );
      
      return nameSimilarity > 0.7 || entitySimilarity > 0.8;
    });

    return [...entityMatches, ...nodeMatches];
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    const distance = matrix[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - distance / maxLength;
  }

  // Bulk operations
  async bulkNodeUpdate(updates: any[], userId: string): Promise<any[]> {
    const batch = this.db.batch();
    const results: any[] = [];

    for (const update of updates) {
      const { node_id, ...updateData } = update;
      const docRef = this.nodesCollection.doc(node_id);
      
      const updatedData = {
        ...updateData,
        updatedAt: Timestamp.now(),
      };

      batch.update(docRef, updatedData);
      results.push({ node_id, ...updatedData });
    }

    await batch.commit();

    await AuditService.log({
      action: 'NODE_BULK_UPDATE',
      userId,
      resourceType: 'node',
      resourceId: 'multiple',
      data: {
        action: 'Bulk node update',
        count: updates.length
      }
    });

    return results;
  }
} 