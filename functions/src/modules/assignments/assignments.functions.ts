import { onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions';
import { authenticateUser } from '../../shared/auth.middleware';
import { validateData } from '../../shared/validation.middleware';
import { withErrorHandling } from '../../shared/errors';
import { RateLimiter, RateLimitPresets } from '../../shared/rateLimiter';
import { AssignmentService } from './assignments.service';
import { z } from 'zod';
import { HttpsError } from 'firebase-functions/v2/https';

setGlobalOptions({
  maxInstances: 10,
  region: 'us-central1',
});

const assignmentService = new AssignmentService();

// Validation Schemas
export const CreateAssignmentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  details: z.string().nullish(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  dueDate: z.string().nullish().transform(val => val ? new Date(val) : undefined),
  ownerId: z.string().nullish(),
  oneDriveLink: z.union([
    z.string().url('Invalid URL format'),
    z.string().length(0).transform(() => undefined),
    z.null(),
    z.undefined()
  ]).optional(),
  checklist: z.array(z.object({
    id: z.string(),
    label: z.string(),
    completed: z.boolean(),
    dueDate: z.string().nullish().transform(val => val ? new Date(val) : undefined),
  })).optional(),
  progressLog: z.array(z.object({
    id: z.string(),
    userId: z.string(),
    message: z.string(),
  })).optional(),
}).transform((data) => {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {} as any);
});

export const UpdateAssignmentSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  title: z.string().min(1).nullish(),
  details: z.string().nullish(),
  status: z.enum(['todo', 'in_progress', 'done']).nullish(),
  dueDate: z.string().nullish().transform(val => val ? new Date(val) : undefined),
  ownerId: z.string().nullish(),
  oneDriveLink: z.union([
    z.string().url('Invalid URL format'),
    z.string().length(0).transform(() => undefined),
    z.null(),
    z.undefined()
  ]).optional(),
}).transform((data) => {
  const { taskId, ...updateData } = data;
  const cleanData = Object.entries(updateData).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {} as any);
  return { taskId, updateData: cleanData };
});

export const DeleteAssignmentSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
});

export const ChecklistItemSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  label: z.string().min(1, 'Label is required'),
  completed: z.boolean().optional(),
  dueDate: z.string().nullish().transform(val => val ? new Date(val) : undefined),
});

export const UpdateChecklistItemSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  itemId: z.string().min(1, 'Item ID is required'),
  label: z.string().nullish(),
  completed: z.boolean().nullish(),
  dueDate: z.string().nullish().transform(val => val ? new Date(val) : undefined),
});

export const ProgressLogEntrySchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  message: z.string().min(1, 'Message is required'),
});

export const UpdateProgressLogEntrySchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  entryId: z.string().min(1, 'Entry ID is required'),
  message: z.string().min(1, 'Message is required'),
});

export const RemoveProgressLogEntrySchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  entryId: z.string().min(1, 'Entry ID is required'),
});

// Create Assignment
export const createAssignment = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'createAssignment');
    
    const validatedData = validateData(CreateAssignmentSchema, request.data);
    
    const assignmentData = {
      ...validatedData,
      ownerId: validatedData.ownerId || user.uid,
    };
    
    const result = await assignmentService.createAssignment(assignmentData, user.uid);
    
    console.log(`✅ Assignment created successfully: ${result.taskId}`);
    return result;
  }, { functionName: 'createAssignment', action: 'ASSIGNMENT_CREATE' })
);

// Get Assignments
export const getAssignments = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    await RateLimiter.checkLimit(
      user.uid, 
      RateLimitPresets.read.maxRequests, 
      RateLimitPresets.read.windowMs, 
      'getAssignments'
    );
    
    // Get all assignments - any authenticated user can view any assignment
    const result = await assignmentService.getAllAssignments();
    
    console.log(`📋 Retrieved ${result.length} assignments for user ${user.uid}`);
    return result;
  }, { functionName: 'getAssignments', action: 'ASSIGNMENT_LIST' })
);

// Get Assignments by Owner
export const getAssignmentsByOwner = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    await RateLimiter.checkLimit(
      user.uid, 
      RateLimitPresets.read.maxRequests, 
      RateLimitPresets.read.windowMs, 
      'getAssignmentsByOwner'
    );
    
    const ownerId = request.data?.ownerId || user.uid;
    const result = await assignmentService.getAssignmentsByOwner(ownerId);
    
    console.log(`📋 Retrieved ${result.length} assignments for owner ${ownerId}`);
    return result;
  }, { functionName: 'getAssignmentsByOwner', action: 'ASSIGNMENT_LIST_BY_OWNER' })
);

// Get Single Assignment
export const getAssignment = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    await RateLimiter.checkLimit(
      user.uid, 
      RateLimitPresets.read.maxRequests, 
      RateLimitPresets.read.windowMs, 
      'getAssignment'
    );
    
    if (!request.data?.taskId) {
      throw new HttpsError('invalid-argument', 'Task ID is required');
    }

    const result = await assignmentService.getAssignment(request.data.taskId);
    
    if (!result) {
      throw new HttpsError('not-found', 'Assignment not found');
    }

    // Any authenticated user can view any assignment
    return result;
  }, { functionName: 'getAssignment', action: 'ASSIGNMENT_GET' })
);

