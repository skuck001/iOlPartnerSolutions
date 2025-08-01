import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { AuditService } from '../../shared/audit.service';

export interface ChecklistItem {
  id: string;
  label: string;
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

export interface Assignment {
  taskId: string;
  title: string;
  details?: string;
  status: 'todo' | 'in_progress' | 'done';
  dueDate?: Date;
  ownerId: string;
  oneDriveLink?: string;
  checklist: ChecklistItem[];
  progressLog: ProgressLogEntry[];
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
      progressLog: data.progressLog || [],
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
    return doc.exists ? doc.data() as Assignment : null;
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

    return snapshot.docs.map(doc => doc.data() as Assignment);
  }

  async getAssignmentsByOwner(ownerId: string): Promise<Assignment[]> {
    const snapshot = await this.collection
      .where('ownerId', '==', ownerId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => doc.data() as Assignment);
  }

  async getAssignmentsByStatus(status: 'todo' | 'in_progress' | 'done'): Promise<Assignment[]> {
    const snapshot = await this.collection
      .where('status', '==', status)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => doc.data() as Assignment);
  }

  async addChecklistItem(taskId: string, checklistItem: Omit<ChecklistItem, 'id'>, userId: string): Promise<Assignment> {
    const docRef = this.collection.doc(taskId);
    const assignment = await this.getAssignment(taskId);
    
    if (!assignment) {
      throw new Error('Assignment not found');
    }

    const newItem: any = {
      id: this.db.collection('temp').doc().id, // Generate unique ID
      label: checklistItem.label,
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
        checklistItemLabel: newItem.label
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
        
        // Update fields only if they have values
        if (updateData.label !== undefined && updateData.label !== null) {
          updatedItem.label = updateData.label;
        }
        if (updateData.completed !== undefined && updateData.completed !== null) {
          updatedItem.completed = updateData.completed;
        }
        if (updateData.dueDate !== undefined && updateData.dueDate !== null) {
          updatedItem.dueDate = updateData.dueDate;
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
} 