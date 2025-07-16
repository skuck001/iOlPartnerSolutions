import { Firestore, Timestamp, Query } from 'firebase-admin/firestore';
import { AuditService } from '../../shared/audit.service';

export type TaskStatus = 'To do' | 'In progress' | 'Done';
export type ActivityStatus = 'Scheduled' | 'Completed' | 'Cancelled';

export interface Task {
  id?: string;
  title: string;
  opportunityId?: string;
  assignedTo: string;
  ownerId: string;
  dueDate: Timestamp;
  status: TaskStatus;
  bucket?: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface Activity {
  id: string;
  activityType: 'Meeting' | 'Email' | 'Call' | 'WhatsApp' | 'Demo' | 'Workshop';
  dateTime: Timestamp;
  relatedContactIds: string[];
  method: 'In-person' | 'Zoom' | 'Phone' | 'Teams' | 'Email';
  subject: string;
  notes: string;
  assignedTo: string;
  attachments?: string[];
  followUpNeeded: boolean;
  status: ActivityStatus;
  completedAt?: Timestamp;
  followUpDate?: Timestamp;
  followUpSubject?: string;
  priority?: 'High' | 'Medium' | 'Low';
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

export interface TaskFilters {
  ownerId?: string;
  assignedTo?: string;
  opportunityId?: string;
  status?: TaskStatus;
  bucket?: string;
  dueDateStart?: Timestamp;
  dueDateEnd?: Timestamp;
}

export interface TasksQueryOptions {
  filters?: TaskFilters;
  sortBy?: 'title' | 'dueDate' | 'status' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface TasksResponse {
  tasks: Task[];
  total: number;
  hasMore: boolean;
}

export interface ActivityFilters {
  assignedTo?: string;
  status?: ActivityStatus;
  activityType?: string;
  dateStart?: Timestamp;
  dateEnd?: Timestamp;
}

export interface ActivitiesQueryOptions {
  filters?: ActivityFilters;
  sortBy?: 'dateTime' | 'status' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export class TasksService {
  constructor(private db: Firestore) {}

  // ============================================================================
  // STANDALONE TASKS METHODS
  // ============================================================================

  async getTasks(options: TasksQueryOptions = {}): Promise<TasksResponse> {
    const {
      filters = {},
      sortBy = 'dueDate',
      sortOrder = 'asc',
      limit = 50,
      offset = 0
    } = options;

    let query: Query = this.db.collection('tasks');

    // Apply filters
    if (filters.ownerId) {
      query = query.where('ownerId', '==', filters.ownerId);
    }

    if (filters.assignedTo) {
      query = query.where('assignedTo', '==', filters.assignedTo);
    }

    if (filters.opportunityId) {
      query = query.where('opportunityId', '==', filters.opportunityId);
    }

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }

    if (filters.bucket) {
      query = query.where('bucket', '==', filters.bucket);
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
    const tasks = snapshot.docs.slice(0, limit).map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Task[];

    return {
      tasks,
      total: snapshot.size,
      hasMore: snapshot.docs.length > limit
    };
  }

  async getTask(taskId: string): Promise<Task | null> {
    const doc = await this.db.collection('tasks').doc(taskId).get();
    
    if (!doc.exists) {
      return null;
    }

    return { id: doc.id, ...doc.data() } as Task;
  }

  async createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Promise<Task> {
    // Validate required fields
    if (!taskData.title) {
      throw new Error('Task title is required');
    }

    if (!taskData.ownerId) {
      throw new Error('Task owner is required');
    }

    if (!taskData.assignedTo) {
      throw new Error('Task assignee is required');
    }

    if (!taskData.dueDate) {
      throw new Error('Task due date is required');
    }

    const now = Timestamp.now();
    const task: Omit<Task, 'id'> = {
      ...taskData,
      status: taskData.status || 'To do',
      createdAt: now,
      updatedAt: now
    };

    const docRef = await this.db.collection('tasks').add(task);
    const newTask = { id: docRef.id, ...task } as Task;

    // Audit log
    await AuditService.log({
      userId,
      action: 'create',
      resourceType: 'task',
      resourceId: docRef.id,
      data: { 
        title: task.title, 
        assignedTo: task.assignedTo,
        dueDate: task.dueDate,
        opportunityId: task.opportunityId
      }
    });

    return newTask;
  }

  async updateTask(taskId: string, updateData: Partial<Omit<Task, 'id' | 'createdAt'>>, userId: string): Promise<Task> {
    const taskRef = this.db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw new Error('Task not found');
    }

    const updates = {
      ...updateData,
      updatedAt: Timestamp.now()
    };

    await taskRef.update(updates);

    // Audit log
    await AuditService.log({
      userId,
      action: 'update',
      resourceType: 'task',
      resourceId: taskId,
      data: updateData
    });

    const updatedDoc = await taskRef.get();
    return { id: updatedDoc.id, ...updatedDoc.data() } as Task;
  }

  async deleteTask(taskId: string, userId: string): Promise<void> {
    const taskRef = this.db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      throw new Error('Task not found');
    }

    await taskRef.delete();

    // Audit log
    await AuditService.log({
      userId,
      action: 'delete',
      resourceType: 'task',
      resourceId: taskId,
      data: taskDoc.data()
    });
  }

  // ============================================================================
  // ACTIVITY METHODS (within opportunities)
  // ============================================================================

  async getActivitiesByOpportunity(opportunityId: string, options: ActivitiesQueryOptions = {}): Promise<Activity[]> {
    const opportunityRef = this.db.collection('opportunities').doc(opportunityId);
    const opportunityDoc = await opportunityRef.get();

    if (!opportunityDoc.exists) {
      throw new Error('Opportunity not found');
    }

    const opportunityData = opportunityDoc.data();
    let activities = (opportunityData?.activities || []) as Activity[];

    // Apply filters
    const { filters = {} } = options;
    
    if (filters.assignedTo) {
      activities = activities.filter(activity => activity.assignedTo === filters.assignedTo);
    }

    if (filters.status) {
      activities = activities.filter(activity => activity.status === filters.status);
    }

    if (filters.activityType) {
      activities = activities.filter(activity => activity.activityType === filters.activityType);
    }

    if (filters.dateStart || filters.dateEnd) {
      activities = activities.filter(activity => {
        const activityDate = activity.dateTime;
        if (filters.dateStart && activityDate < filters.dateStart) return false;
        if (filters.dateEnd && activityDate > filters.dateEnd) return false;
        return true;
      });
    }

    // Apply sorting
    const { sortBy = 'dateTime', sortOrder = 'asc' } = options;
    activities.sort((a, b) => {
      const aValue = a[sortBy as keyof Activity];
      const bValue = b[sortBy as keyof Activity];
      
      // Handle undefined values
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return sortOrder === 'asc' ? 1 : -1;
      if (bValue === undefined) return sortOrder === 'asc' ? -1 : 1;
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return activities;
  }

  async addActivityToOpportunity(opportunityId: string, activityData: Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>, userId: string): Promise<Activity> {
    const opportunityRef = this.db.collection('opportunities').doc(opportunityId);
    const opportunityDoc = await opportunityRef.get();

    if (!opportunityDoc.exists) {
      throw new Error('Opportunity not found');
    }

    const now = Timestamp.now();
    const newActivity: Activity = {
      ...activityData,
      id: `activity_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId
    };

    const opportunityData = opportunityDoc.data();
    const activities = (opportunityData?.activities || []) as Activity[];
    activities.push(newActivity);

    await opportunityRef.update({
      activities,
      updatedAt: now,
      lastActivityDate: now
    });

    // Audit log
    await AuditService.log({
      userId,
      action: 'create',
      resourceType: 'activity',
      resourceId: newActivity.id,
      data: { 
        opportunityId,
        subject: newActivity.subject,
        activityType: newActivity.activityType,
        assignedTo: newActivity.assignedTo
      }
    });

    return newActivity;
  }

  async updateActivityInOpportunity(opportunityId: string, activityId: string, updateData: Partial<Omit<Activity, 'id' | 'createdAt' | 'createdBy'>>, userId: string): Promise<Activity> {
    const opportunityRef = this.db.collection('opportunities').doc(opportunityId);
    const opportunityDoc = await opportunityRef.get();

    if (!opportunityDoc.exists) {
      throw new Error('Opportunity not found');
    }

    const opportunityData = opportunityDoc.data();
    const activities = (opportunityData?.activities || []) as Activity[];
    
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

    await opportunityRef.update({
      activities,
      updatedAt: Timestamp.now()
    });

    // Audit log
    await AuditService.log({
      userId,
      action: 'update',
      resourceType: 'activity',
      resourceId: activityId,
      data: { opportunityId, ...updateData }
    });

    return updatedActivity;
  }

  async deleteActivityFromOpportunity(opportunityId: string, activityId: string, userId: string): Promise<void> {
    const opportunityRef = this.db.collection('opportunities').doc(opportunityId);
    const opportunityDoc = await opportunityRef.get();

    if (!opportunityDoc.exists) {
      throw new Error('Opportunity not found');
    }

    const opportunityData = opportunityDoc.data();
    const activities = (opportunityData?.activities || []) as Activity[];
    
    const activityIndex = activities.findIndex(activity => activity.id === activityId);
    if (activityIndex === -1) {
      throw new Error('Activity not found');
    }

    const deletedActivity = activities[activityIndex];
    activities.splice(activityIndex, 1);

    await opportunityRef.update({
      activities,
      updatedAt: Timestamp.now()
    });

    // Audit log
    await AuditService.log({
      userId,
      action: 'delete',
      resourceType: 'activity',
      resourceId: activityId,
      data: { opportunityId, activity: deletedActivity }
    });
  }

  // ============================================================================
  // CHECKLIST METHODS (within opportunities)
  // ============================================================================

  async getChecklistByOpportunity(opportunityId: string): Promise<ChecklistItem[]> {
    const opportunityRef = this.db.collection('opportunities').doc(opportunityId);
    const opportunityDoc = await opportunityRef.get();

    if (!opportunityDoc.exists) {
      throw new Error('Opportunity not found');
    }

    const opportunityData = opportunityDoc.data();
    return (opportunityData?.checklist || []) as ChecklistItem[];
  }

  async addChecklistItemToOpportunity(opportunityId: string, text: string, userId: string): Promise<ChecklistItem> {
    const opportunityRef = this.db.collection('opportunities').doc(opportunityId);
    const opportunityDoc = await opportunityRef.get();

    if (!opportunityDoc.exists) {
      throw new Error('Opportunity not found');
    }

    const now = Timestamp.now();
    const newChecklistItem: ChecklistItem = {
      id: `checklist_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      text: text.trim(),
      completed: false,
      createdAt: now
    };

    const opportunityData = opportunityDoc.data();
    const checklist = (opportunityData?.checklist || []) as ChecklistItem[];
    checklist.push(newChecklistItem);

    await opportunityRef.update({
      checklist,
      updatedAt: now
    });

    // Audit log
    await AuditService.log({
      userId,
      action: 'create',
      resourceType: 'checklist',
      resourceId: newChecklistItem.id,
      data: { opportunityId, text: newChecklistItem.text }
    });

    return newChecklistItem;
  }

  async updateChecklistItemInOpportunity(opportunityId: string, itemId: string, updateData: Partial<Omit<ChecklistItem, 'id' | 'createdAt'>>, userId: string): Promise<ChecklistItem> {
    const opportunityRef = this.db.collection('opportunities').doc(opportunityId);
    const opportunityDoc = await opportunityRef.get();

    if (!opportunityDoc.exists) {
      throw new Error('Opportunity not found');
    }

    const opportunityData = opportunityDoc.data();
    const checklist = (opportunityData?.checklist || []) as ChecklistItem[];
    
    const itemIndex = checklist.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error('Checklist item not found');
    }

    const updatedItem = {
      ...checklist[itemIndex],
      ...updateData
    };

    // If marking as completed, add completedAt timestamp
    if (updateData.completed === true && !checklist[itemIndex].completed) {
      updatedItem.completedAt = Timestamp.now();
    }
    // If marking as not completed, remove completedAt timestamp
    else if (updateData.completed === false && checklist[itemIndex].completed) {
      delete updatedItem.completedAt;
    }

    checklist[itemIndex] = updatedItem;

    await opportunityRef.update({
      checklist,
      updatedAt: Timestamp.now()
    });

    // Audit log
    await AuditService.log({
      userId,
      action: 'update',
      resourceType: 'checklist',
      resourceId: itemId,
      data: { opportunityId, ...updateData }
    });

    return updatedItem;
  }

  async deleteChecklistItemFromOpportunity(opportunityId: string, itemId: string, userId: string): Promise<void> {
    const opportunityRef = this.db.collection('opportunities').doc(opportunityId);
    const opportunityDoc = await opportunityRef.get();

    if (!opportunityDoc.exists) {
      throw new Error('Opportunity not found');
    }

    const opportunityData = opportunityDoc.data();
    const checklist = (opportunityData?.checklist || []) as ChecklistItem[];
    
    const itemIndex = checklist.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error('Checklist item not found');
    }

    const deletedItem = checklist[itemIndex];
    checklist.splice(itemIndex, 1);

    await opportunityRef.update({
      checklist,
      updatedAt: Timestamp.now()
    });

    // Audit log
    await AuditService.log({
      userId,
      action: 'delete',
      resourceType: 'checklist',
      resourceId: itemId,
      data: { opportunityId, item: deletedItem }
    });
  }
} 