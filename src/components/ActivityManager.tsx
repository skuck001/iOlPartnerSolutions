import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Calendar, 
  Clock, 
  MessageSquare, 
  X, 
  ArrowRight, 
  Plus,
  Save
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { Activity, ActivityStatus } from '../types';

// Helper function to convert various date formats to Date object
const safeDateConversion = (dateValue: any): Date => {
  if (!dateValue) return new Date();
  
  // If it's already a Date object
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? new Date() : dateValue;
  }
  
  // Handle Cloud Functions timestamp format: {_seconds: number, _nanoseconds: number}
  if (dateValue && typeof dateValue === 'object' && '_seconds' in dateValue) {
    return new Date(dateValue._seconds * 1000 + Math.floor(dateValue._nanoseconds / 1000000));
  }
  
  // Handle legacy timestamp format: {seconds: number, nanoseconds: number}
  if (dateValue && typeof dateValue === 'object' && 'seconds' in dateValue) {
    return new Date(dateValue.seconds * 1000 + Math.floor(dateValue.nanoseconds / 1000000));
  }
  
  // If it has a toDate method (Firebase Timestamp)
  if (dateValue && typeof dateValue.toDate === 'function') {
    try {
      const date = dateValue.toDate();
      return isNaN(date.getTime()) ? new Date() : date;
    } catch (error) {
      console.error('Error converting timestamp with toDate method:', error);
      return new Date();
    }
  }
  
  // If it's a string or number, parse it
  try {
    const parsedDate = new Date(dateValue);
    return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  } catch (error) {
    console.error('Error parsing date:', error);
    return new Date();
  }
};

interface ActivityManagerProps {
  activity: Activity;
  opportunityId: string;
  opportunityTitle: string;
  accountName: string;
  onComplete: (activityId: string, updatedNotes: string, followUpActivity?: Partial<Activity>) => Promise<void>;
  onCancel: () => void;
  isOpen: boolean;
}

const ACTIVITY_TYPES = ['Meeting', 'Email', 'Call', 'WhatsApp', 'Demo', 'Workshop'];
const ACTIVITY_METHODS = ['In-person', 'Zoom', 'Phone', 'Teams', 'Email'];

export const ActivityManager: React.FC<ActivityManagerProps> = ({
  activity,
  opportunityId,
  opportunityTitle,
  accountName,
  onComplete,
  onCancel,
  isOpen
}) => {
  const [notes, setNotes] = useState(activity.notes || '');
  const [createFollowUp, setCreateFollowUp] = useState(false);
  const [followUpDays, setFollowUpDays] = useState(7);
  const [followUpActivity, setFollowUpActivity] = useState({
    activityType: 'Meeting' as const,
    method: 'Zoom' as const,
    subject: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      let followUp: Partial<Activity> | undefined;
      
      if (createFollowUp && followUpActivity.subject.trim()) {
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + followUpDays);
        
        followUp = {
          id: Math.random().toString(36).substr(2, 9),
          activityType: followUpActivity.activityType,
          method: followUpActivity.method,
          subject: followUpActivity.subject,
          notes: followUpActivity.notes,
          dateTime: Timestamp.fromDate(followUpDate),
          status: 'Scheduled' as ActivityStatus,
          relatedContactIds: activity.relatedContactIds || [],
          assignedTo: activity.assignedTo,
          priority: 'Medium',
          followUpNeeded: false,
          attachments: [],
          createdAt: Timestamp.now(),
          createdBy: activity.assignedTo,
          updatedAt: Timestamp.now(),
          updatedBy: activity.assignedTo
        };
      }
      
      await onComplete(activity.id, notes, followUp);
    } catch (error) {
      console.error('Error completing activity:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const quickFollowUpTemplates = [
    { days: 1, subject: 'Follow-up call' },
    { days: 3, subject: 'Check on progress' },
    { days: 7, subject: 'Weekly check-in' },
    { days: 14, subject: 'Bi-weekly review' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Complete Activity</h2>
                <p className="text-sm text-gray-600">{opportunityTitle} • {accountName}</p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Activity Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">{activity.subject}</h3>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {safeDateConversion(activity.dateTime).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {safeDateConversion(activity.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="capitalize">{activity.activityType} • {activity.method}</span>
            </div>
          </div>

          {/* Notes/Summary Editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <MessageSquare className="h-4 w-4 inline mr-1" />
              Activity Summary & Outcomes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about what was discussed, outcomes, next steps..."
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Follow-up Activity Option */}
          <div className="border border-gray-200 rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="createFollowUp"
                    checked={createFollowUp}
                    onChange={(e) => setCreateFollowUp(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="createFollowUp" className="text-sm font-medium text-gray-900">
                    Schedule follow-up activity
                  </label>
                </div>
                {createFollowUp && (
                  <ArrowRight className="h-4 w-4 text-blue-500" />
                )}
              </div>
            </div>

            {createFollowUp && (
              <div className="p-4 space-y-4 bg-blue-50">
                {/* Quick Templates */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Quick Templates</label>
                  <div className="flex flex-wrap gap-2">
                    {quickFollowUpTemplates.map((template, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setFollowUpDays(template.days);
                          setFollowUpActivity(prev => ({ ...prev, subject: template.subject }));
                        }}
                        className="px-3 py-1 text-xs bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
                      >
                        {template.subject} ({template.days}d)
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Days from now</label>
                    <input
                      type="number"
                      value={followUpDays}
                      onChange={(e) => setFollowUpDays(parseInt(e.target.value) || 1)}
                      min="1"
                      max="365"
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Activity Type</label>
                    <select
                      value={followUpActivity.activityType}
                      onChange={(e) => setFollowUpActivity(prev => ({ ...prev, activityType: e.target.value as any }))}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                    >
                      {ACTIVITY_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
                    <select
                      value={followUpActivity.method}
                      onChange={(e) => setFollowUpActivity(prev => ({ ...prev, method: e.target.value as any }))}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                    >
                      {ACTIVITY_METHODS.map(method => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Scheduled Date</label>
                    <input
                      type="text"
                      value={new Date(Date.now() + followUpDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                      readOnly
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1 bg-gray-50 text-gray-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Subject/Purpose</label>
                  <input
                    type="text"
                    value={followUpActivity.subject}
                    onChange={(e) => setFollowUpActivity(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="What's the purpose of this follow-up?"
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Additional Notes</label>
                  <textarea
                    value={followUpActivity.notes}
                    onChange={(e) => setFollowUpActivity(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any specific agenda items or preparation notes..."
                    rows={2}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleComplete}
            disabled={isSubmitting || (createFollowUp && !followUpActivity.subject.trim())}
            className="px-6 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Completing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Complete{createFollowUp && followUpActivity.subject.trim() ? ' & Schedule Follow-up' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}; 