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
import { useAuth } from '../hooks/useAuth';
import { OwnerSelect } from '../components/OwnerSelect';

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
  const { currentUser } = useAuth();
  const isNew = id === 'new';
  
  const [task, setTask] = useState<Task | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    opportunityId: '',
    assignedTo: currentUser?.uid || '',
    ownerId: currentUser?.uid || '',
    dueDate: '',
    status: 'To do' as TaskStatus,
    bucket: '',
    description: '',
    notes: ''
  });

  useEffect(() => {
    // Set default owner for new tasks
    if (isNew && currentUser?.uid && !formData.ownerId) {
      setFormData(prev => ({ 
        ...prev, 
        ownerId: currentUser.uid,
        assignedTo: currentUser.uid // Keep both for compatibility
      }));
    }
  }, [isNew, currentUser?.uid, formData.ownerId]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [opportunitiesData] = await Promise.all([
        getDocuments('opportunities')
      ]);
      setOpportunities(opportunitiesData as Opportunity[]);

      if (!isNew && id) {
        const taskData = await getDocument('tasks', id);
        if (taskData) {
          const taskTyped = taskData as Task;
          setTask(taskTyped);
          setFormData({
            title: taskTyped.title,
            opportunityId: taskTyped.opportunityId || '',
            assignedTo: taskTyped.assignedTo,
            ownerId: taskTyped.ownerId || taskTyped.assignedTo || currentUser?.uid || '',
            dueDate: taskTyped.dueDate ? format(taskTyped.dueDate.toDate(), 'yyyy-MM-dd') : '',
            status: taskTyped.status,
            bucket: taskTyped.bucket || '',
            description: taskTyped.description || '',
            notes: '' // Add if you have notes field
          });
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const opportunity = opportunities.find(o => o.id === formData.opportunityId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // Clean data to remove undefined values
      const cleanData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value !== undefined && value !== '')
      );

      const submitData = {
        ...cleanData,
        dueDate: formData.dueDate ? Timestamp.fromDate(new Date(formData.dueDate)) : Timestamp.now(),
        createdAt: isNew ? Timestamp.now() : task?.createdAt,
        updatedAt: Timestamp.now()
      };

      if (isNew) {
        const docId = await createDocument('tasks', submitData);
        navigate('/tasks');
      } else {
        await updateDocument('tasks', id!, submitData);
        await fetchData();
      }
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Error saving task. Please try again.');
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
    <div className="min-h-screen flex flex-col relative">
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
              {opportunity && (
                <p className="text-sm text-gray-500">{opportunity.title}</p>
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

      {/* Content */}
      <div className="flex-1 overflow-auto pb-20">
        <div className="max-w-4xl mx-auto p-4">
          <form id="task-form" onSubmit={handleSubmit}>
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center gap-2 mb-6">
                <CheckSquare className="h-5 w-5 text-gray-500" />
                <h2 className="text-lg font-medium text-gray-900">Task Information</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Task Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-iol-red focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Related Opportunity (Optional)
                  </label>
                  <select
                    value={formData.opportunityId}
                    onChange={(e) => setFormData({ ...formData, opportunityId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-iol-red focus:border-transparent"
                  >
                    <option value="">No opportunity</option>
                    {opportunities.map((opp) => (
                      <option key={opp.id} value={opp.id}>
                        {opp.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-iol-red focus:border-transparent"
                    required
                  >
                    {TASK_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-iol-red focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bucket (Category)
                  </label>
                  <select
                    value={formData.bucket}
                    onChange={(e) => setFormData({ ...formData, bucket: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-iol-red focus:border-transparent"
                  >
                    <option value="">Select bucket</option>
                    {TASK_BUCKETS.map((bucket) => (
                      <option key={bucket} value={bucket}>
                        {bucket}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <OwnerSelect
                    value={formData.ownerId}
                    onChange={(ownerId) => setFormData({ 
                      ...formData, 
                      ownerId,
                      assignedTo: ownerId // Keep both in sync for compatibility
                    })}
                    label="Task Owner"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-iol-red focus:border-transparent"
                    placeholder="Describe the task..."
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-iol-red hover:bg-iol-red-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-iol-red disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Task
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}; 