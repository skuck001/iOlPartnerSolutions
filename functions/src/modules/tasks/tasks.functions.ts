import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { validateData, ValidationError } from '../../shared/validation.middleware';
import { authenticateUser } from '../../shared/auth.middleware';
import { RateLimiter, RateLimitPresets } from '../../shared/rateLimiter';
import { TasksService, TasksQueryOptions, ActivitiesQueryOptions } from './tasks.service';
import { z } from 'zod';

const db = getFirestore();
const tasksService = new TasksService(db);

// Validation schemas
const TaskFiltersSchema = z.object({
  ownerId: z.string().optional(),
  assignedTo: z.string().optional(),
  opportunityId: z.string().optional(),
  status: z.enum(['To do', 'In progress', 'Done']).optional(),
  bucket: z.string().optional(),
  dueDateStart: z.any().optional(), // Timestamp
  dueDateEnd: z.any().optional() // Timestamp
});

const TasksQuerySchema = z.object({
  filters: TaskFiltersSchema.optional(),
  sortBy: z.enum(['title', 'dueDate', 'status', 'createdAt', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional()
});

const CreateTaskSchema = z.object({
  title: z.string().min(1),
  opportunityId: z.string().nullish(),
  assignedTo: z.string().min(1),
  ownerId: z.string().min(1),
  dueDate: z.any(), // Timestamp
  status: z.enum(['To do', 'In progress', 'Done']).default('To do'),
  bucket: z.string().nullish(),
  description: z.string().nullish()
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

const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  opportunityId: z.string().optional(),
  assignedTo: z.string().optional(),
  ownerId: z.string().optional(),
  dueDate: z.any().optional(), // Timestamp
  status: z.enum(['To do', 'In progress', 'Done']).optional(),
  bucket: z.string().optional(),
  description: z.string().optional()
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

const ActivityFiltersSchema = z.object({
  assignedTo: z.string().optional(),
  status: z.enum(['Scheduled', 'Completed', 'Cancelled']).optional(),
  activityType: z.string().optional(),
  dateStart: z.any().optional(), // Timestamp
  dateEnd: z.any().optional() // Timestamp
});

const ActivitiesQuerySchema = z.object({
  filters: ActivityFiltersSchema.optional(),
  sortBy: z.enum(['dateTime', 'status', 'createdAt', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional()
});

const CreateActivitySchema = z.object({
  activityType: z.enum(['Meeting', 'Email', 'Call', 'WhatsApp', 'Demo', 'Workshop']),
  dateTime: z.any(), // Timestamp
  relatedContactIds: z.array(z.string()),
  method: z.enum(['In-person', 'Zoom', 'Phone', 'Teams', 'Email']),
  subject: z.string().min(1),
  notes: z.string(),
  assignedTo: z.string().min(1),
  attachments: z.array(z.string()).optional(),
  followUpNeeded: z.boolean(),
  status: z.enum(['Scheduled', 'Completed', 'Cancelled']),
  followUpDate: z.any().optional(), // Timestamp
  followUpSubject: z.string().optional(),
  priority: z.enum(['High', 'Medium', 'Low']).optional()
});

const UpdateActivitySchema = z.object({
  activityType: z.enum(['Meeting', 'Email', 'Call', 'WhatsApp', 'Demo', 'Workshop']).optional(),
  dateTime: z.any().optional(), // Timestamp
  relatedContactIds: z.array(z.string()).optional(),
  method: z.enum(['In-person', 'Zoom', 'Phone', 'Teams', 'Email']).optional(),
  subject: z.string().min(1).optional(),
  notes: z.string().optional(),
  assignedTo: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  followUpNeeded: z.boolean().optional(),
  status: z.enum(['Scheduled', 'Completed', 'Cancelled']).optional(),
  completedAt: z.any().optional(), // Timestamp
  followUpDate: z.any().optional(), // Timestamp
  followUpSubject: z.string().optional(),
  priority: z.enum(['High', 'Medium', 'Low']).optional()
});

const UpdateChecklistItemSchema = z.object({
  text: z.string().optional(),
  completed: z.boolean().optional()
});

// ============================================================================
// STANDALONE TASKS CLOUD FUNCTIONS
// ============================================================================

export const getTasks = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for read operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.read.maxRequests, RateLimitPresets.read.windowMs, 'getTasks');
      
      const queryOptions = validateData(TasksQuerySchema, request.data || {}) as TasksQueryOptions;
    
    const result = await tasksService.getTasks(queryOptions);
    return { success: true, ...result };
  } catch (error) {
    console.error('Error getting tasks:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    if (error instanceof ValidationError) {
      console.error('Validation errors:', error.errors);
      throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
    }
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to get tasks');
  }
});

export const getTask = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for read operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.read.maxRequests, RateLimitPresets.read.windowMs, 'getTask');
    const { taskId } = request.data;
    
    if (!taskId) {
      throw new HttpsError('invalid-argument', 'Task ID is required');
    }
    
    const task = await tasksService.getTask(taskId);
    if (!task) {
      throw new HttpsError('not-found', 'Task not found');
    }
    
    return { success: true, task };
  } catch (error) {
    console.error('Error getting task:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    if (error instanceof ValidationError) {
      console.error('Validation errors:', error.errors);
      throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
    }
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to get task');
  }
});

export const createTask = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'createTask');
    const taskData = validateData(CreateTaskSchema, request.data);
    
    const task = await tasksService.createTask(taskData, user.uid);
    return { success: true, task };
  } catch (error) {
    console.error('Error creating task:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    if (error instanceof ValidationError) {
      console.error('Validation errors:', error.errors);
      throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
    }
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to create task');
  }
});

