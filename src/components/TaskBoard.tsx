import React from 'react';
import type { TaskStatus, ActivityStatus } from '../types';
import { format } from 'date-fns';
import { Clock, User, CheckCircle } from 'lucide-react';

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

// Generic task interface that works with both Task and EnhancedTask
interface TaskLike {
  id: string;
  title: string;
  status: ActivityStatus; // Changed to ActivityStatus
  dueDate: any; // Timestamp
  assignedTo: string;
  bucket?: string;
  opportunityTitle?: string;
  accountName?: string;
  activityType?: string;
  priority?: 'High' | 'Medium' | 'Low';
}

interface TaskBoardProps {
  tasks: TaskLike[];
  onTaskClick: (task: TaskLike) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void; // Keep for compatibility but not used
}

const statusColumns: { status: ActivityStatus; title: string; color: string }[] = [
  { status: 'Scheduled', title: 'Scheduled', color: 'bg-blue-100 text-blue-800' },
  { status: 'Completed', title: 'Completed', color: 'bg-green-100 text-green-800' },
  { status: 'Cancelled', title: 'Cancelled', color: 'bg-red-100 text-red-800' }
];

export const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  onTaskClick
  // Removed onStatusChange as we don't use drag-and-drop status changes anymore
}) => {
  const getTasksByStatus = (status: ActivityStatus) => 
    tasks.filter(task => task.status === status);

  const getPriorityColor = (priority?: 'High' | 'Medium' | 'Low') => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActivityIcon = (activityType?: string) => {
    if (!activityType) return null;
    switch (activityType) {
      case 'Meeting': return '📅';
      case 'Call': return '📞';
      case 'Email': return '📧';
      case 'WhatsApp': return '💬';
      case 'Demo': return '🖥️';
      case 'Workshop': return '🎯';
      default: return '📋';
    }
  };

  return (
    <div className="h-full p-6">
      <div className="grid grid-cols-3 gap-6 h-full">
        {statusColumns.map((column) => (
          <div
            key={column.status}
            className="bg-gray-50 rounded-lg p-4 flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">{column.title}</h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${column.color}`}>
                {getTasksByStatus(column.status).length}
              </span>
            </div>
            
            <div className="flex-1 space-y-3 overflow-y-auto">
              {getTasksByStatus(column.status).map((task) => (
                <div
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900 line-clamp-2 flex-1">
                      {task.activityType && (
                        <span className="mr-2">{getActivityIcon(task.activityType)}</span>
                      )}
                    {task.title}
                  </h4>
                    {task.priority && (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(task.priority)} ml-2`}>
                        {task.priority}
                      </span>
                    )}
                  </div>
                  
                  {task.opportunityTitle && (
                    <div className="mb-2 text-sm text-gray-600">
                      <span className="font-medium">🎯 {task.opportunityTitle}</span>
                      {task.accountName && (
                        <div className="text-xs text-gray-500 mt-1">🏢 {task.accountName}</div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(safeDateConversion(task.dueDate), 'MMM d')}
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {task.assignedTo}
                    </div>
                  </div>
                  
                  {task.bucket && (
                    <div className="mt-2">
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-red-100 text-iol-red rounded-full">
                        {task.bucket}
                      </span>
                    </div>
                  )}

                  {/* Status indicator for completed tasks */}
                  {task.status === 'Completed' && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      Completed
                    </div>
                  )}
                </div>
              ))}
              
              {getTasksByStatus(column.status).length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  No activities {column.title.toLowerCase()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 