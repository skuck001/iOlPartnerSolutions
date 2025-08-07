import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { AuditService } from '../../shared/audit.service';

export interface ChecklistItem {
  id: string;
  text: string; // Changed from 'label' to 'text' to match frontend
  completed: boolean;
  dueDate?: Date;
  completedAt?: Timestamp;
}

export interface ProgressLogEntry {
  id: string;
  timestamp: Timestamp;
  userId: string;
  message: string;
}

// Activity status for assignments
export type AssignmentActivityStatus = 'Scheduled' | 'Completed' | 'Cancelled';

// Activity interface for assignments (similar to Opportunities)
export interface AssignmentActivity {
  id: string;
  activityType: 'Meeting' | 'Email' | 'Call' | 'WhatsApp' | 'Demo' | 'Workshop' | 'Review' | 'Update';
  dateTime: Timestamp;
  relatedContactIds?: string[]; // Optional for assignments
  method: 'In-person' | 'Zoom' | 'Phone' | 'Teams' | 'Email' | 'Document' | 'Other';
  subject: string;
  notes: string;
  assignedTo: string; // Assignment owner or assigned user ID
  attachments?: string[]; // file URLs or references
  followUpNeeded: boolean;
  status: AssignmentActivityStatus;
  completedAt?: Timestamp;
  followUpDate?: Timestamp;
  followUpSubject?: string;
  priority?: 'High' | 'Medium' | 'Low';
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export interface Assignment {
  taskId: string;
  title: string;
  details?: string;
  status: 'todo' | 'in_progress' | 'done';
  dueDate?: Date;
  ownerId: string;
  oneDriveLink?: string;
  oneDriveTitle?: string;
  checklist: ChecklistItem[];
  progressLog: ProgressLogEntry[]; // Keep for backward compatibility
  activities: AssignmentActivity[]; // New activity tracking (similar to Opportunities)
  lastActivityDate?: Timestamp; // Track when last activity was added
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export class AssignmentService {
  private db = getFirestore();
  private collection = this.db.collection('assignments');

  async createAssignment(data: any, userId: string): Promise<Assignment> {
    // Auto-generate taskId using Firestore document ID
    const docRef = this.collection.doc();
    const generatedTaskId = docRef.id;

    const assignmentData: any = {
      taskId: generatedTaskId,
      title: data.title,
      status: data.status || 'todo',
      ownerId: data.ownerId || userId,
      checklist: data.checklist || [],
      progressLog: data.progressLog || [], // Keep for backward compatibility
      activities: [], // Initialize new activity tracking
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Only include optional fields if they have values
    if (data.details) {
      assignmentData.details = data.details;
    }
    if (data.dueDate) {
      assignmentData.dueDate = data.dueDate;
    }
    if (data.oneDriveLink) {
      assignmentData.oneDriveLink = data.oneDriveLink;
    }
    if (data.oneDriveTitle) {
      assignmentData.oneDriveTitle = data.oneDriveTitle;
    }

    await docRef.set(assignmentData);

    await AuditService.log({
      userId,
      action: 'create',
      resourceType: 'assignment',
      resourceId: generatedTaskId,
      data: {
        title: assignmentData.title,
        details: assignmentData.details,
        status: assignmentData.status,
        ownerId: assignmentData.ownerId
      }
    });

    return assignmentData;
  }

  async getAssignment(taskId: string): Promise<Assignment | null> {
    const doc = await this.collection.doc(taskId).get();
    if (!doc.exists) return null;
    
    const assignment = doc.data() as Assignment;
    
    // Initialize activities array if it doesn't exist (backward compatibility)
    if (!assignment.activities) {
      assignment.activities = [];
    }
    
    return assignment;
  }

  async updateAssignment(taskId: string, updateData: any, userId: string): Promise<Assignment> {
    const docRef = this.collection.doc(taskId);
    const updatedData = {
      ...updateData,
      updatedAt: Timestamp.now(),
    };

    await docRef.update(updatedData);

    await AuditService.log({
      userId,
      action: 'update',
      resourceType: 'assignment',
      resourceId: taskId,
      data: {
        updatedFields: Object.keys(updateData)
      }
    });

    const updated = await docRef.get();
    return updated.data() as Assignment;
  }

  async deleteAssignment(taskId: string, userId: string): Promise<void> {
    await this.collection.doc(taskId).delete();

    await AuditService.log({
      userId,
      action: 'delete',
      resourceType: 'assignment',
      resourceId: taskId
    });
  }

  // Get all assignments - any authenticated user can view any assignment
  async getAllAssignments(): Promise<Assignment[]> {
    const snapshot = await this.collection
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => {
      const assignment = doc.data() as Assignment;
      // Initialize activities array if it doesn't exist (backward compatibility)
      if (!assignment.activities) {
        assignment.activities = [];
      }
      return assignment;
    });
  }

  async getAssignmentsByOwner(ownerId: string): Promise<Assignment[]> {
    const snapshot = await this.collection
      .where('ownerId', '==', ownerId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => {
      const assignment = doc.data() as Assignment;
      // Initialize activities array if it doesn't exist (backward compatibility)
      if (!assignment.activities) {
        assignment.activities = [];
      }
      return assignment;
    });
  }

  async getAssignmentsByStatus(status: 'todo' | 'in_progress' | 'done'): Promise<Assignment[]> {
    const snapshot = await this.collection
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => {
      const assignment = doc.data() as Assignment;
      // Initialize activities array if it doesn't exist (backward compatibility)
      if (!assignment.activities) {
        assignment.activities = [];
      }
      return assignment;
    });
  }

  async addChecklistItem(taskId: string, checklistItem: Omit<ChecklistItem, 'id'>, userId: string): Promise<Assignment> {
    const docRef = this.collection.doc(taskId);
    const assignment = await this.getAssignment(taskId);
    
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    const newItem: any = {
      id: this.db.collection('temp').doc().id, // Generate unique ID
      text: checklistItem.text, // Changed from 'label' to 'text'
      completed: checklistItem.completed ?? false,
    };

    // Only include dueDate if it has a value
    if (checklistItem.dueDate) {
      newItem.dueDate = checklistItem.dueDate;
    }

    const updatedChecklist = [...assignment.checklist, newItem];

    await docRef.update({
      checklist: updatedChecklist,
      updatedAt: Timestamp.now(),
    });

    await AuditService.log({
      userId,
      action: 'update',
      resourceType: 'assignment',
      resourceId: taskId,
      data: {
        action: 'Checklist item added',
        checklistItemText: newItem.text // Changed from 'checklistItemLabel' to 'checklistItemText'
      }
    });

    const updated = await docRef.get();
    return updated.data() as Assignment;
  }

  async updateChecklistItem(taskId: string, itemId: string, updateData: Partial<ChecklistItem>, userId: string): Promise<Assignment> {
    const docRef = this.collection.doc(taskId);
    const assignment = await this.getAssignment(taskId);
    
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    const updatedChecklist = assignment.checklist.map(item => {
      if (item.id === itemId) {
        const updatedItem = { ...item };
        
        // Update fields only if they are defined (allow null to clear values)
        if (updateData.text !== undefined) {
          updatedItem.text = updateData.text;
        }
        if (updateData.completed !== undefined) {
          updatedItem.completed = updateData.completed;
        }
        if (updateData.dueDate !== undefined) {
          // If dueDate is null, remove it
          if (updateData.dueDate === null) {
            delete updatedItem.dueDate;
          } else {
            updatedItem.dueDate = updateData.dueDate;
          }
        }
        
        // Set completedAt timestamp when marking as completed
        if (updateData.completed === true && !item.completed) {
          updatedItem.completedAt = Timestamp.now();
        } else if (updateData.completed === false && updatedItem.completedAt) {
          // Remove completedAt field when unchecking
          delete updatedItem.completedAt;
        }
        return updatedItem;
      }
      return item;
    });

    await docRef.update({
      checklist: updatedChecklist,
      updatedAt: Timestamp.now(),
    });

    await AuditService.log({
      userId,
      action: 'update',
      resourceType: 'assignment',
      resourceId: taskId,
      data: {
        action: 'Checklist item updated',
        itemId,
        updateData
      }
    });

    const updated = await docRef.get();
    return updated.data() as Assignment;
  }

  async removeChecklistItem(taskId: string, itemId: string, userId: string): Promise<Assignment> {
    const docRef = this.collection.doc(taskId);
    const assignment = await this.getAssignment(taskId);
    
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    const updatedChecklist = assignment.checklist.filter(item => item.id !== itemId);

    await docRef.update({
      checklist: updatedChecklist,
      updatedAt: Timestamp.now(),
    });

    await AuditService.log({
      userId,
      action: 'update',
      resourceType: 'assignment',
      resourceId: taskId,
      data: {
        action: 'Checklist item removed',
        itemId
      }
    });

    const updated = await docRef.get();
    return updated.data() as Assignment;
  }

  async addProgressLogEntry(taskId: string, message: string, userId: string): Promise<Assignment> {
    const docRef = this.collection.doc(taskId);
    const assignment = await this.getAssignment(taskId);
    
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    const newEntry: ProgressLogEntry = {
      id: this.db.collection('temp').doc().id, // Generate unique ID
      timestamp: Timestamp.now(),
      userId,
      message,
    };

    const updatedProgressLog = [...assignment.progressLog, newEntry];

    await docRef.update({
      progressLog: updatedProgressLog,
      updatedAt: Timestamp.now(),
    });

    await AuditService.log({
      userId,
      action: 'update',
      resourceType: 'assignment',
      resourceId: taskId,
      data: {
        action: 'Progress log entry added',
        message: newEntry.message
      }
    });

    const updated = await docRef.get();
    return updated.data() as Assignment;
  }

  async updateProgressLogEntry(taskId: string, entryId: string, message: string, userId: string): Promise<Assignment> {
    const docRef = this.collection.doc(taskId);
    const assignment = await this.getAssignment(taskId);
    
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    const updatedProgressLog = assignment.progressLog.map(entry => {
      if (entry.id === entryId) {
        return {
          ...entry,
          message,
          timestamp: Timestamp.now(), // Update timestamp when editing
        };
      }
      return entry;
    });

    await docRef.update({
      progressLog: updatedProgressLog,
      updatedAt: Timestamp.now(),
    });

    await AuditService.log({
      userId,
      action: 'update',
      resourceType: 'assignment',
      resourceId: taskId,
      data: {
        action: 'Progress log entry updated',
        entryId,
        message
      }
    });

    const updated = await docRef.get();
    return updated.data() as Assignment;
  }

  async removeProgressLogEntry(taskId: string, entryId: string, userId: string): Promise<Assignment> {
    const docRef = this.collection.doc(taskId);
    const assignment = await this.getAssignment(taskId);
    
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    const updatedProgressLog = assignment.progressLog.filter(entry => entry.id !== entryId);

    await docRef.update({
      progressLog: updatedProgressLog,
      updatedAt: Timestamp.now(),
    });

    await AuditService.log({
      userId,
      action: 'update',
      resourceType: 'assignment',
      resourceId: taskId,
      data: {
        action: 'Progress log entry removed',
        entryId
      }
    });

    const updated = await docRef.get();
    return updated.data() as Assignment;
  }

  async bulkAssignmentUpdate(updates: any[], userId: string): Promise<Assignment[]> {
    const batch = this.db.batch();
    const results: Assignment[] = [];

    for (const update of updates) {
      const { taskId, ...updateData } = update;
      const docRef = this.collection.doc(taskId);
      
      const updatedData = {
        ...updateData,
        updatedAt: Timestamp.now(),
      };

      batch.update(docRef, updatedData);
      results.push({ taskId, ...updatedData } as Assignment);
    }

    await batch.commit();

    await AuditService.log({
      userId,
      action: 'bulk_update',
      resourceType: 'assignment',
      resourceId: 'multiple',
      data: {
        action: 'Bulk assignment update',
        count: updates.length
      }
    });

    return results;
  }

  // ============================================================================
  // ACTIVITY MANAGEMENT METHODS (similar to Opportunities)
  // ============================================================================

  async addActivityToAssignment(taskId: string, activityData: Omit<AssignmentActivity, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>, userId: string): Promise<AssignmentActivity> {
    const docRef = this.collection.doc(taskId);
    const assignmentDoc = await docRef.get();

    if (!assignmentDoc.exists) {
      throw new Error('Assignment not found');
    }

    const now = Timestamp.now();
    
    // Filter out null/undefined values from activityData
    const cleanActivityData: any = {};
    for (const [key, value] of Object.entries(activityData)) {
      if (value !== null && value !== undefined) {
        cleanActivityData[key] = value;
      }
    }
    
    const newActivity: AssignmentActivity = {
      ...cleanActivityData,
      id: `activity_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId
    } as AssignmentActivity;

    const assignmentData = assignmentDoc.data();
    const activities = (assignmentData?.activities || []) as AssignmentActivity[];
    activities.push(newActivity);

    await docRef.update({
      activities,
      lastActivityDate: now,
      updatedAt: now
    });

    // Audit log
    await AuditService.log({
      userId,
      action: 'create',
      resourceType: 'assignment_activity',
      resourceId: newActivity.id,
      data: { 
        taskId,
        subject: newActivity.subject,
        activityType: newActivity.activityType,
        assignedTo: newActivity.assignedTo
      }
    });

    return newActivity;
  }

  async updateActivityInAssignment(taskId: string, activityId: string, updateData: Partial<Omit<AssignmentActivity, 'id' | 'createdAt' | 'createdBy'>>, userId: string): Promise<AssignmentActivity> {
    const docRef = this.collection.doc(taskId);
    const assignmentDoc = await docRef.get();

    if (!assignmentDoc.exists) {
      throw new Error('Assignment not found');
    }

    const assignmentData = assignmentDoc.data();
    const activities = (assignmentData?.activities || []) as AssignmentActivity[];
    
    const activityIndex = activities.findIndex(activity => activity.id === activityId);
    if (activityIndex === -1) {
      throw new Error('Activity not found');
    }

    const updatedActivity = {
      ...activities[activityIndex],
      ...updateData,
      updatedAt: Timestamp.now(),
      updatedBy: userId
    };

    activities[activityIndex] = updatedActivity;

    await docRef.update({
      activities,
      updatedAt: Timestamp.now()
    });

    // Audit log
    await AuditService.log({
      userId,
      action: 'update',
      resourceType: 'assignment_activity',
      resourceId: activityId,
      data: { taskId, ...updateData }
    });

    return updatedActivity;
  }

  async deleteActivityFromAssignment(taskId: string, activityId: string, userId: string): Promise<void> {
    const docRef = this.collection.doc(taskId);
    const assignmentDoc = await docRef.get();

    if (!assignmentDoc.exists) {
      throw new Error('Assignment not found');
    }

    const assignmentData = assignmentDoc.data();
    const activities = (assignmentData?.activities || []) as AssignmentActivity[];

    const activityToDelete = activities.find(activity => activity.id === activityId);
    if (!activityToDelete) {
      throw new Error('Activity not found');
    }

    const updatedActivities = activities.filter(activity => activity.id !== activityId);

    await docRef.update({
      activities: updatedActivities,
      updatedAt: Timestamp.now()
    });

    // Audit log
    await AuditService.log({
      userId,
      action: 'delete',
      resourceType: 'assignment_activity',
      resourceId: activityId,
      data: { 
        taskId,
        subject: activityToDelete.subject,
        activityType: activityToDelete.activityType
      }
    });
  }

  async getActivitiesByAssignment(taskId: string): Promise<AssignmentActivity[]> {
    const assignment = await this.getAssignment(taskId);
    
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    return assignment.activities || [];
  }
} 