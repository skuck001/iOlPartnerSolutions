import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Edit3, 
  Calendar, 
  Activity, 
  CheckSquare,
  Clock,
  CheckCircle,
  ArrowUpDown,
  AlertTriangle,
  Target,
  Download,
  FileText,
  DollarSign,
  Paperclip,
  FileSpreadsheet,
  Presentation,
  FileText as FileWord,
  Image,
  Video,
  File
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAssignmentsApi } from '../hooks/useAssignmentsApi';
import { useAuth } from '../hooks/useAuth';
import { useUsersApi } from '../hooks/useUsersApi';
import { ASSIGNMENT_STATUSES } from '../types/Assignment';
import type { Assignment, AssignmentStatus } from '../types';
import { format, formatDistanceToNow, isAfter, isBefore, startOfDay, addDays, isToday, isTomorrow, isThisWeek, isPast, isSameDay } from 'date-fns';

type SortField = 'title' | 'status' | 'dueDate' | 'createdAt' | 'progress';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'list' | 'scheduled' | 'board';

// Helper function to convert various date formats to Date object
const toDate = (dateValue: any): Date => {
  if (!dateValue) return new Date();
  
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? new Date() : dateValue;
  }
  
  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? new Date() : date;
  }
  
  // Handle Cloud Functions timestamp format {_seconds: number, _nanoseconds: number}
  if (dateValue && typeof dateValue._seconds === 'number') {
    return new Date(dateValue._seconds * 1000);
  }
  
  // Handle legacy format {seconds: number, nanoseconds: number}
  if (dateValue && typeof dateValue.seconds === 'number') {
    return new Date(dateValue.seconds * 1000);
  }
  
  const parsedDate = new Date(dateValue);
  return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
};

