import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { validateData } from '../../shared/validation.middleware';
import { authenticateUser } from '../../shared/auth.middleware';
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
  opportunityId: z.string().optional(),
  assignedTo: z.string().min(1),
  ownerId: z.string().min(1),
  dueDate: z.any(), // Timestamp
  status: z.enum(['To do', 'In progress', 'Done']).default('To do'),
  bucket: z.string().optional(),
  description: z.string().optional()
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

export const getTasks = onCall(async (request) => {
  try {
    await authenticateUser(request.auth);
    const queryOptions = validateData(TasksQuerySchema, request.data || {}) as TasksQueryOptions;
    
    const result = await tasksService.getTasks(queryOptions);
    return { success: true, ...result };
  } catch (error) {
    console.error('Error getting tasks:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to get tasks');
  }
});

export const getTask = onCall(async (request) => {
  try {
    await authenticateUser(request.auth);
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
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to get task');
  }
});

export const createTask = onCall(async (request) => {
  try {
    const user = await authenticateUser(request.auth);
    const taskData = validateData(CreateTaskSchema, request.data);
    
    const task = await tasksService.createTask(taskData, user.uid);
    return { success: true, task };
  } catch (error) {
    console.error('Error creating task:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to create task');
  }
});

export const updateTask = onCall(async (request) => {
  try {
    const user = await authenticateUser(request.auth);
    const { taskId, ...updateData } = request.data;
    
    if (!taskId) {
      throw new HttpsError('invalid-argument', 'Task ID is required');
    }
    
    const validatedData = validateData(UpdateTaskSchema, updateData);
    const task = await tasksService.updateTask(taskId, validatedData, user.uid);
    
    return { success: true, task };
  } catch (error) {
    console.error('Error updating task:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to update task');
  }
});

export const deleteTask = onCall(async (request) => {
  try {
    const user = await authenticateUser(request.auth);
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

export const getActivitiesByOpportunity = onCall(async (request) => {
  try {
    await authenticateUser(request.auth);
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

export const addActivityToOpportunity = onCall(async (request) => {
  try {
    const user = await authenticateUser(request.auth);
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

export const updateActivityInOpportunity = onCall(async (request) => {
  try {
    const user = await authenticateUser(request.auth);
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

export const deleteActivityFromOpportunity = onCall(async (request) => {
  try {
    const user = await authenticateUser(request.auth);
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

export const getChecklistByOpportunity = onCall(async (request) => {
  try {
    await authenticateUser(request.auth);
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

export const addChecklistItemToOpportunity = onCall(async (request) => {
  try {
    const user = await authenticateUser(request.auth);
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

export const updateChecklistItemInOpportunity = onCall(async (request) => {
  try {
    const user = await authenticateUser(request.auth);
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

export const deleteChecklistItemFromOpportunity = onCall(async (request) => {
  try {
    const user = await authenticateUser(request.auth);
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