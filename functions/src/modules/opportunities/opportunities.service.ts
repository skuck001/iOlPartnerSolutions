import { 
  Firestore, 
  Query,
  Timestamp 
} from 'firebase-admin/firestore';
import { Opportunity, OpportunityStage, OpportunityPriority } from '../../types';
import { AuditService } from '../../shared/audit.service';

export interface OpportunityFilters {
  ownerId?: string;
  accountId?: string;
  productId?: string;
  stage?: OpportunityStage;
  priority?: OpportunityPriority;
  search?: string;
  contactId?: string;
  minValue?: number;
  maxValue?: number;
  closeDateStart?: Date;
  closeDateEnd?: Date;
}

export interface OpportunitiesQueryOptions {
  filters?: OpportunityFilters;
  sortBy?: 'title' | 'stage' | 'priority' | 'estimatedDealValue' | 'expectedCloseDate' | 'lastActivityDate' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface OpportunitiesResponse {
  opportunities: Opportunity[];
  total: number;
  hasMore: boolean;
}

export interface OpportunityStats {
  total: number;
  byStage: Record<OpportunityStage, number>;
  byPriority: Record<OpportunityPriority, number>;
  totalValue: number;
  wonValue: number;
  pipelineValue: number;
  averageDealSize: number;
  conversionRate: number;
  closingThisMonth: number;
}

export class OpportunitiesService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  async getOpportunities(options: OpportunitiesQueryOptions = {}): Promise<OpportunitiesResponse> {
    const {
      filters = {},
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      limit = 50,
      offset = 0
    } = options;

    let query: Query = this.db.collection('opportunities');

    // Apply filters
    if (filters.ownerId) {
      query = query.where('ownerId', '==', filters.ownerId);
    }

    if (filters.accountId) {
      query = query.where('accountId', '==', filters.accountId);
    }

    if (filters.productId) {
      query = query.where('productId', '==', filters.productId);
    }

    if (filters.stage) {
      query = query.where('stage', '==', filters.stage);
    }

    if (filters.priority) {
      query = query.where('priority', '==', filters.priority);
    }

    if (filters.contactId) {
      query = query.where('contactIds', 'array-contains', filters.contactId);
    }

    // Apply sorting
    query = query.orderBy(sortBy, sortOrder);

    // Apply pagination
    if (offset > 0) {
      const offsetSnapshot = await query.limit(offset).get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    query = query.limit(limit + 1); // Get one extra to check if there are more

    const snapshot = await query.get();
    const opportunities = snapshot.docs.slice(0, limit).map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Opportunity[];

    // Apply client-side filters that require complex logic
    let filteredOpportunities = opportunities;

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredOpportunities = filteredOpportunities.filter(opp =>
        opp.title?.toLowerCase().includes(searchLower) ||
        opp.summary?.toLowerCase().includes(searchLower) ||
        opp.notes?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.minValue !== undefined) {
      filteredOpportunities = filteredOpportunities.filter(opp => 
        (opp.estimatedDealValue || 0) >= filters.minValue!
      );
    }

    if (filters.maxValue !== undefined) {
      filteredOpportunities = filteredOpportunities.filter(opp => 
        (opp.estimatedDealValue || 0) <= filters.maxValue!
      );
    }

    if (filters.closeDateStart) {
      filteredOpportunities = filteredOpportunities.filter(opp => 
        opp.expectedCloseDate && opp.expectedCloseDate.toDate() >= filters.closeDateStart!
      );
    }

    if (filters.closeDateEnd) {
      filteredOpportunities = filteredOpportunities.filter(opp => 
        opp.expectedCloseDate && opp.expectedCloseDate.toDate() <= filters.closeDateEnd!
      );
    }

    // Get total count for pagination
    const totalQuery = this.buildFilterQuery(filters);
    const totalSnapshot = await totalQuery.count().get();
    const total = totalSnapshot.data().count;

    return {
      opportunities: filteredOpportunities,
      total,
      hasMore: snapshot.docs.length > limit
    };
  }

