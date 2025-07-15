import React from 'react';
import type { Task, TaskStatus } from '../types';
import { format } from 'date-fns';
import { Clock, User } from 'lucide-react';

interface TaskBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
}

const statusColumns: { status: TaskStatus; title: string; color: string }[] = [
  { status: 'To do', title: 'To Do', color: 'bg-gray-100 text-gray-800' },
  { status: 'In progress', title: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  { status: 'Done', title: 'Done', color: 'bg-green-100 text-green-800' }
];

export const TaskBoard: React.FC<TaskBoardProps> = ({
  tasks,
  onTaskClick,
  onStatusChange
}) => {
  const getTasksByStatus = (status: TaskStatus) => 
    tasks.filter(task => task.status === status);

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', task.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    onStatusChange(taskId, status);
  };

  return (
    <div className="h-full p-6">
      <div className="grid grid-cols-3 gap-6 h-full">
        {statusColumns.map((column) => (
          <div
            key={column.status}
            className="bg-gray-50 rounded-lg p-4 flex flex-col"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.status)}
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
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  onClick={() => onTaskClick(task)}
                  className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <h4 className="font-medium text-gray-900 mb-2 line-clamp-2">
                    {task.title}
                  </h4>
                  
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(task.dueDate.toDate(), 'MMM d')}
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
                </div>
              ))}
              
              {getTasksByStatus(column.status).length === 0 && (
                <div className="text-center text-gray-400 py-8">
                  No tasks in {column.title.toLowerCase()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 