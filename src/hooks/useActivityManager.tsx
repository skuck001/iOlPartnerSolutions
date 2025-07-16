import { useState, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import { updateDocument } from '../lib/firestore';
import { useAuth } from './useAuth';
import type { Activity, ActivityStatus, Opportunity } from '../types';

interface UseActivityManagerProps {
  opportunities: Opportunity[];
  onDataRefresh: () => Promise<void>;
}

export const useActivityManager = ({ opportunities, onDataRefresh }: UseActivityManagerProps) => {
  const { currentUser } = useAuth();
  const [activeActivity, setActiveActivity] = useState<Activity | null>(null);
  const [activityContext, setActivityContext] = useState<{
    opportunityId: string;
    opportunityTitle: string;
    accountName: string;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openActivityCompletion = useCallback((
    activity: Activity, 
    opportunityId: string, 
    opportunityTitle: string, 
    accountName: string
  ) => {
    setActiveActivity(activity);
    setActivityContext({ opportunityId, opportunityTitle, accountName });
    setIsModalOpen(true);
  }, []);

  const closeActivityCompletion = useCallback(() => {
    setActiveActivity(null);
    setActivityContext(null);
    setIsModalOpen(false);
  }, []);

  const completeActivity = useCallback(async (
    activityId: string, 
    updatedNotes: string, 
    followUpActivity?: Partial<Activity>
  ) => {
    if (!activeActivity || !activityContext) return;

    try {
      const opportunity = opportunities.find(o => o.id === activityContext.opportunityId);
      if (!opportunity) {
        throw new Error('Opportunity not found');
      }

      const now = Timestamp.now();
      const userId = currentUser?.uid || 'system';

      // Update the existing activity
      const updatedActivities = opportunity.activities.map(activity => 
        activity.id === activityId 
          ? { 
              ...activity, 
              status: 'Completed' as ActivityStatus,
              notes: updatedNotes,
              completedAt: now,
              updatedAt: now,
              updatedBy: userId
            }
          : activity
      );

      // Add follow-up activity if provided
      if (followUpActivity && followUpActivity.subject?.trim()) {
        const newFollowUpActivity: Activity = {
          id: followUpActivity.id || Math.random().toString(36).substr(2, 9),
          activityType: followUpActivity.activityType!,
          method: followUpActivity.method!,
          subject: followUpActivity.subject,
          notes: followUpActivity.notes || '',
          dateTime: followUpActivity.dateTime!,
          status: followUpActivity.status || 'Scheduled',
          relatedContactIds: followUpActivity.relatedContactIds || activeActivity.relatedContactIds,
          assignedTo: followUpActivity.assignedTo || activeActivity.assignedTo,
          priority: followUpActivity.priority || 'Medium',
          followUpNeeded: false,
          attachments: followUpActivity.attachments || [],
          createdAt: followUpActivity.createdAt || now,
          createdBy: followUpActivity.createdBy || userId,
          updatedAt: followUpActivity.updatedAt || now,
          updatedBy: followUpActivity.updatedBy || userId
        };
        
        updatedActivities.push(newFollowUpActivity);
      }

      // Update the opportunity in the database
      await updateDocument('opportunities', activityContext.opportunityId, {
        activities: updatedActivities,
        lastActivityDate: now,
        updatedAt: now
      });

      // Close modal and refresh data
      closeActivityCompletion();
      await onDataRefresh();

    } catch (error) {
      console.error('Error completing activity:', error);
      throw error;
    }
  }, [activeActivity, activityContext, opportunities, currentUser?.uid, closeActivityCompletion, onDataRefresh]);

  const updateActivityNotes = useCallback(async (
    opportunityId: string,
    activityId: string, 
    newNotes: string
  ) => {
    try {
      const opportunity = opportunities.find(o => o.id === opportunityId);
      if (!opportunity) {
        throw new Error('Opportunity not found');
      }

      const now = Timestamp.now();
      const userId = currentUser?.uid || 'system';

      const updatedActivities = opportunity.activities.map(activity => 
        activity.id === activityId 
          ? { 
              ...activity, 
              notes: newNotes,
              updatedAt: now,
              updatedBy: userId
            }
          : activity
      );

      await updateDocument('opportunities', opportunityId, {
        activities: updatedActivities,
        updatedAt: now
      });

      await onDataRefresh();

    } catch (error) {
      console.error('Error updating activity notes:', error);
      throw error;
    }
  }, [opportunities, currentUser?.uid, onDataRefresh]);

  const deleteActivity = useCallback(async (
    opportunityId: string,
    activityId: string
  ) => {
    try {
      const opportunity = opportunities.find(o => o.id === opportunityId);
      if (!opportunity) {
        throw new Error('Opportunity not found');
      }

      const updatedActivities = opportunity.activities.filter(a => a.id !== activityId);

      await updateDocument('opportunities', opportunityId, {
        activities: updatedActivities,
        updatedAt: Timestamp.now()
      });

      await onDataRefresh();

    } catch (error) {
      console.error('Error deleting activity:', error);
      throw error;
    }
  }, [opportunities, onDataRefresh]);

  return {
    // State
    activeActivity,
    activityContext,
    isModalOpen,
    
    // Actions
    openActivityCompletion,
    closeActivityCompletion,
    completeActivity,
    updateActivityNotes,
    deleteActivity
  };
};

export default useActivityManager; 