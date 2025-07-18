import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { validateData, ValidationError } from '../../shared/validation.middleware';
import { authenticateUser } from '../../shared/auth.middleware';
import { RateLimiter, RateLimitPresets } from '../../shared/rateLimiter';
import { OpportunitiesService, OpportunityFilters, OpportunitiesQueryOptions } from './opportunities.service';
import { z } from 'zod';

const db = getFirestore();
const opportunitiesService = new OpportunitiesService(db);

// Validation schemas
const OpportunityFiltersSchema = z.object({
  ownerId: z.string().optional(),
  accountId: z.string().optional(),
  productId: z.string().optional(),
  stage: z.enum(['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed-Won', 'Closed-Lost']).optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  search: z.string().optional(),
  contactId: z.string().optional(),
  minValue: z.number().optional(),
  maxValue: z.number().optional(),
  closeDateStart: z.date().optional(),
  closeDateEnd: z.date().optional()
});

const OpportunitiesQuerySchema = z.object({
  filters: OpportunityFiltersSchema.optional(),
  sortBy: z.enum(['title', 'stage', 'priority', 'estimatedDealValue', 'expectedCloseDate', 'lastActivityDate', 'createdAt', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional()
});

const CreateOpportunitySchema = z.object({
  title: z.string().min(1),
  accountId: z.string().min(1),
  stage: z.enum(['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed-Won', 'Closed-Lost']),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).nullish(),
  summary: z.string().nullish(),
  description: z.string().nullish(),
  estimatedDealValue: z.number().nullish(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.any().optional(), // Timestamp
  lastActivityDate: z.any().optional(), // Timestamp
  productId: z.string().nullish(),
  contactIds: z.array(z.string()),
  iolProducts: z.array(z.string()).optional(),
  notes: z.string().nullish(),
  activities: z.array(z.any()).optional(),
  documents: z.array(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  checklist: z.array(z.any()).optional(),
  blockers: z.array(z.any()).optional(),
  ownerId: z.string().min(1)
}).transform(data => {
  // Remove null, undefined, and empty string values to prevent Firestore errors
  const cleanData: any = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      cleanData[key] = value;
    }
  });
  return cleanData;
});

const UpdateOpportunitySchema = z.object({
  title: z.string().min(1).optional(),
  stage: z.enum(['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed-Won', 'Closed-Lost']).optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  summary: z.string().nullish(),
  description: z.string().nullish(),
  estimatedDealValue: z.number().nullish(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.any().optional(), // Timestamp
  lastActivityDate: z.any().optional(), // Timestamp
  productId: z.string().nullish(),
  contactIds: z.array(z.string()).optional(),
  iolProducts: z.array(z.string()).optional(),
  notes: z.string().nullish(),
  activities: z.array(z.any()).optional(),
  documents: z.array(z.any()).optional(),
  tags: z.array(z.string()).optional(),
  checklist: z.array(z.any()).optional(),
  blockers: z.array(z.any()).optional(),
  ownerId: z.string().optional()
}).transform(data => {
  // Remove null, undefined, and empty string values to prevent Firestore errors
  const cleanData: any = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      cleanData[key] = value;
    }
  });
  return cleanData;
});

const BulkUpdateOpportunitiesSchema = z.object({
  updates: z.array(z.object({
    id: z.string().min(1),
    data: UpdateOpportunitySchema
  })).min(1).max(50)
});

// Get opportunities with filtering and pagination
export const getOpportunities = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for read operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.read.maxRequests, RateLimitPresets.read.windowMs, 'getOpportunities');
      const validatedData = validateData(OpportunitiesQuerySchema, request.data);

      const options: OpportunitiesQueryOptions = {
        ...validatedData,
        filters: {
          ...validatedData.filters
          // Removed ownerId filter - allow access to all opportunities
        }
      };

      const result = await opportunitiesService.getOpportunities(options);
      
      return {
        success: true,
        data: result,
        resultCount: result.opportunities.length
      };
    } catch (error) {
      console.error('Error in getOpportunities:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to get opportunities');
    }
  }
);

