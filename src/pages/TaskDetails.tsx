import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Trash2,
  Calendar,
  User,
  Building2,
  Target,
  Clock,
  CheckSquare
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { Task, TaskStatus, Opportunity } from '../types';
import { getDocument, getDocuments, createDocument, updateDocument, deleteDocument } from '../lib/firestore';
import { format } from 'date-fns';

const TASK_STATUSES: TaskStatus[] = ['To do', 'In progress', 'Done'];

const TASK_BUCKETS = [
  'Sales',
  'Technical',
  'Marketing',
  'Support',
  'Admin',
  'Follow-up',
  'Demo',
  'Proposal',
  'Contract'
];

export const TaskDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';
  
  const [task, setTask] = useState<Task | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    opportunityId: '',
    assignedTo: '',
    dueDate: '',
    status: 'To do' as TaskStatus,
    bucket: '',
    description: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const opportunitiesData = await getDocuments('opportunities');
      setOpportunities(opportunitiesData as Opportunity[]);

      if (!isNew && id) {
        const taskData = await getDocument('tasks', id);
        if (taskData) {
          const taskTyped = taskData as Task & { description?: string; notes?: string };
          setTask(taskTyped);
          setFormData({
            title: taskTyped.title,
            opportunityId: taskTyped.opportunityId || '',
            assignedTo: taskTyped.assignedTo,
            dueDate: format(taskTyped.dueDate.toDate(), 'yyyy-MM-dd'),
            status: taskTyped.status,
            bucket: taskTyped.bucket || '',
            description: taskTyped.description || '',
            notes: taskTyped.notes || ''
          });
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedOpportunity = opportunities.find(o => o.id === formData.opportunityId);

  const getStatusColor = (status: TaskStatus) => {
    const colors = {
      'To do': 'bg-gray-100 text-gray-800',
      'In progress': 'bg-blue-100 text-blue-800',
      'Done': 'bg-green-100 text-green-800'
    };
    return colors[status];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const submitData = {
        ...formData,
        dueDate: Timestamp.fromDate(new Date(formData.dueDate)),
        opportunityId: formData.opportunityId || undefined,
        createdAt: isNew ? Timestamp.now() : task?.createdAt
      };

      if (isNew) {
        await createDocument('tasks', submitData);
        navigate('/tasks');
      } else if (id) {
        await updateDocument('tasks', id, submitData);
        await fetchData();
      }
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (task && id && confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteDocument('tasks', id);
        navigate('/tasks');
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Compact Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/tasks"
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {isNew ? 'New Task' : formData.title || 'Edit Task'}
              </h1>
              {!isNew && selectedOpportunity && (
                <p className="text-sm text-gray-500">{selectedOpportunity.title}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <button
                onClick={handleDelete}
                className="btn-danger-sm flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content - Compact Layout */}
      <div className="flex-1 overflow-auto pb-20">
        <div className="max-w-6xl mx-auto p-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Main Information Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* Left Column - Core Task Info */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Basic Info */}
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckSquare className="h-4 w-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Task Information</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Task Title</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Opportunity</label>
                      <select
                        value={formData.opportunityId}
                        onChange={(e) => setFormData({ ...formData, opportunityId: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">General Task</option>
                        {opportunities.map((opportunity) => (
                          <option key={opportunity.id} value={opportunity.id}>
                            {opportunity.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        {TASK_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Assigned To</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                          <User className="h-3.5 w-3.5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={formData.assignedTo}
                          onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                          className="w-full text-sm pl-8 border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="Assignee name or email"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        </div>
                        <input
                          type="date"
                          value={formData.dueDate}
                          onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                          className="w-full text-sm pl-8 border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Bucket</label>
                      <select
                        value={formData.bucket}
                        onChange={(e) => setFormData({ ...formData, bucket: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">Select bucket...</option>
                        {TASK_BUCKETS.map((bucket) => (
                          <option key={bucket} value={bucket}>
                            {bucket}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={2}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Task description..."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={2}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Additional notes..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Quick Info & Stats */}
              <div className="space-y-4">
                
                {/* Status & Due Date */}
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Status</h2>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-gray-500">Current Status</span>
                      <div className="mt-1">
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(formData.status)}`}>
                          {formData.status}
                        </span>
                      </div>
                    </div>
                    {formData.dueDate && (
                      <div>
                        <span className="text-xs text-gray-500">Due Date</span>
                        <p className="text-sm font-medium text-gray-900">
                          {format(new Date(formData.dueDate), 'MMM d, yyyy')}
                        </p>
                      </div>
                    )}
                    {formData.assignedTo && (
                      <div>
                        <span className="text-xs text-gray-500">Assigned To</span>
                        <p className="text-sm text-gray-900">{formData.assignedTo}</p>
                      </div>
                    )}
                    {formData.bucket && (
                      <div>
                        <span className="text-xs text-gray-500">Bucket</span>
                        <p className="text-sm text-gray-900">{formData.bucket}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Stats */}
                {!isNew && (
                  <div className="bg-white shadow rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <h2 className="text-base font-medium text-gray-900">Details</h2>
                    </div>
                    <div className="space-y-2 text-sm">
                      {task?.createdAt && (
                        <div>
                          <span className="text-gray-500">Created:</span>
                          <p className="text-gray-900">{format(task.createdAt.toDate(), 'MMM d, yyyy')}</p>
                        </div>
                      )}
                      {selectedOpportunity && (
                        <div>
                          <span className="text-gray-500">Opportunity:</span>
                          <Link 
                            to={`/opportunities/${selectedOpportunity.id}`}
                            className="text-blue-600 hover:text-blue-800 block truncate"
                          >
                            {selectedOpportunity.title}
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Related Opportunity Details */}
            {selectedOpportunity && (
              <div className="bg-white shadow rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="h-4 w-4 text-gray-500" />
                  <h2 className="text-base font-medium text-gray-900">Related Opportunity</h2>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <Link
                        to={`/opportunities/${selectedOpportunity.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-primary-600 block"
                      >
                        {selectedOpportunity.title}
                      </Link>
                      <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{selectedOpportunity.summary}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                          selectedOpportunity.stage === 'Closed-Won' ? 'bg-green-100 text-green-800' :
                          selectedOpportunity.stage === 'Closed-Lost' ? 'bg-red-100 text-red-800' :
                          selectedOpportunity.stage === 'Negotiation' ? 'bg-orange-100 text-orange-800' :
                          selectedOpportunity.stage === 'Proposal' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {selectedOpportunity.stage}
                        </span>
                        <span className="text-xs text-gray-500">
                          ${selectedOpportunity.arrImpact.toLocaleString()} ARR
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Floating Save Button */}
      <button
        onClick={handleSubmit}
        disabled={saving || !formData.title.trim() || !formData.dueDate}
        className="fixed bottom-4 right-4 bg-primary-600 text-white p-3 rounded-full shadow-lg hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-500 focus:ring-opacity-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed z-50"
        title={saving ? 'Saving...' : 'Save Task'}
      >
        {saving ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
        ) : (
          <Save className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}; 