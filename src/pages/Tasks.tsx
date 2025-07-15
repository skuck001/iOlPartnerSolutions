import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Task, TaskStatus, Opportunity } from '../types';
import { ListView } from '../components/ListView';
import { TaskBoard } from '../components/TaskBoard';
import { getDocuments, updateDocument } from '../lib/firestore';
import { format } from 'date-fns';
import { LayoutGrid, List } from 'lucide-react';

export const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'board'>('board');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tasksData, opportunitiesData] = await Promise.all([
        getDocuments('tasks'),
        getDocuments('opportunities')
      ]);
      setTasks(tasksData as Task[]);
      setOpportunities(opportunitiesData as Opportunity[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOpportunityTitle = (opportunityId: string) => {
    const opportunity = opportunities.find(o => o.id === opportunityId);
    return opportunity?.title || 'General Task';
  };

  const handleRowClick = (task: Task) => {
    // Navigate to task details page instead of opening modal
    window.location.href = `/tasks/${task.id}`;
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await updateDocument('tasks', taskId, { status: newStatus });
      await fetchData();
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const filteredTasks = tasks.filter(task =>
    task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    task.assignedTo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getOpportunityTitle(task.opportunityId || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'To do': return 'bg-gray-100 text-gray-800';
      case 'In progress': return 'bg-blue-100 text-blue-800';
      case 'Done': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const columns = [
    { key: 'title' as keyof Task, label: 'Task' },
    { 
      key: 'status' as keyof Task, 
      label: 'Status',
      render: (status: TaskStatus) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(status)}`}>
          {status}
        </span>
      )
    },
    { key: 'assignedTo' as keyof Task, label: 'Assigned To' },
    { 
      key: 'dueDate' as keyof Task, 
      label: 'Due Date',
      render: (dueDate: Timestamp) => format(dueDate.toDate(), 'MMM d, yyyy')
    },
    { 
      key: 'opportunityId' as keyof Task, 
      label: 'Opportunity',
      render: (opportunityId?: string) => opportunityId ? getOpportunityTitle(opportunityId) : 'General'
    }
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header with view toggle */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Tasks</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-600'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'board' ? 'bg-white shadow-sm' : 'text-gray-600'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
            <Link to="/tasks/new" className="btn-primary">
              Add Task
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'list' ? (
          <ListView
            title=""
            data={filteredTasks}
            columns={columns}
            onRowClick={handleRowClick}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            loading={loading}
          />
        ) : (
          <TaskBoard
            tasks={filteredTasks}
            onTaskClick={handleRowClick}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>
    </div>
  );
}; 