export const updateTask = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'updateTask');
    const { taskId, ...updateData } = request.data;
    
    if (!taskId) {
      throw new HttpsError('invalid-argument', 'Task ID is required');
    }
    
    const validatedData = validateData(UpdateTaskSchema, updateData);
    const task = await tasksService.updateTask(taskId, validatedData, user.uid);
    
    return { success: true, task };
  } catch (error) {
    console.error('Error updating task:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    if (error instanceof ValidationError) {
      console.error('Validation errors:', error.errors);
      throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
    }
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to update task');
  }
});

export const deleteTask = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'deleteTask');
    const { taskId } = request.data;
    
    if (!taskId) {
      throw new HttpsError('invalid-argument', 'Task ID is required');
    }
    
    await tasksService.deleteTask(taskId, user.uid);
    return { success: true };
  } catch (error) {
    console.error('Error deleting task:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to delete task');
  }
});

// ============================================================================
// ACTIVITY CLOUD FUNCTIONS (within opportunities)
// ============================================================================

export const getActivitiesByOpportunity = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for read operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.read.maxRequests, RateLimitPresets.read.windowMs, 'getActivitiesByOpportunity');
    const { opportunityId, ...queryOptions } = request.data;
    
    if (!opportunityId) {
      throw new HttpsError('invalid-argument', 'Opportunity ID is required');
    }
    
    const validatedOptions = validateData(ActivitiesQuerySchema, queryOptions || {}) as ActivitiesQueryOptions;
    const activities = await tasksService.getActivitiesByOpportunity(opportunityId, validatedOptions);
    
    return { success: true, activities };
  } catch (error) {
    console.error('Error getting activities:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to get activities');
  }
});

export const addActivityToOpportunity = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'addActivityToOpportunity');
    const { opportunityId, ...activityData } = request.data;
    
    if (!opportunityId) {
      throw new HttpsError('invalid-argument', 'Opportunity ID is required');
    }
    
    const validatedData = validateData(CreateActivitySchema, activityData);
    const activity = await tasksService.addActivityToOpportunity(opportunityId, validatedData, user.uid);
    
    return { success: true, activity };
  } catch (error) {
    console.error('Error adding activity:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to add activity');
  }
});

export const updateActivityInOpportunity = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'updateActivityInOpportunity');
    const { opportunityId, activityId, ...updateData } = request.data;
    
    if (!opportunityId || !activityId) {
      throw new HttpsError('invalid-argument', 'Opportunity ID and Activity ID are required');
    }
    
    const validatedData = validateData(UpdateActivitySchema, updateData);
    const activity = await tasksService.updateActivityInOpportunity(opportunityId, activityId, validatedData, user.uid);
    
    return { success: true, activity };
  } catch (error) {
    console.error('Error updating activity:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to update activity');
  }
});

export const deleteActivityFromOpportunity = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'deleteActivityFromOpportunity');
    const { opportunityId, activityId } = request.data;
    
    if (!opportunityId || !activityId) {
      throw new HttpsError('invalid-argument', 'Opportunity ID and Activity ID are required');
    }
    
    await tasksService.deleteActivityFromOpportunity(opportunityId, activityId, user.uid);
    return { success: true };
  } catch (error) {
    console.error('Error deleting activity:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to delete activity');
  }
});

// ============================================================================
// CHECKLIST CLOUD FUNCTIONS (within opportunities)
// ============================================================================

export const getChecklistByOpportunity = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for read operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.read.maxRequests, RateLimitPresets.read.windowMs, 'getChecklistByOpportunity');
    const { opportunityId } = request.data;
    
    if (!opportunityId) {
      throw new HttpsError('invalid-argument', 'Opportunity ID is required');
    }
    
    const checklist = await tasksService.getChecklistByOpportunity(opportunityId);
    return { success: true, checklist };
  } catch (error) {
    console.error('Error getting checklist:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to get checklist');
  }
});

export const addChecklistItemToOpportunity = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'addChecklistItemToOpportunity');
    const { opportunityId, text } = request.data;
    
    if (!opportunityId || !text) {
      throw new HttpsError('invalid-argument', 'Opportunity ID and text are required');
    }
    
    const item = await tasksService.addChecklistItemToOpportunity(opportunityId, text, user.uid);
    return { success: true, item };
  } catch (error) {
    console.error('Error adding checklist item:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to add checklist item');
  }
});

export const updateChecklistItemInOpportunity = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'updateChecklistItemInOpportunity');
    const { opportunityId, itemId, ...updateData } = request.data;
    
    if (!opportunityId || !itemId) {
      throw new HttpsError('invalid-argument', 'Opportunity ID and Item ID are required');
    }
    
    const validatedData = validateData(UpdateChecklistItemSchema, updateData);
    const item = await tasksService.updateChecklistItemInOpportunity(opportunityId, itemId, validatedData, user.uid);
    
    return { success: true, item };
  } catch (error) {
    console.error('Error updating checklist item:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to update checklist item');
  }
});

export const deleteChecklistItemFromOpportunity = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'deleteChecklistItemFromOpportunity');
    const { opportunityId, itemId } = request.data;
    
    if (!opportunityId || !itemId) {
      throw new HttpsError('invalid-argument', 'Opportunity ID and Item ID are required');
    }
    
    await tasksService.deleteChecklistItemFromOpportunity(opportunityId, itemId, user.uid);
    return { success: true };
  } catch (error) {
    console.error('Error deleting checklist item:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to delete checklist item');
  }
}); 