// Get single opportunity
export const getOpportunity = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for read operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.read.maxRequests, RateLimitPresets.read.windowMs, 'getOpportunity');
      
      if (!request.data?.opportunityId) {
        throw new HttpsError('invalid-argument', 'Opportunity ID is required');
      }

      const opportunity = await opportunitiesService.getOpportunity(request.data.opportunityId);
      
      if (!opportunity) {
        throw new HttpsError('not-found', 'Opportunity not found');
      }

      // Removed ownership check - allow access to all opportunities

      return {
        success: true,
        data: opportunity
      };
    } catch (error) {
      console.error('Error in getOpportunity:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to get opportunity');
    }
  }
);

// Create new opportunity
export const createOpportunity = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'createOpportunity');
      const validatedData = validateData(CreateOpportunitySchema, request.data);

      const newOpportunity = await opportunitiesService.createOpportunity(validatedData, user.uid);

      return {
        success: true,
        data: newOpportunity
      };
    } catch (error) {
      console.error('Error in createOpportunity:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof ValidationError) {
        console.error('Validation errors:', error.errors);
        throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
      }
      if (error instanceof Error) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError('internal', 'Failed to create opportunity');
    }
  }
);

// Update opportunity
export const updateOpportunity = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'updateOpportunity');
      
      if (!request.data?.opportunityId) {
        throw new HttpsError('invalid-argument', 'Opportunity ID is required');
      }

      console.log('UpdateOpportunity - received data:', JSON.stringify(request.data.updates, null, 2));

      const validatedData = validateData(UpdateOpportunitySchema, request.data.updates);

      // Check if opportunity exists - removed ownership check
      const existingOpportunity = await opportunitiesService.getOpportunity(request.data.opportunityId);
      if (!existingOpportunity) {
        throw new HttpsError('not-found', 'Opportunity not found');
      }
      // Removed ownership check - allow updates to all opportunities

      const updatedOpportunity = await opportunitiesService.updateOpportunity(
        request.data.opportunityId,
        validatedData,
        user.uid
      );

      return {
        success: true,
        data: updatedOpportunity
      };
    } catch (error) {
      console.error('Error in updateOpportunity:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof ValidationError) {
        console.error('Validation errors:', error.errors);
        throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
      }
      if (error instanceof Error) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError('internal', 'Failed to update opportunity');
    }
  }
);

// Delete opportunity
export const deleteOpportunity = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'deleteOpportunity');
      
      if (!request.data?.opportunityId) {
        throw new HttpsError('invalid-argument', 'Opportunity ID is required');
      }

      // Check if opportunity exists - removed ownership check
      const existingOpportunity = await opportunitiesService.getOpportunity(request.data.opportunityId);
      if (!existingOpportunity) {
        throw new HttpsError('not-found', 'Opportunity not found');
      }
      // Removed ownership check - allow deletion of all opportunities

      await opportunitiesService.deleteOpportunity(request.data.opportunityId, user.uid);

      return {
        success: true,
        message: 'Opportunity deleted successfully'
      };
    } catch (error) {
      console.error('Error in deleteOpportunity:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError('internal', 'Failed to delete opportunity');
    }
  }
);

// Get opportunities statistics
export const getOpportunitiesStats = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for stats operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.stats.maxRequests, RateLimitPresets.stats.windowMs, 'getOpportunitiesStats');
      const validatedData = validateData(OpportunityFiltersSchema, request.data || {});

      const filters: OpportunityFilters = {
        ...validatedData
        // Removed ownerId filter - allow stats for all opportunities
      };

      const stats = await opportunitiesService.getOpportunitiesStats(filters);

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Error in getOpportunitiesStats:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to get opportunities statistics');
    }
  }
);

// Bulk update opportunities
export const bulkUpdateOpportunities = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for heavy operations (bulk updates)
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.heavy.maxRequests, RateLimitPresets.heavy.windowMs, 'bulkUpdateOpportunities');
      const validatedData = validateData(BulkUpdateOpportunitiesSchema, request.data);

      // Verify all opportunities exist - removed ownership verification
      for (const update of validatedData.updates) {
        const opportunity = await opportunitiesService.getOpportunity(update.id);
        if (!opportunity) {
          throw new HttpsError('not-found', `Opportunity not found: ${update.id}`);
        }
      }
      // Removed ownership checks - allow bulk updates to all opportunities

      const updatedOpportunities = await opportunitiesService.bulkUpdateOpportunities(
        validatedData.updates,
        user.uid
      );

      return {
        success: true,
        data: updatedOpportunities
      };
    } catch (error) {
      console.error('Error in bulkUpdateOpportunities:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError('internal', 'Failed to bulk update opportunities');
    }
  }
); 