const Assignments: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { 
    assignments, 
    getAssignments, 
    getAssignmentProgress,
    updateAssignment,
    addChecklistItem,
    updateChecklistItem,
    removeChecklistItem,
    loading, 
    error 
  } = useAssignmentsApi();
  
  const { getAllUsers } = useUsersApi();
  const [users, setUsers] = useState<any[]>([]);

  const [pageLoading, setPageLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | 'All'>('All');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  // --- Inline editing state and handlers for title/description ---
  const [editTitle, setEditTitle] = useState(selectedAssignment?.title || '');
  const [editDescription, setEditDescription] = useState(selectedAssignment?.details || '');

  // --- Date editing state and handlers ---
  const [editDueDate, setEditDueDate] = useState(selectedAssignment?.dueDate ? format(toDate(selectedAssignment.dueDate), 'yyyy-MM-dd') : '');
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);

  // --- Checklist editing state and handlers ---
  const [editChecklist, setEditChecklist] = useState(selectedAssignment?.checklist || []);
  const [newChecklistItem, setNewChecklistItem] = useState('');

  // --- OneDrive link editing state and handlers ---
  const [editOneDriveLink, setEditOneDriveLink] = useState(selectedAssignment?.oneDriveLink || '');
  const [editOneDriveTitle, setEditOneDriveTitle] = useState(selectedAssignment?.oneDriveTitle || '');
  const [isEditingLink, setIsEditingLink] = useState(false);

  // --- Save button state and handlers ---
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editStatus, setEditStatus] = useState<AssignmentStatus>('todo');

  // Update editTitle and editDescription when selectedAssignment changes
  useEffect(() => {
    setEditTitle(selectedAssignment?.title || '');
    setEditDescription(selectedAssignment?.details || '');
  }, [selectedAssignment]);

  // Update editDueDate when selectedAssignment changes
  useEffect(() => {
    setEditDueDate(selectedAssignment?.dueDate ? format(toDate(selectedAssignment.dueDate), 'yyyy-MM-dd') : '');
  }, [selectedAssignment]);

  // Update editChecklist when selectedAssignment changes
  useEffect(() => {
    setEditChecklist(selectedAssignment?.checklist || []);
  }, [selectedAssignment]);

  // Update editOneDriveLink when selectedAssignment changes
  useEffect(() => {
    setEditOneDriveLink(selectedAssignment?.oneDriveLink || '');
    setEditOneDriveTitle(selectedAssignment?.oneDriveTitle || '');
  }, [selectedAssignment]);

  // Update editStatus when selectedAssignment changes
  useEffect(() => {
    setEditStatus(selectedAssignment?.status || 'todo');
  }, [selectedAssignment]);

  // Update hasUnsavedChanges when any editable field changes
  useEffect(() => {
    if (selectedAssignment) {
      const titleChanged = editTitle !== selectedAssignment.title;
      const descriptionChanged = editDescription !== selectedAssignment.details;
      const dueDateChanged = editDueDate !== (selectedAssignment.dueDate ? format(toDate(selectedAssignment.dueDate), 'yyyy-MM-dd') : '');
      const linkChanged = editOneDriveLink !== selectedAssignment.oneDriveLink;
      const linkTitleChanged = editOneDriveTitle !== selectedAssignment.oneDriveTitle;
      const statusChanged = editStatus !== selectedAssignment.status;
      
      setHasUnsavedChanges(titleChanged || descriptionChanged || dueDateChanged || linkChanged || linkTitleChanged || statusChanged);
    }
  }, [editTitle, editDescription, editDueDate, editOneDriveLink, editOneDriveTitle, editStatus, selectedAssignment]);

  // Fetch data when component mounts
  useEffect(() => {
    if (currentUser) {
      fetchAssignments();
      fetchUsers();
    }
  }, [currentUser]);

  // Update pageLoading when loading state changes
  useEffect(() => {
    if (!loading) {
      setPageLoading(false);
    }
  }, [loading]);

  // Set first assignment as selected by default
  useEffect(() => {
    if (assignments && assignments.length > 0 && !selectedAssignment) {
      setSelectedAssignment(assignments[0]);
    }
  }, [assignments, selectedAssignment]);

  const handleChecklistToggle = async (idx: number) => {
    if (selectedAssignment) {
      const item = editChecklist[idx];
      const updated = editChecklist.map((item, i) => i === idx ? { ...item, completed: !item.completed } : item);
      setEditChecklist(updated);
      try {
        await updateChecklistItem({
          taskId: selectedAssignment.taskId,
          itemId: item.id,
          completed: !item.completed
        });
      } catch (error) {
        console.error('Error updating checklist:', error);
        // Revert on error
        setEditChecklist(selectedAssignment.checklist);
      }
    }
  };

  const handleChecklistEdit = async (idx: number, value: string) => {
    if (selectedAssignment) {
      const item = editChecklist[idx];
      const updated = editChecklist.map((item, i) => i === idx ? { ...item, label: value } : item);
      setEditChecklist(updated);
      try {
        await updateChecklistItem({
          taskId: selectedAssignment.taskId,
          itemId: item.id,
          label: value
        });
      } catch (error) {
        console.error('Error updating checklist:', error);
        // Revert on error
        setEditChecklist(selectedAssignment.checklist);
      }
    }
  };

  const handleChecklistRemove = async (idx: number) => {
    if (selectedAssignment) {
      const item = editChecklist[idx];
      const updated = editChecklist.filter((_, i) => i !== idx);
      setEditChecklist(updated);
      try {
        await removeChecklistItem({
          taskId: selectedAssignment.taskId,
          itemId: item.id
        });
      } catch (error) {
        console.error('Error removing checklist item:', error);
        // Revert on error
        setEditChecklist(selectedAssignment.checklist);
      }
    }
  };

  const handleChecklistAdd = async () => {
    if (selectedAssignment && newChecklistItem.trim()) {
      const tempItem = { id: Date.now().toString(), label: newChecklistItem, completed: false };
      const updated = [...editChecklist, tempItem];
      setEditChecklist(updated);
      setNewChecklistItem('');
      try {
        await addChecklistItem({
          taskId: selectedAssignment.taskId,
          label: newChecklistItem.trim(),
          completed: false
        });
      } catch (error) {
        console.error('Error adding checklist item:', error);
        // Revert on error
        setEditChecklist(selectedAssignment.checklist);
        setNewChecklistItem(newChecklistItem);
      }
    }
  };

  const handleLinkRemove = () => {
    setEditOneDriveLink('');
    setEditOneDriveTitle('');
  };

  const fetchAssignments = async () => {
    try {
      await getAssignments();
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setPageLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const usersData = await getAllUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSaveAll = async () => {
    if (selectedAssignment) {
      try {
        const updates: any = {};
        
        if (editTitle !== selectedAssignment.title) {
          updates.title = editTitle;
        }
        if (editDescription !== selectedAssignment.details) {
          updates.details = editDescription;
        }
        if (editDueDate !== (selectedAssignment.dueDate ? format(toDate(selectedAssignment.dueDate), 'yyyy-MM-dd') : '')) {
          updates.dueDate = editDueDate || undefined;
        }
        if (editOneDriveLink !== selectedAssignment.oneDriveLink) {
          updates.oneDriveLink = editOneDriveLink || undefined;
        }
        if (editOneDriveTitle !== selectedAssignment.oneDriveTitle) {
          updates.oneDriveTitle = editOneDriveTitle || undefined;
        }
        if (editStatus !== selectedAssignment.status) {
          updates.status = editStatus;
        }

        if (Object.keys(updates).length > 0) {
          await updateAssignment({
            taskId: selectedAssignment.taskId,
            ...updates
          });
          setHasUnsavedChanges(false);
        }
      } catch (error) {
        console.error('Error saving changes:', error);
      }
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'title' ? 'asc' : 'desc');
    }
  };

  const handleRowClick = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
  };

  const handleAdd = () => {
    navigate('/assignments/new');
  };

  const getStatusColor = (status: AssignmentStatus) => {
    const colors = {
      'todo': 'bg-gray-100 text-gray-800 border-gray-200',
      'in_progress': 'bg-blue-100 text-blue-800 border-blue-200',
      'done': 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const isAssignmentOverdue = (assignment: Assignment) => {
    if (!assignment.dueDate) return false;
    return isBefore(toDate(assignment.dueDate), startOfDay(new Date()));
  };

  // Calculate assignment statistics
  const calculateStats = () => {
    const total = assignments?.length || 0;
    const overdue = (assignments || []).filter(assignment => 
      assignment.status !== 'done' && isAssignmentOverdue(assignment)
    ).length;
    const dueToday = (assignments || []).filter(assignment => 
      assignment.status !== 'done' && assignment.dueDate && isToday(toDate(assignment.dueDate))
    ).length;
    const inProgress = (assignments || []).filter(assignment => assignment.status === 'in_progress').length;
    const completed = (assignments || []).filter(assignment => assignment.status === 'done').length;
    
    return { total, overdue, dueToday, inProgress, completed };
  };

  const filteredAndSortedAssignments = (assignments || [])
    .filter(assignment => {
      const matchesSearch = (
        assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        assignment.taskId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (assignment.details && assignment.details.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      
      const matchesStatus = statusFilter === 'All' || assignment.status === statusFilter;
      const matchesCompleted = !hideCompleted || assignment.status !== 'done';
      
      return matchesSearch && matchesStatus && matchesCompleted;
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'dueDate':
          aValue = a.dueDate ? toDate(a.dueDate).getTime() : 0;
          bValue = b.dueDate ? toDate(b.dueDate).getTime() : 0;
          break;
        case 'createdAt':
          aValue = toDate(a.createdAt).getTime();
          bValue = toDate(b.createdAt).getTime();
          break;
        case 'progress':
          aValue = getAssignmentProgress(a);
          bValue = getAssignmentProgress(b);
          break;
        default:
          return 0;
      }
      
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  const getSortIcon = (field: SortField) => {
    if (sortField === field) {
      return (
        <ArrowUpDown 
          className={`h-3 w-3 ml-1 inline ${
            sortDirection === 'desc' ? 'transform rotate-180' : ''
          }`} 
        />
      );
    }
    return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-0 group-hover:opacity-50" />;
  };

  const getUserName = (userId: string): string => {
    const user = users.find(u => u.id === userId);
    return user ? `${user.firstName} ${user.lastName}`.trim() : userId;
  };

  // Function to detect document type from OneDrive link and return appropriate icon
  const getDocumentTypeAndIcon = (link: string) => {
    if (!link) return { type: 'unknown', icon: FileText };
    
    const lowerLink = link.toLowerCase();
    
    // OneDrive URL patterns - check for file type indicators in URL
    if (lowerLink.includes('/:x:/') || lowerLink.includes('/:x:')) {
      return { type: 'excel', icon: FileSpreadsheet };
    }
    if (lowerLink.includes('/:p:/') || lowerLink.includes('/:p:')) {
      return { type: 'powerpoint', icon: Presentation };
    }
    if (lowerLink.includes('/:w:/') || lowerLink.includes('/:w:')) {
      return { type: 'word', icon: FileWord };
    }
    if (lowerLink.includes('/:t:/') || lowerLink.includes('/:t:')) {
      return { type: 'text', icon: FileText };
    }
    if (lowerLink.includes('/:i:/') || lowerLink.includes('/:i:')) {
      return { type: 'image', icon: Image };
    }
    if (lowerLink.includes('/:v:/') || lowerLink.includes('/:v:')) {
      return { type: 'video', icon: Video };
    }
    
    // Fallback to file extension detection
    // Excel files
    if (lowerLink.includes('.xlsx') || lowerLink.includes('.xls')) {
      return { type: 'excel', icon: FileSpreadsheet };
    }
    
    // PowerPoint files
    if (lowerLink.includes('.pptx') || lowerLink.includes('.ppt')) {
      return { type: 'powerpoint', icon: Presentation };
    }
    
    // Word documents
    if (lowerLink.includes('.docx') || lowerLink.includes('.doc')) {
      return { type: 'word', icon: FileWord };
    }
    
    // PDF files
    if (lowerLink.includes('.pdf')) {
      return { type: 'pdf', icon: FileText };
    }
    
    // Images
    if (lowerLink.includes('.jpg') || lowerLink.includes('.jpeg') || 
        lowerLink.includes('.png') || lowerLink.includes('.gif') || 
        lowerLink.includes('.bmp') || lowerLink.includes('.svg')) {
      return { type: 'image', icon: Image };
    }
    
    // Videos
    if (lowerLink.includes('.mp4') || lowerLink.includes('.avi') || 
        lowerLink.includes('.mov') || lowerLink.includes('.wmv')) {
      return { type: 'video', icon: Video };
    }
    
    // Text files
    if (lowerLink.includes('.txt') || lowerLink.includes('.rtf')) {
      return { type: 'text', icon: FileText };
    }
    
    // Default to generic file
    return { type: 'file', icon: File };
  };

  // Function to get color class based on document type
  const getDocumentColor = (type: string) => {
    switch (type) {
      case 'excel':
        return 'bg-green-100 text-green-600';
      case 'powerpoint':
        return 'bg-orange-100 text-orange-600';
      case 'word':
        return 'bg-blue-100 text-blue-600';
      case 'pdf':
        return 'bg-red-100 text-red-600';
      case 'image':
        return 'bg-purple-100 text-purple-600';
      case 'video':
        return 'bg-indigo-100 text-indigo-600';
      case 'text':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-blue-100 text-blue-600';
    }
  };

  const handleExportToExcel = () => {
    try {
      if (filteredAndSortedAssignments.length === 0) {
        alert('No assignments to export');
        return;
      }

      const exportData = filteredAndSortedAssignments.map((assignment) => {
        const progress = getAssignmentProgress(assignment);
        const isOverdue = isAssignmentOverdue(assignment);
        
        return {
          'Task ID': assignment.taskId,
          'Title': assignment.title,
          'Details': assignment.details || '',
          'Status': ASSIGNMENT_STATUSES.find(s => s.value === assignment.status)?.label,
          'Progress': `${Math.round(progress)}%`,
          'Due Date': assignment.dueDate ? format(toDate(assignment.dueDate), 'yyyy-MM-dd') : '',
          'Is Overdue': isOverdue ? 'Yes' : 'No',
          'OneDrive Link': assignment.oneDriveLink || '',
          'Checklist Items': assignment.checklist.length,
          'Completed Items': assignment.checklist.filter(item => item.completed).length,
          'Progress Log Entries': assignment.progressLog.length,
          'Owner ID': assignment.ownerId,
          'Created Date': format(toDate(assignment.createdAt), 'yyyy-MM-dd'),
          'Last Updated': assignment.updatedAt ? format(toDate(assignment.updatedAt), 'yyyy-MM-dd') : ''
        };
      });

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Auto-size columns
      const columnWidths: Array<{wch: number}> = [];
      const headers = Object.keys(exportData[0] || {});
      
      headers.forEach((header, index) => {
        const maxLength = Math.max(
          header.length,
          ...exportData.map(row => String(row[header as keyof typeof row] || '').length)
        );
        columnWidths[index] = { wch: Math.min(maxLength + 2, 50) };
      });
      
      worksheet['!cols'] = columnWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Assignments');

      const filename = `assignments_export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      XLSX.writeFile(workbook, filename);
      
      console.log(`Exported ${exportData.length} assignments to ${filename}`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export data to Excel. Please try again.');
    }
  };

  const stats = calculateStats();

  // Show loading spinner while fetching data
  if (pageLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Remove auto-save from title and description
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditTitle(e.target.value);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditDescription(e.target.value);
  };

  const handleDueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditDueDate(e.target.value);
  };

  const handleOneDriveLinkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditOneDriveLink(e.target.value);
  };

  return (
    <div className="h-full flex bg-gray-50 overflow-hidden">
      {/* Left Panel - Assignment List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full min-h-0">
        {/* Fixed Header */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>
            <button
              onClick={handleAdd}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors text-sm"
            >
              <Plus className="h-4 w-4" />
              New
            </button>
          </div>
          
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
          </div>
          
          {/* Filters */}
          <div className="flex flex-col gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AssignmentStatus | 'All')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              <option value="All">All Statuses</option>
              {ASSIGNMENT_STATUSES.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
            
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={(e) => setHideCompleted(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
              />
              <span className="text-gray-700">Hide Completed</span>
            </label>
          </div>
        </div>

        {/* Scrollable Assignment List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {error ? (
            <div className="p-6 text-center text-gray-500">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-300" />
              <p className="text-sm">Error loading assignments</p>
            </div>
          ) : filteredAndSortedAssignments.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <Target className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No assignments found</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {filteredAndSortedAssignments.map((assignment) => {
                const progress = getAssignmentProgress(assignment);
                const isOverdue = isAssignmentOverdue(assignment);
                const isSelected = selectedAssignment?.taskId === assignment.taskId;
                
                return (
                  <div
                    key={assignment.taskId}
                    onClick={() => handleRowClick(assignment)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-primary-500 bg-primary-50 shadow-md' 
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    {/* Assignment Info */}
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white text-sm">
                        <Target className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">{assignment.title}</h3>
                      </div>
                    </div>

                    {/* Time Indicator and Progress */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs text-gray-500">
                        {assignment.dueDate ? (
                          isOverdue ? (
                            <span className="text-red-600 font-medium">Overdue</span>
                          ) : (
                            <span>
                              {isToday(toDate(assignment.dueDate)) ? 'Due today' :
                               isTomorrow(toDate(assignment.dueDate)) ? 'Due tomorrow' :
                               `${Math.ceil((toDate(assignment.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days left`}
                            </span>
                          )
                        ) : (
                          <span>No due date</span>
                        )}
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(assignment.status)}`}>
                        {ASSIGNMENT_STATUSES.find(s => s.value === assignment.status)?.label}
                      </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            assignment.status === 'done' ? 'bg-green-500' : 'bg-primary-500'
                          }`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600 font-medium">{Math.round(progress)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Assignment Details */}
      <div className="flex-1 bg-white flex flex-col h-full min-h-0">
        {selectedAssignment ? (
          <>
            {/* Fixed Header */}
            <div className="p-6 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <input
                    className="text-2xl font-bold text-gray-900 bg-transparent border-b border-gray-200 focus:outline-none focus:border-primary-500 w-full"
                    value={editTitle}
                    onChange={handleTitleChange}
                    placeholder="Assignment title..."
                  />
                </div>
              </div>
            </div>

            {/* Scrollable Assignment Details */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 relative min-h-0">
              {/* Floating Save Button */}
              {hasUnsavedChanges && (
                <div className="fixed bottom-6 right-6 z-50">
                  <button
                    onClick={handleSaveAll}
                    className="px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-lg"
                  >
                    Save Changes
                  </button>
                </div>
              )}

              {/* Dates and Status */}
              <div className="grid grid-cols-3 gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Start Date</p>
                    <p className="font-semibold text-gray-900">
                      {format(toDate(selectedAssignment.createdAt), 'dd MMM, yyyy')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-orange-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">Due Date</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={handleDueDateChange}
                        className="font-semibold text-gray-900 bg-transparent border-b border-gray-200 focus:outline-none focus:border-primary-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">Status</p>
                    <select 
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as AssignmentStatus)}
                      className="font-semibold text-gray-900 bg-transparent border-b border-gray-200 focus:outline-none focus:border-primary-500"
                    >
                      {ASSIGNMENT_STATUSES.map(status => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Editable Title and Description Card */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Description</h3>
                    <p className="text-sm text-gray-600">Detailed information about the assignment</p>
                  </div>
                </div>
                <textarea
                  className="w-full p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none text-gray-700 leading-relaxed"
                  value={editDescription}
                  onChange={handleDescriptionChange}
                  placeholder="Assignment description..."
                  rows={3}
                />
              </div>

              {/* Checklist Card */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <CheckSquare className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Checklist ({Math.round(getAssignmentProgress({ ...selectedAssignment, checklist: editChecklist }))}%)</h3>
                      <p className="text-sm text-gray-600">Track progress with actionable items</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {editChecklist.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleChecklistToggle(index)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                      />
                      <input
                        className={`flex-1 bg-transparent border-b border-gray-200 focus:outline-none focus:border-primary-500 ${item.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}
                        value={item.label}
                        onChange={e => handleChecklistEdit(index, e.target.value)}
                      />
                      <button onClick={() => handleChecklistRemove(index)} className="text-gray-400 hover:text-red-600 p-1">
                        <span className="sr-only">Remove</span>
                        &times;
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 mt-2">
                    <input
                      className="flex-1 bg-transparent border-b border-gray-200 focus:outline-none focus:border-primary-500 text-gray-900"
                      placeholder="Add new item..."
                      value={newChecklistItem}
                      onChange={e => setNewChecklistItem(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleChecklistAdd(); }}
                    />
                    <button onClick={handleChecklistAdd} className="text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded">
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress Log Card */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <Activity className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Progress Log</h3>
                    <p className="text-sm text-gray-600">Track updates and milestones</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {/* Add Progress Log Entry */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <textarea
                      placeholder="Add progress update..."
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                      rows={3}
                    />
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2">
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                          <Paperclip className="h-4 w-4" />
                        </button>
                        <span className="text-xs text-gray-500">OneDrive links only</span>
                      </div>
                      <button className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors">
                        Add Entry
                      </button>
                    </div>
                  </div>

                  {/* Progress Log Entries */}
                  <div className="space-y-4">
                    {selectedAssignment.progressLog.length > 0 ? (
                      selectedAssignment.progressLog.map((entry, index) => (
                        <div key={index} className="border-b border-gray-200 pb-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-xs font-medium">
                              {entry.userId ? getUserName(entry.userId).substring(0, 2).toUpperCase() : 'U'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900">{entry.userId ? getUserName(entry.userId) : 'Unknown User'}</span>
                                <span className="text-sm text-gray-500">
                                  ({formatDistanceToNow(toDate(entry.timestamp), { addSuffix: true })})
                                </span>
                              </div>
                              <p className="text-gray-700">{entry.message}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <Activity className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm">No progress log entries yet</p>
                        <p className="text-xs mt-1">Add your first progress update above</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Files Card */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <FileText className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Files</h3>
                      <p className="text-sm text-gray-600">OneDrive links and shared documents</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {editOneDriveLink && !isEditingLink ? (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {(() => {
                        const { type, icon: IconComponent } = getDocumentTypeAndIcon(editOneDriveLink);
                        const colorClass = getDocumentColor(type);
                        return (
                          <div className={`w-10 h-10 ${colorClass} rounded-lg flex items-center justify-center`}>
                            <IconComponent className="h-5 w-5" />
                          </div>
                        );
                      })()}
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {editOneDriveTitle || `${getDocumentTypeAndIcon(editOneDriveLink).type.charAt(0).toUpperCase() + 
                           getDocumentTypeAndIcon(editOneDriveLink).type.slice(1)} Document`}
                        </p>
                        <p className="text-sm text-gray-500">
                          {getDocumentTypeAndIcon(editOneDriveLink).type.charAt(0).toUpperCase() + 
                           getDocumentTypeAndIcon(editOneDriveLink).type.slice(1)} • OneDrive
                        </p>
                      </div>
                      <a 
                        href={editOneDriveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Open in OneDrive"
                      >
                        <FileText className="h-4 w-4" />
                      </a>
                      <button onClick={() => setIsEditingLink(true)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                        Edit
                      </button>
                      <button onClick={handleLinkRemove} className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-200 rounded-lg transition-colors">
                        Remove
                      </button>
                    </div>
                  ) : isEditingLink ? (
                    <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">File Title</label>
                        <input
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
                          placeholder="Enter a descriptive title for this file..."
                          value={editOneDriveTitle}
                          onChange={(e) => setEditOneDriveTitle(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">OneDrive Link</label>
                        <input
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
                          placeholder="Paste OneDrive link..."
                          value={editOneDriveLink}
                          onChange={(e) => setEditOneDriveLink(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setIsEditingLink(false)} className="px-3 py-2 text-gray-600 hover:text-gray-800 font-medium rounded-lg">
                          Cancel
                        </button>
                        <button onClick={() => setIsEditingLink(false)} className="px-3 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors">
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <FileText className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No files linked yet</p>
                      <button onClick={() => setIsEditingLink(true)} className="mt-2 text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded">
                        + Add OneDrive Link
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No assignment selected</h3>
              <p className="text-sm">Select an assignment from the list to view its details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Assignments; 