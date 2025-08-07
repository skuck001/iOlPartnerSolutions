import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  Target, 
  FileCheck, 
  AlertTriangle, 
  CheckCircle, 
  ExternalLink,
  User,
  MessageSquare
} from 'lucide-react';
import type { UnifiedTask } from '../types';
import type { Timestamp } from 'firebase/firestore';

interface UnifiedTaskCardProps {
  task: UnifiedTask;
}

const formatTimestamp = (timestamp: Timestamp | Date): string => {
  if (timestamp instanceof Date) {
    return timestamp.toLocaleDateString();
  }
  
  // Handle Firestore Timestamp
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return (timestamp as Timestamp).toDate().toLocaleDateString();
  }
  
  // Handle timestamp objects with seconds/nanoseconds
  if (timestamp && typeof timestamp === 'object' && 'seconds' in timestamp) {
    return new Date((timestamp as any).seconds * 1000).toLocaleDateString();
  }
  
  // Fallback - try to convert to Date
  try {
    return new Date(timestamp as any).toLocaleDateString();
  } catch {
    return 'Invalid Date';
  }
};

const getStatusColor = (status: UnifiedTask['status']) => {
  switch (status) {
    case 'Overdue':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'Due Today':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'Upcoming':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'Completed':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getPriorityColor = (priority?: UnifiedTask['priority']) => {
  switch (priority) {
    case 'Critical':
      return 'bg-red-500';
    case 'High':
      return 'bg-orange-500';
    case 'Medium':
      return 'bg-yellow-500';
    case 'Low':
      return 'bg-green-500';
    default:
      return 'bg-gray-500';
  }
};

const getTypeIcon = (type: UnifiedTask['type']) => {
  switch (type) {
    case 'OpportunityActivity':
      return <Target className="w-4 h-4" />;
    case 'OpportunityChecklist':
      return <CheckCircle className="w-4 h-4" />;
    case 'OpportunityBlocker':
      return <AlertTriangle className="w-4 h-4" />;
    case 'AssignmentActivity':
      return <Clock className="w-4 h-4" />;
    case 'AssignmentChecklist':
      return <FileCheck className="w-4 h-4" />;
    default:
      return <Calendar className="w-4 h-4" />;
  }
};

const getTypeLabel = (type: UnifiedTask['type']) => {
  switch (type) {
    case 'OpportunityActivity':
      return 'Activity';
    case 'OpportunityChecklist':
      return 'Checklist';
    case 'OpportunityBlocker':
      return 'Blocker';
    case 'AssignmentActivity':
      return 'Activity';
    case 'AssignmentChecklist':
      return 'Checklist';
    default:
      return 'Task';
  }
};

const formatDate = (date: Date) => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const taskDate = new Date(date);
  taskDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  tomorrow.setHours(0, 0, 0, 0);

  if (taskDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (taskDate.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  } else {
    return taskDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }
};

export const UnifiedTaskCard: React.FC<UnifiedTaskCardProps> = ({ task }) => {
  return (
    <div className={`bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow ${
      task.isComplete ? 'opacity-75' : ''
    }`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${
              task.parentType === 'Opportunity' ? 'bg-blue-50' : 'bg-green-50'
            }`}>
              {getTypeIcon(task.type)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-500">
                  {task.parentType}
                </span>
                <span className="text-sm text-gray-400">•</span>
                <span className="text-sm font-medium text-gray-500">
                  {getTypeLabel(task.type)}
                </span>
              </div>
              <h3 className={`text-lg font-semibold text-gray-900 ${
                task.isComplete ? 'line-through' : ''
              }`}>
                {task.title}
              </h3>
            </div>
          </div>
          
          {/* Priority Indicator */}
          {task.priority && (
            <div className={`w-3 h-3 rounded-full ${getPriorityColor(task.priority)}`} 
                 title={`Priority: ${task.priority}`} />
          )}
        </div>

        {/* Content */}
        <div className="space-y-3">
          {/* Parent Info */}
          <div className="flex items-center text-sm text-gray-600">
            <span className="font-medium">From:</span>
            <Link
              to={task.linkedUrl}
              className="ml-2 text-blue-600 hover:text-blue-800 hover:underline flex items-center"
            >
              {task.parentTitle}
              <ExternalLink className="w-3 h-3 ml-1" />
            </Link>
          </div>

          {/* Due Date and Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="w-4 h-4 mr-1" />
                {formatDate(task.dueDate)}
              </div>
              
              {(task.assignedToName || task.assignedTo) && (
                <div className="flex items-center text-sm text-gray-600">
                  <User className="w-4 h-4 mr-1" />
                  {task.assignedToName || task.assignedTo}
                </div>
              )}
            </div>
            
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(task.status)}`}>
              {task.status}
            </span>
          </div>

          {/* Notes */}
          {task.notes && (
            <div className="flex items-start text-sm text-gray-600">
              <MessageSquare className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <p className="line-clamp-2">{task.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span>Created: {formatTimestamp(task.createdAt)}</span>
              {task.completedAt && (
                <span>Completed: {formatTimestamp(task.completedAt)}</span>
              )}
            </div>
            
            <Link
              to={task.linkedUrl}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
            >
              View Details
              <ExternalLink className="w-3 h-3 ml-1" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}; 