  async getOpportunity(opportunityId: string): Promise<Opportunity | null> {
    const doc = await this.db.collection('opportunities').doc(opportunityId).get();
    
    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data()
    } as Opportunity;
  }

  async createOpportunity(opportunityData: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>, userId: string): Promise<Opportunity> {
    // Validate required fields
    if (!opportunityData.title) {
      throw new Error('Opportunity title is required');
    }

    if (!opportunityData.accountId) {
      throw new Error('Account ID is required');
    }

    if (!opportunityData.stage) {
      throw new Error('Opportunity stage is required');
    }

    const now = Timestamp.now();
    const opportunity: Omit<Opportunity, 'id'> = {
      ...opportunityData,
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
      stage: opportunityData.stage || 'Lead',
      priority: opportunityData.priority || 'Medium',
      // probability field removed
      contactIds: opportunityData.contactIds || [],
      notes: opportunityData.notes || '',
      activities: opportunityData.activities || [],
      // documents field removed
      tags: opportunityData.tags || []
    };

    const docRef = await this.db.collection('opportunities').add(opportunity);
    const newOpportunity = { id: docRef.id, ...opportunity } as Opportunity;

    // Audit log
    await AuditService.log({
      userId,
      action: 'create',
      resourceType: 'opportunity',
      resourceId: docRef.id,
      data: { 
        title: opportunity.title, 
        accountId: opportunity.accountId, 
        stage: opportunity.stage,
        value: opportunity.estimatedDealValue
      }
    });

    return newOpportunity;
  }

  async updateOpportunity(opportunityId: string, updates: Partial<Opportunity>, userId: string): Promise<Opportunity> {
    const opportunityRef = this.db.collection('opportunities').doc(opportunityId);
    const doc = await opportunityRef.get();

    if (!doc.exists) {
      throw new Error('Opportunity not found');
    }

    const existingOpportunity = doc.data() as Opportunity;

    // Update probability based on stage if stage is being updated
    const updateData = { ...updates };
    if (updates.stage && updates.stage !== existingOpportunity.stage) {
      // probability field removed
    }

    updateData.updatedAt = Timestamp.now();

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    await opportunityRef.update(updateData);

    const updatedOpportunity = {
      ...existingOpportunity,
      ...updateData,
      id: opportunityId
    } as Opportunity;

    // Audit log - temporarily disabled due to logging issues
    // await AuditService.log({
    //   userId,
    //   action: 'update',
    //   resourceType: 'opportunity',
    //   resourceId: opportunityId,
    //   data: { 
    //     title: updatedOpportunity.title,
    //     updatedFields: Object.keys(updates),
    //     newStage: updateData.stage
    //   }
    // });

    return updatedOpportunity;
  }

  async deleteOpportunity(opportunityId: string, userId: string): Promise<void> {
    const opportunityRef = this.db.collection('opportunities').doc(opportunityId);
    const doc = await opportunityRef.get();

    if (!doc.exists) {
      throw new Error('Opportunity not found');
    }

    const opportunity = doc.data() as Opportunity;

    await opportunityRef.delete();

    // Audit log
    await AuditService.log({
      userId,
      action: 'delete',
      resourceType: 'opportunity',
      resourceId: opportunityId,
      data: { 
        title: opportunity.title, 
        accountId: opportunity.accountId,
        stage: opportunity.stage,
        value: opportunity.estimatedDealValue
      }
    });
  }