// Update Assignment
export const updateAssignment = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    await RateLimiter.checkLimit(
      user.uid, 
      RateLimitPresets.write.maxRequests, 
      RateLimitPresets.write.windowMs, 
      'updateAssignment'
    );
    
    const { taskId, updateData } = validateData(UpdateAssignmentSchema, request.data);
    
    // Verify assignment exists - any authenticated user can edit any assignment
    const existing = await assignmentService.getAssignment(taskId);
    if (!existing) {
      throw new HttpsError('not-found', 'Assignment not found');
    }
    
    const result = await assignmentService.updateAssignment(taskId, updateData, user.uid);
    
    console.log(`✅ Assignment updated successfully: ${taskId}`);
    return result;
  }, { functionName: 'updateAssignment', action: 'ASSIGNMENT_UPDATE' })
);

// Delete Assignment
export const deleteAssignment = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    await RateLimiter.checkLimit(
      user.uid, 
      RateLimitPresets.write.maxRequests, 
      RateLimitPresets.write.windowMs, 
      'deleteAssignment'
    );
    
    const { taskId } = validateData(DeleteAssignmentSchema, request.data);
    
    // Verify assignment exists - any authenticated user can delete any assignment
    const existing = await assignmentService.getAssignment(taskId);
    if (!existing) {
      throw new HttpsError('not-found', 'Assignment not found');
    }
    
    await assignmentService.deleteAssignment(taskId, user.uid);
    
    console.log(`✅ Assignment deleted successfully: ${taskId}`);
    return { success: true };
  }, { functionName: 'deleteAssignment', action: 'ASSIGNMENT_DELETE' })
);

// Add Checklist Item
export const addChecklistItem = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    await RateLimiter.checkLimit(
      user.uid, 
      RateLimitPresets.write.maxRequests, 
      RateLimitPresets.write.windowMs, 
      'addChecklistItem'
    );
    
    const validatedData = validateData(ChecklistItemSchema, request.data);
    const { taskId, ...checklistItem } = validatedData;
    
    // Ensure completed has a default value
    const safeChecklistItem = {
      ...checklistItem,
      completed: checklistItem.completed ?? false
    };
    
    const result = await assignmentService.addChecklistItem(taskId, safeChecklistItem, user.uid);
    
    console.log(`✅ Checklist item added to assignment: ${taskId}`);
    return result;
  }, { functionName: 'addChecklistItem', action: 'CHECKLIST_ADD' })
);

// Update Checklist Item
export const updateChecklistItem = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    await RateLimiter.checkLimit(
      user.uid, 
      RateLimitPresets.write.maxRequests, 
      RateLimitPresets.write.windowMs, 
      'updateChecklistItem'
    );
    
    const validatedData = validateData(UpdateChecklistItemSchema, request.data);
    const { taskId, itemId, ...updateData } = validatedData;
    
    const cleanUpdateData = Object.entries(updateData).reduce((acc, [key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        acc[key] = value;
      }
      return acc;
    }, {} as any);
    
    const result = await assignmentService.updateChecklistItem(taskId, itemId, cleanUpdateData, user.uid);
    
    console.log(`✅ Checklist item updated in assignment: ${taskId}`);
    return result;
  }, { functionName: 'updateChecklistItem', action: 'CHECKLIST_UPDATE' })
);

// Remove Checklist Item
export const removeChecklistItem = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    await RateLimiter.checkLimit(
      user.uid, 
      RateLimitPresets.write.maxRequests, 
      RateLimitPresets.write.windowMs, 
      'removeChecklistItem'
    );
    
    if (!request.data?.taskId || !request.data?.itemId) {
      throw new HttpsError('invalid-argument', 'Task ID and Item ID are required');
    }
    
    const result = await assignmentService.removeChecklistItem(request.data.taskId, request.data.itemId, user.uid);
    
    console.log(`✅ Checklist item removed from assignment: ${request.data.taskId}`);
    return result;
  }, { functionName: 'removeChecklistItem', action: 'CHECKLIST_REMOVE' })
);

// Add Progress Log Entry
export const addProgressLogEntry = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    await RateLimiter.checkLimit(
      user.uid, 
      RateLimitPresets.write.maxRequests, 
      RateLimitPresets.write.windowMs, 
      'addProgressLogEntry'
    );
    
    const { taskId, message } = validateData(ProgressLogEntrySchema, request.data);
    
    const result = await assignmentService.addProgressLogEntry(taskId, message, user.uid);
    
    console.log(`✅ Progress log entry added to assignment: ${taskId}`);
    return result;
  }, { functionName: 'addProgressLogEntry', action: 'PROGRESS_LOG_ADD' })
);

// Update Progress Log Entry
export const updateProgressLogEntry = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    await RateLimiter.checkLimit(
      user.uid, 
      RateLimitPresets.write.maxRequests, 
      RateLimitPresets.write.windowMs, 
      'updateProgressLogEntry'
    );
    
    const { taskId, entryId, message } = validateData(UpdateProgressLogEntrySchema, request.data);
    
    const result = await assignmentService.updateProgressLogEntry(taskId, entryId, message, user.uid);
    
    console.log(`✅ Progress log entry updated in assignment: ${taskId}`);
    return result;
  }, { functionName: 'updateProgressLogEntry', action: 'PROGRESS_LOG_UPDATE' })
);

// Remove Progress Log Entry
export const removeProgressLogEntry = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    await RateLimiter.checkLimit(
      user.uid, 
      RateLimitPresets.write.maxRequests, 
      RateLimitPresets.write.windowMs, 
      'removeProgressLogEntry'
    );
    
    const { taskId, entryId } = validateData(RemoveProgressLogEntrySchema, request.data);
    
    const result = await assignmentService.removeProgressLogEntry(taskId, entryId, user.uid);
    
    console.log(`✅ Progress log entry removed from assignment: ${taskId}`);
    return result;
  }, { functionName: 'removeProgressLogEntry', action: 'PROGRESS_LOG_REMOVE' })
); 