import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Trash2,
  Target,
  CheckSquare,
  Plus,
  X,
  Calendar,
  Clock,
  Edit3,
  ExternalLink,
  Activity,
  TrendingUp,
  FileText,
  User
} from 'lucide-react';
import { useAssignmentsApi } from '../hooks/useAssignmentsApi';
import { useAuth } from '../hooks/useAuth';
import { ASSIGNMENT_STATUSES } from '../types/Assignment';
import type { Assignment, AssignmentStatus } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { OwnerSelect } from '../components/OwnerSelect';

const AssignmentDetails: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // Check if this is a new assignment based on URL
  const isNew = taskId === 'new' || !taskId;
  
  const {
    createAssignment,
    getAssignment,
    updateAssignment,
    deleteAssignment,
    addChecklistItem,
    updateChecklistItem,
    removeChecklistItem,
    addProgressLogEntry,
    loading,
    error
  } = useAssignmentsApi();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [localLoading, setLocalLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newProgressEntry, setNewProgressEntry] = useState('');
  const [showCompletedChecklist, setShowCompletedChecklist] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    details: '',
    status: 'todo' as AssignmentStatus,
    dueDate: null as Date | null,
    ownerId: currentUser?.uid || '',
    oneDriveLink: ''
  });

  // Helper function to safely convert various date formats to Date object
  const safeDateConversion = (dateValue: any): Date => {
    try {
      if (dateValue && typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
      }
      
      if (dateValue && typeof dateValue._seconds === 'number') {
        return new Date(dateValue._seconds * 1000);
      }
      
      if (dateValue && typeof dateValue.seconds === 'number') {
        return new Date(dateValue.seconds * 1000);
      }
      
      if (dateValue instanceof Date) {
        return dateValue;
      }
      
      if (typeof dateValue === 'string') {
        return new Date(dateValue);
      }
      
      console.warn('Unable to parse date value:', dateValue);
      return new Date();
    } catch (error) {
      console.error('Date conversion error:', error, dateValue);
      return new Date();
    }
  };

  const loadAssignment = useCallback(async () => {
    if (!taskId || taskId === 'new') return;
    
    try {
      const data = await getAssignment(taskId);
      setAssignment(data);
      setFormData({
        title: data.title,
        details: data.details || '',
        status: data.status,
        dueDate: data.dueDate ? safeDateConversion(data.dueDate) : null,
        ownerId: data.ownerId || currentUser?.uid || '',
        oneDriveLink: data.oneDriveLink || ''
      });
      setLocalLoading(false);
    } catch (err) {
      console.error('Failed to load assignment:', err);
      setLocalLoading(false);
    }
  }, [taskId, getAssignment, currentUser?.uid]);

  useEffect(() => {
    if (isNew) {
      // Initialize empty assignment for creation
      setAssignment({
        taskId: '',
        title: '',
        details: '',
        status: 'todo',
        ownerId: currentUser?.uid || '',
        checklist: [],
        progressLog: [],
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      setFormData({
        title: '',
        details: '',
        status: 'todo',
        dueDate: null,
        ownerId: currentUser?.uid || '',
        oneDriveLink: ''
      });
      setLocalLoading(false);
    } else if (taskId && currentUser) {
      loadAssignment();
    }
  }, [isNew, taskId, currentUser, loadAssignment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (isNew) {
        // Creating a new assignment
        if (!formData.title.trim()) {
          alert('Title is required for new assignments');
          setSaving(false);
          return;
        }
        
        const createData: any = {
          title: formData.title,
          details: formData.details,
          status: formData.status,
          ownerId: formData.ownerId,
        };
        
        if (formData.dueDate) {
          createData.dueDate = formData.dueDate.toISOString();
        }
        if (formData.oneDriveLink) {
          createData.oneDriveLink = formData.oneDriveLink;
        }
        
        const created = await createAssignment(createData);
        setAssignment(created);
        navigate(`/assignments/${created.taskId}`);
      } else {
        // Updating existing assignment
        const updateData: any = { 
          taskId: assignment!.taskId,
          title: formData.title,
          details: formData.details,
          status: formData.status,
          ownerId: formData.ownerId
        };
        
        if (formData.dueDate) {
          updateData.dueDate = formData.dueDate.toISOString();
        }
        if (formData.oneDriveLink) {
          updateData.oneDriveLink = formData.oneDriveLink;
        }
        
        const updated = await updateAssignment(updateData);
        setAssignment(updated);
      }
    } catch (err) {
      console.error('Failed to save assignment:', err);
      alert('Failed to save assignment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (assignment && assignment.taskId && confirm('Are you sure you want to delete this assignment?')) {
      try {
        await deleteAssignment(assignment.taskId);
        navigate('/assignments');
      } catch (err) {
        console.error('Failed to delete assignment:', err);
      }
    }
  };

  const handleAddChecklistItem = async () => {
    if (!assignment || !newChecklistItem.trim()) return;
    try {
      const updated = await addChecklistItem({
        taskId: assignment.taskId,
        label: newChecklistItem.trim(),
        completed: false
      });
      setAssignment(updated);
      setNewChecklistItem('');
    } catch (err) {
      console.error('Failed to add checklist item:', err);
    }
  };

  const handleToggleChecklistItem = async (itemId: string, completed: boolean) => {
    if (!assignment) return;
    try {
      const updated = await updateChecklistItem({
        taskId: assignment.taskId,
        itemId,
        completed
      });
      setAssignment(updated);
    } catch (err) {
      console.error('Failed to update checklist item:', err);
    }
  };

  const handleRemoveChecklistItem = async (itemId: string) => {
    if (!assignment) return;
    try {
      const updated = await removeChecklistItem({
        taskId: assignment.taskId,
        itemId
      });
      setAssignment(updated);
    } catch (err) {
      console.error('Failed to remove checklist item:', err);
    }
  };

  const handleAddProgressEntry = async () => {
    if (!assignment || !newProgressEntry.trim()) return;
    try {
      const updated = await addProgressLogEntry({
        taskId: assignment.taskId,
        message: newProgressEntry.trim()
      });
      setAssignment(updated);
      setNewProgressEntry('');
    } catch (err) {
      console.error('Failed to add progress entry:', err);
    }
  };

  const getProgress = () => {
    if (!assignment || assignment.checklist.length === 0) return 0;
    const completed = assignment.checklist.filter(item => item.completed).length;
    return (completed / assignment.checklist.length) * 100;
  };

  const getStatusColor = (status: AssignmentStatus) => {
    const colors = {
      'todo': 'bg-gray-100 text-gray-800 border-gray-200',
      'in_progress': 'bg-blue-100 text-blue-800 border-blue-200',
      'done': 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Loading state
  if (localLoading) {
    return (
      <div className="h-full flex flex-col relative">
        <div className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-48 h-6 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
        <div className="flex-1 overflow-auto pb-20">
          <div className="max-w-7xl mx-auto p-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="space-y-4">
                    <div className="w-full h-6 bg-gray-200 rounded animate-pulse"></div>
                    <div className="w-3/4 h-6 bg-gray-200 rounded animate-pulse"></div>
                    <div className="w-1/2 h-6 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="space-y-4">
                    <div className="w-32 h-6 bg-gray-200 rounded animate-pulse"></div>
                    <div className="w-full h-8 bg-gray-200 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Assignment not found</h3>
            <p className="text-sm text-gray-500 mb-4">The assignment you're looking for doesn't exist.</p>
            <Link
              to="/assignments"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Assignments
            </Link>
          </div>
        </div>
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
              to="/assignments"
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {isNew ? 'New Assignment' : formData.title || 'Edit Assignment'}
              </h1>
              {!isNew && assignment.taskId && (
                <p className="text-sm text-gray-500">ID: {assignment.taskId}</p>
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
        <div className="max-w-7xl mx-auto p-4">
          <form id="assignment-form" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* Left Column (2/3) - Core Information */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Primary Information */}
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Assignment Information</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                        placeholder="Enter assignment title..."
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Details</label>
                      <textarea
                        value={formData.details}
                        onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                        rows={3}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Describe the assignment details..."
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Task ID</label>
                      <div className="text-sm text-gray-900 py-1.5">
                        {assignment.taskId || 'Auto-generated'}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as AssignmentStatus })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      >
                        {ASSIGNMENT_STATUSES.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <OwnerSelect
                        value={formData.ownerId}
                        onChange={(ownerId) => setFormData({ ...formData, ownerId })}
                        label="Assignment Owner"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                      <input
                        type="date"
                        value={formData.dueDate ? formData.dueDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          dueDate: e.target.value ? new Date(e.target.value) : null 
                        })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">OneDrive Link</label>
                      <div className="relative">
                        <input
                          type="url"
                          value={formData.oneDriveLink}
                          onChange={(e) => setFormData({ ...formData, oneDriveLink: e.target.value })}
                          className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 pr-8 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="https://..."
                        />
                        {formData.oneDriveLink && (
                          <a
                            href={formData.oneDriveLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-primary-600"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checklist */}
                {!isNew && (
                  <div className="bg-white shadow rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-gray-500" />
                        <h2 className="text-base font-medium text-gray-900">
                          Checklist ({assignment.checklist.filter(item => !item.completed).length})
                        </h2>
                      </div>
                      {assignment.checklist.filter(item => item.completed).length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowCompletedChecklist(!showCompletedChecklist)}
                          className="text-xs text-gray-500 hover:text-gray-700"
                        >
                          {showCompletedChecklist ? 'Hide' : 'Show'} completed ({assignment.checklist.filter(item => item.completed).length})
                        </button>
                      )}
                    </div>

                    {assignment.checklist.length > 0 && (
                      <div className="mb-4">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${getProgress()}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {assignment.checklist.filter(item => item.completed).length} / {assignment.checklist.length} completed
                        </div>
                      </div>
                    )}

                    {/* Add new checklist item */}
                    <div className="flex gap-1.5 mb-4">
                      <input
                        type="text"
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddChecklistItem())}
                        className="flex-1 text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Add checklist item..."
                      />
                      <button
                        type="button"
                        onClick={handleAddChecklistItem}
                        className="px-2 py-1.5 text-gray-400 hover:text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Pending checklist items */}
                    <div className="space-y-2">
                      {assignment.checklist
                        .filter(item => !item.completed)
                        .map((item) => (
                          <div key={item.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                            <button
                              type="button"
                              onClick={() => handleToggleChecklistItem(item.id, true)}
                              className="mt-0.5 w-4 h-4 border-2 border-gray-300 rounded hover:border-green-500 focus:outline-none focus:border-green-500 transition-colors"
                            >
                              <span className="sr-only">Mark as complete</span>
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900 break-words">{item.label}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveChecklistItem(item.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                    </div>

                    {/* Completed checklist items (collapsible) */}
                    {showCompletedChecklist && assignment.checklist.filter(item => item.completed).length > 0 && (
                      <div className="mt-4 pt-3 border-t border-gray-200">
                        <div className="space-y-2">
                          {assignment.checklist
                            .filter(item => item.completed)
                            .map((item) => (
                              <div key={item.id} className="flex items-start gap-2 p-2 bg-green-50 rounded-lg border border-green-200 opacity-75">
                                <button
                                  type="button"
                                  onClick={() => handleToggleChecklistItem(item.id, false)}
                                  className="mt-0.5 w-4 h-4 bg-green-500 border-2 border-green-500 rounded text-white flex items-center justify-center hover:bg-green-600 focus:outline-none transition-colors"
                                >
                                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-gray-700 line-through break-words">{item.label}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveChecklistItem(item.id)}
                                  className="text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Empty state */}
                    {assignment.checklist.length === 0 && (
                      <div className="text-center py-4">
                        <CheckSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No checklist items yet</p>
                        <p className="text-xs text-gray-400">Add items to track progress</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column (1/3) - Metadata & Progress */}
              <div className="space-y-4">
                
                {/* Assignment Overview */}
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-primary-600 bg-opacity-10 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-primary-600" />
                    </div>
                    <h2 className="text-base font-medium text-gray-900">Assignment Overview</h2>
                  </div>
                  
                  {!isNew && (
                    <>
                      {/* Progress Section */}
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">
                            {Math.round(getProgress())}%
                          </div>
                          <div className="text-xs text-gray-500">Complete</div>
                        </div>
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${getProgress()}%` }}
                          ></div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Status Badge */}
                  <div className="mb-4">
                    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(formData.status)}`}>
                      {ASSIGNMENT_STATUSES.find(s => s.value === formData.status)?.label}
                    </span>
                  </div>

                  {/* Assignment Stats */}
                  <div className="space-y-3 text-sm">
                    {!isNew && (
                      <>
                        {/* Checklist Progress */}
                        <div className="flex items-center justify-between py-1 border-b border-gray-100">
                          <span className="text-gray-600">Checklist Items</span>
                          <span className="font-medium text-gray-900">
                            {assignment.checklist.filter(item => item.completed).length} / {assignment.checklist.length}
                          </span>
                        </div>

                        {/* Progress Log */}
                        <div className="flex items-center justify-between py-1 border-b border-gray-100">
                          <span className="text-gray-600">Progress Updates</span>
                          <span className="font-medium text-gray-900">
                            {assignment.progressLog.length}
                          </span>
                        </div>
                      </>
                    )}

                    {/* Due Date */}
                    {formData.dueDate && (
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Due Date</span>
                        <span className="font-medium text-gray-900">
                          {format(formData.dueDate, 'MMM d, yyyy')}
                        </span>
                      </div>
                    )}

                    {/* OneDrive Link */}
                    {formData.oneDriveLink && (
                      <div className="py-1 border-b border-gray-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-600">OneDrive</span>
                        </div>
                        <a
                          href={formData.oneDriveLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Open File
                        </a>
                      </div>
                    )}

                    {/* Timeline */}
                    {!isNew && (
                      <div className="pt-2">
                        <div className="grid grid-cols-1 gap-4 text-xs">
                          <div>
                            <span className="text-gray-500">Created</span>
                            <div className="font-medium text-gray-900">
                              {format(safeDateConversion(assignment.createdAt), 'MMM d, yyyy')}
                            </div>
                            <div className="text-gray-500">
                              {formatDistanceToNow(safeDateConversion(assignment.createdAt), { addSuffix: true })}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Last Updated</span>
                            <div className="font-medium text-gray-900">
                              {format(safeDateConversion(assignment.updatedAt), 'MMM d, yyyy')}
                            </div>
                            <div className="text-gray-500">
                              {formatDistanceToNow(safeDateConversion(assignment.updatedAt), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Progress Log */}
                {!isNew && (
                  <div className="bg-white shadow rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Activity className="h-4 w-4 text-gray-500" />
                      <h2 className="text-base font-medium text-gray-900">Progress Log</h2>
                    </div>
                    
                    <div className="mb-4">
                      <textarea
                        value={newProgressEntry}
                        onChange={(e) => setNewProgressEntry(e.target.value)}
                        placeholder="Add progress update..."
                        rows={3}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={handleAddProgressEntry}
                        className="mt-2 w-full inline-flex justify-center items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Add Update
                      </button>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {assignment.progressLog
                        .sort((a, b) => b.timestamp.seconds - a.timestamp.seconds)
                        .map((entry) => (
                          <div key={entry.id} className="border-l-4 border-primary-200 pl-4 py-2">
                            <p className="text-sm text-gray-900">{entry.message}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {format(safeDateConversion(entry.timestamp), 'MMM d, yyyy • h:mm a')}
                            </p>
                          </div>
                        ))}
                      {assignment.progressLog.length === 0 && (
                        <div className="text-center py-4">
                          <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">No progress updates yet</p>
                          <p className="text-xs text-gray-400">Add updates to track progress</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Floating Save Button */}
      <button
        type="submit"
        form="assignment-form"
        disabled={saving || !formData.title.trim()}
        className="fixed bottom-4 right-4 bg-primary-600 text-white p-3 rounded-full shadow-lg hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-500 focus:ring-opacity-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed z-50"
        title={saving ? 'Saving...' : 'Save Assignment'}
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

export default AssignmentDetails; 