  async getOpportunitiesStats(filters: OpportunityFilters = {}): Promise<OpportunityStats> {
    const query = this.buildFilterQuery(filters);
    const snapshot = await query.get();
    const opportunities = snapshot.docs.map(doc => doc.data()) as Opportunity[];

    const stats: OpportunityStats = {
      total: opportunities.length,
      byStage: {
        'Lead': 0,
        'Qualified': 0,
        'Proposal': 0,
        'Negotiation': 0,
        'Closed-Won': 0,
        'Closed-Lost': 0
      },
      byPriority: {
        'Low': 0,
        'Medium': 0,
        'High': 0,
        'Critical': 0
      },
      totalValue: 0,
      wonValue: 0,
      pipelineValue: 0,
      averageDealSize: 0,
      conversionRate: 0,
      closingThisMonth: 0
    };

    const currentMonth = new Date();
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    let totalOpportunities = 0;
    let wonOpportunities = 0;

    opportunities.forEach(opp => {
      totalOpportunities++;

      // Count by stage
      if (opp.stage) {
        stats.byStage[opp.stage]++;
      }

      // Count by priority
      if (opp.priority) {
        stats.byPriority[opp.priority]++;
      }

      const value = opp.estimatedDealValue || 0;
      stats.totalValue += value;

      // Calculate won value
      if (opp.stage === 'Closed-Won') {
        stats.wonValue += value;
        wonOpportunities++;
      }

      // Calculate pipeline value (not closed)
      if (opp.stage !== 'Closed-Won' && opp.stage !== 'Closed-Lost') {
        stats.pipelineValue += value;
      }

      // Count closing this month
      if (opp.expectedCloseDate && 
          opp.expectedCloseDate.toDate() >= currentMonth && 
          opp.expectedCloseDate.toDate() < nextMonth &&
          opp.stage !== 'Closed-Won' && 
          opp.stage !== 'Closed-Lost') {
        stats.closingThisMonth++;
      }
    });

    // Calculate metrics
    stats.averageDealSize = totalOpportunities > 0 ? stats.totalValue / totalOpportunities : 0;
    stats.conversionRate = totalOpportunities > 0 ? (wonOpportunities / totalOpportunities) * 100 : 0;

    return stats;
  }

  async bulkUpdateOpportunities(updates: Array<{ id: string; data: Partial<Opportunity> }>, userId: string): Promise<Opportunity[]> {
    const batch = this.db.batch();
    const updatedOpportunities: Opportunity[] = [];

    for (const update of updates) {
      const opportunityRef = this.db.collection('opportunities').doc(update.id);
      const doc = await opportunityRef.get();

      if (!doc.exists) {
        continue;
      }

      const existingOpportunity = doc.data() as Opportunity;
      const updateData = {
        ...update.data,
        updatedAt: Timestamp.now()
      };

      // Update probability based on stage if stage is being updated
      if (update.data.stage && update.data.stage !== existingOpportunity.stage) {
        // probability field removed
      }

      batch.update(opportunityRef, updateData);

      updatedOpportunities.push({
        ...existingOpportunity,
        ...updateData,
        id: update.id
      } as Opportunity);
    }

    await batch.commit();

    // Audit log
    await AuditService.log({
      userId,
      action: 'bulk_update',
      resourceType: 'opportunity',
      resourceId: 'multiple',
      data: { count: updates.length }
    });

    return updatedOpportunities;
  }

  // Commented out since probability field was removed
  // private getDefaultProbability(stage: OpportunityStage): number {
  //   const probabilities: Record<OpportunityStage, number> = {
  //     'Lead': 10,
  //     'Qualified': 25,
  //     'Proposal': 50,
  //     'Negotiation': 75,
  //     'Closed-Won': 100,
  //     'Closed-Lost': 0
  //   };
  //   return probabilities[stage] || 25;
  // }

  private buildFilterQuery(filters: OpportunityFilters): Query {
    let query: Query = this.db.collection('opportunities');

    if (filters.ownerId) {
      query = query.where('ownerId', '==', filters.ownerId);
    }

    if (filters.accountId) {
      query = query.where('accountId', '==', filters.accountId);
    }

    if (filters.productId) {
      query = query.where('productId', '==', filters.productId);
    }

    if (filters.stage) {
      query = query.where('stage', '==', filters.stage);
    }

    if (filters.priority) {
      query = query.where('priority', '==', filters.priority);
    }

    if (filters.contactId) {
      query = query.where('contactIds', 'array-contains', filters.contactId);
    }

    return query;
  }
} 