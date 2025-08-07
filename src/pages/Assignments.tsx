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
  File,
  MessageSquare,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  Circle,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  X,
  Users
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAssignmentsApi } from '../hooks/useAssignmentsApi';
import { useAuth } from '../hooks/useAuth';
import { useUsersApi } from '../hooks/useUsersApi';
import { 
  ASSIGNMENT_STATUSES, 
  ASSIGNMENT_ACTIVITY_TYPES, 
  ASSIGNMENT_ACTIVITY_METHODS, 
  ASSIGNMENT_ACTIVITY_PRIORITIES, 
  ASSIGNMENT_ACTIVITY_STATUSES 
} from '../types/Assignment';
import type { Assignment, AssignmentStatus } from '../types';
import type { AssignmentActivity, AssignmentActivityStatus } from '../types/Assignment';
import { format, formatDistanceToNow, isAfter, isBefore, startOfDay, addDays, isToday, isTomorrow, isThisWeek, isPast, isSameDay } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

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
    createAssignment,
    updateAssignment,
    addChecklistItem,
    updateChecklistItem,
    removeChecklistItem,
    // Activity management methods
    addActivityToAssignment,
    updateActivityInAssignment,
    removeActivityFromAssignment,
    getActivitiesByAssignment,
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
  const [editChecklist, setEditChecklist] = useState(() => {
    if (selectedAssignment?.checklist) {
      return selectedAssignment.checklist.map(item => ({
        ...item,
        text: item.text || (item as any).label || ''
      }));
    }
    return [];
  });
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newChecklistDueDate, setNewChecklistDueDate] = useState('');

  // --- OneDrive link editing state and handlers ---
  const [editOneDriveLink, setEditOneDriveLink] = useState(selectedAssignment?.oneDriveLink || '');
  const [editOneDriveTitle, setEditOneDriveTitle] = useState(selectedAssignment?.oneDriveTitle || '');
  const [isEditingLink, setIsEditingLink] = useState(false);
  // Inline due date editing state
  const [editingDueDate, setEditingDueDate] = useState<string | null>(null);

  // --- Save button state and handlers ---
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [editStatus, setEditStatus] = useState<AssignmentStatus>('todo');

  // --- Activity management state ---
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<AssignmentActivity | null>(null);
  const [activitiesDisplayCount, setActivitiesDisplayCount] = useState(5);
  const [activityFormData, setActivityFormData] = useState({
    activityType: 'Update' as (typeof ASSIGNMENT_ACTIVITY_TYPES)[number],
    dateTime: new Date(),
    method: 'Document' as (typeof ASSIGNMENT_ACTIVITY_METHODS)[number],
    subject: '',
    notes: '',
    assignedTo: currentUser?.uid || 'system',
    relatedContactIds: [] as string[],
    attachments: [] as string[],
    followUpNeeded: false,
    status: 'Scheduled' as AssignmentActivityStatus,
    followUpDate: undefined as Date | undefined,
    followUpSubject: '',
    priority: 'Medium' as (typeof ASSIGNMENT_ACTIVITY_PRIORITIES)[number]
  });

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
    if (selectedAssignment?.checklist) {
      // Handle field name migration from 'label' to 'text'
      const migratedChecklist = selectedAssignment.checklist.map(item => ({
        ...item,
        text: item.text || (item as any).label || ''
      }));
      setEditChecklist(migratedChecklist);
    } else {
      setEditChecklist([]);
    }
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
      const firstAssignment = assignments[0];
      // Initialize activities array if it doesn't exist (backward compatibility)
      if (!firstAssignment.activities) {
        firstAssignment.activities = [];
      }
      setSelectedAssignment(firstAssignment);
    }
  }, [assignments, selectedAssignment]);

  // Initialize activities array when selectedAssignment changes
  useEffect(() => {
    if (selectedAssignment && !selectedAssignment.activities) {
      setSelectedAssignment(prev => prev ? { ...prev, activities: [] } : null);
    }
  }, [selectedAssignment]);

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
      const updated = editChecklist.map((item, i) => i === idx ? { ...item, text: value } : item);
      setEditChecklist(updated);
      try {
        await updateChecklistItem({
          taskId: selectedAssignment.taskId,
          itemId: item.id,
          text: value
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
      const tempItem = { 
        id: Date.now().toString(), 
        text: newChecklistItem, 
        completed: false,
        dueDate: newChecklistDueDate ? new Date(newChecklistDueDate) : undefined
      };
      const updated = [...editChecklist, tempItem];
      setEditChecklist(updated);
      setNewChecklistItem('');
      setNewChecklistDueDate('');
      try {
        await addChecklistItem({
          taskId: selectedAssignment.taskId,
          text: newChecklistItem.trim(),
          completed: false,
          dueDate: newChecklistDueDate || undefined
        });
      } catch (error) {
        console.error('Error adding checklist item:', error);
        // Revert on error
        setEditChecklist(selectedAssignment.checklist);
        setNewChecklistItem(newChecklistItem);
        setNewChecklistDueDate(newChecklistDueDate);
      }
    }
  };

  const handleLinkRemove = () => {
    setEditOneDriveLink('');
    setEditOneDriveTitle('');
  };

  // Inline due date editing helpers
  const handleQuickDueDate = async (itemId: string, type: 'today' | 'tomorrow' | 'next-week') => {
    if (!selectedAssignment) return;
    
    const today = new Date();
    let dueDate: Date;
    
    switch (type) {
      case 'today':
        dueDate = today;
        break;
      case 'tomorrow':
        dueDate = new Date(today);
        dueDate.setDate(today.getDate() + 1);
        break;
      case 'next-week':
        dueDate = new Date(today);
        dueDate.setDate(today.getDate() + 7);
        break;
    }

    // Update local state immediately
    setEditChecklist(prev => prev.map(item =>
      item.id === itemId ? { ...item, dueDate } : item
    ));

    // Persist to backend
    try {
      await updateChecklistItem({
        taskId: selectedAssignment.taskId,
        itemId: itemId,
        dueDate: dueDate.toISOString()
      });
    } catch (error) {
      console.error('Error updating checklist item due date:', error);
      // Revert on error
      setEditChecklist(prev => prev.map(item =>
        item.id === itemId ? { ...selectedAssignment.checklist.find(i => i.id === itemId)! } : item
      ));
    }
  };

  const handleInlineDueDateEdit = async (itemId: string, dateStr: string) => {
    if (!selectedAssignment) return;
    
    const dueDate = dateStr ? new Date(dateStr) : undefined;
    
    // Update local state immediately
    setEditChecklist(prev => prev.map(item =>
      item.id === itemId ? { ...item, dueDate } : item
    ));
    setEditingDueDate(null);

    // Persist to backend
    try {
      await updateChecklistItem({
        taskId: selectedAssignment.taskId,
        itemId: itemId,
        dueDate: dueDate ? dueDate.toISOString() : null // Use null to clear the date
      });
    } catch (error) {
      console.error('Error updating checklist item due date:', error);
      // Revert on error
      setEditChecklist(prev => prev.map(item =>
        item.id === itemId ? { ...selectedAssignment.checklist.find(i => i.id === itemId)! } : item
      ));
    }
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
        // Check if this is a new assignment (taskId starts with 'new-')
        const isNewAssignment = selectedAssignment.taskId.startsWith('new-');
        
        if (isNewAssignment) {
          // Create new assignment
          const newAssignment = await createAssignment({
            title: editTitle,
            details: editDescription,
            status: editStatus,
            dueDate: editDueDate || undefined,
            oneDriveLink: editOneDriveLink || undefined,
            oneDriveTitle: editOneDriveTitle || undefined,
            ownerId: currentUser?.uid || ''
          });
          
          // Update the selected assignment with the real data
          setSelectedAssignment(newAssignment);
          setHasUnsavedChanges(false);
          
          // Refresh the assignments list
          await getAssignments();
        } else {
          // Update existing assignment
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
            
            // Refresh the assignments list
            await getAssignments();
          }
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
    // Initialize activities array if it doesn't exist (backward compatibility)
    if (!assignment.activities) {
      assignment.activities = [];
    }
    setSelectedAssignment(assignment);
  };

  const handleAdd = () => {
    // Create a new blank assignment and select it
    const newAssignment: Assignment = {
      taskId: 'new-' + Date.now(),
      title: 'New Assignment',
      details: '',
      status: 'todo',
      checklist: [],
      progressLog: [],
      activities: [],
      ownerId: currentUser?.uid || '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    setSelectedAssignment(newAssignment);
    setEditTitle('New Assignment');
    setEditDescription('');
    setEditStatus('todo');
    setEditDueDate('');
    setEditOneDriveLink('');
    setEditOneDriveTitle('');
    setEditChecklist([]);
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
      // Ensure assignment has required properties
      if (!assignment || !assignment.title || !assignment.taskId) {
        console.warn('Invalid assignment found:', assignment);
        return false;
      }
      
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
          aValue = (a.title || '').toLowerCase();
          bValue = (b.title || '').toLowerCase();
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

  // ============================================================================
  // ACTIVITY MANAGEMENT HELPER FUNCTIONS
  // ============================================================================

  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'Meeting': return Calendar;
      case 'Call': return Phone;
      case 'Email': return Mail;
      case 'WhatsApp': return MessageSquare;
      case 'Demo': return Video;
      case 'Workshop': return Users;
      case 'Review': return CheckCircle2;
      case 'Update': return Edit3;
      default: return FileText;
    }
  };

  const getActivityStatusColor = (status: AssignmentActivityStatus) => {
    switch (status) {
      case 'Scheduled': return 'bg-blue-100 text-blue-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: 'High' | 'Medium' | 'Low') => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddActivity = async () => {
    if (!selectedAssignment || !activityFormData.subject.trim()) return;

    // Validate required fields before sending
    if (!activityFormData.assignedTo || !currentUser?.uid) {
      console.error('Missing assigned user');
      return;
    }

    const activityData: any = {
      taskId: selectedAssignment.taskId,
      activityType: activityFormData.activityType,
      dateTime: activityFormData.dateTime.toISOString(),
      method: activityFormData.method,
      subject: activityFormData.subject,
      notes: activityFormData.notes || '', // Ensure notes is always a string
      assignedTo: activityFormData.assignedTo || currentUser.uid, // Ensure assignedTo is not empty
      relatedContactIds: activityFormData.relatedContactIds || [],
      attachments: activityFormData.attachments || [],
      followUpNeeded: Boolean(activityFormData.followUpNeeded), // Ensure it's always a boolean
      status: activityFormData.status,
      priority: activityFormData.priority,
    };
    
    // Only add optional fields if they have values
    if (activityFormData.followUpDate) {
      activityData.followUpDate = activityFormData.followUpDate.toISOString();
    }
    if (activityFormData.followUpSubject) {
      activityData.followUpSubject = activityFormData.followUpSubject;
    }

    console.log('📤 Sending activity data to backend:');
    console.log('Raw form data:', activityFormData);
    console.log('Processed activity data:', activityData);
    
    // Validate all required fields locally
    const requiredFields = ['taskId', 'activityType', 'dateTime', 'method', 'subject', 'assignedTo', 'status'];
    const missingFields = requiredFields.filter(field => {
      const value = activityData[field as keyof typeof activityData];
      return value === undefined || value === null || value === '';
    });
    
    // Special check for boolean field
    if (activityData.followUpNeeded === undefined || activityData.followUpNeeded === null) {
      missingFields.push('followUpNeeded');
    }
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      alert(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    try {
      await addActivityToAssignment(activityData);

      // Reset form and close
      setActivityFormData({
        activityType: 'Update' as (typeof ASSIGNMENT_ACTIVITY_TYPES)[number],
        dateTime: new Date(),
        method: 'Document' as (typeof ASSIGNMENT_ACTIVITY_METHODS)[number],
        subject: '',
        notes: '',
        assignedTo: currentUser?.uid || 'system',
        relatedContactIds: [],
        attachments: [],
        followUpNeeded: false,
        status: 'Scheduled' as AssignmentActivityStatus,
        followUpDate: undefined,
        followUpSubject: '',
        priority: 'Medium' as (typeof ASSIGNMENT_ACTIVITY_PRIORITIES)[number]
      });
      setShowActivityForm(false);

      // Refresh assignments to get updated data
      await getAssignments();
    } catch (err: any) {
      console.error('Failed to add activity:', err);
      console.error('Error details:', JSON.stringify(err.details, null, 2));
      console.error('Full error object:', JSON.stringify(err, null, 2));
      
      // Show detailed validation errors if available
      if (err.message?.includes('Validation failed') && err.details?.errors) {
        const errorMessages = err.details.errors.map((error: any) => 
          `${error.field}: ${error.message}`
        ).join('\n');
        alert(`Validation errors:\n${errorMessages}`);
      } else if (err.message?.includes('Validation failed')) {
        // Try to extract validation details from different possible locations
        const detailsStr = err.details ? JSON.stringify(err.details, null, 2) : 'No details available';
        console.error('Validation failed but no errors array found. Details:', detailsStr);
        alert(`Validation error: Please check all required fields are filled correctly.\n\nSee console for details.`);
      } else {
        alert('Failed to add activity. Please try again.');
      }
    }
  };

  const handleCompleteActivity = async (activityId: string) => {
    if (!selectedAssignment) return;

    try {
      await updateActivityInAssignment({
        taskId: selectedAssignment.taskId,
        activityId,
        status: 'Completed',
        completedAt: new Date().toISOString()
      });

      // Refresh assignments
      await getAssignments();
    } catch (err) {
      console.error('Failed to complete activity:', err);
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!selectedAssignment) return;

    try {
      await removeActivityFromAssignment({
        taskId: selectedAssignment.taskId,
        activityId
      });

      // Refresh assignments
      await getAssignments();
    } catch (err) {
      console.error('Failed to delete activity:', err);
    }
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
                    <div key={item.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleChecklistToggle(index)}
                        className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
                      />
                      <div className="flex-1 min-w-0">
                        <input
                          className={`w-full bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200 ${item.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}
                          value={item.text || (item as any).label || ''}
                          onChange={e => handleChecklistEdit(index, e.target.value)}
                          placeholder="Enter checklist item..."
                        />
                        {/* Due date with inline editing */}
                        {editingDueDate === item.id ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="date"
                              defaultValue={item.dueDate ? format(new Date(item.dueDate), 'yyyy-MM-dd') : ''}
                              onBlur={(e) => handleInlineDueDateEdit(item.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleInlineDueDateEdit(item.id, e.currentTarget.value);
                                } else if (e.key === 'Escape') {
                                  setEditingDueDate(null);
                                }
                              }}
                              className="text-xs border border-blue-300 rounded px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                              autoFocus
                            />
                            <button
                              onClick={() => handleInlineDueDateEdit(item.id, '')}
                              className="text-xs text-red-500 hover:text-red-700"
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>
                        ) : item.dueDate ? (
                          <div className="group relative">
                            <div 
                              className={`text-xs mt-1 flex items-center gap-1 cursor-pointer hover:bg-blue-50 rounded px-1 py-0.5 transition-colors ${
                                new Date(item.dueDate) < new Date() && !item.completed ? 'text-red-600 font-medium' : 'text-blue-600'
                              }`}
                              onClick={() => setEditingDueDate(item.id)}
                              title="Click to edit due date"
                            >
                              <Calendar className="h-3 w-3" />
                              <span>Due {format(new Date(item.dueDate), 'MMM d, yyyy')}</span>
                              {new Date(item.dueDate) < new Date() && !item.completed && ' (Overdue)'}
                            </div>
                            
                            {/* Quick action buttons on hover */}
                            <div className="absolute left-full ml-2 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="flex items-center gap-1 bg-white shadow-lg border rounded-lg p-1">
                                <button
                                  onClick={() => handleQuickDueDate(item.id, 'today')}
                                  className="text-xs px-2 py-1 hover:bg-blue-50 rounded whitespace-nowrap"
                                >
                                  Today
                                </button>
                                <button
                                  onClick={() => handleQuickDueDate(item.id, 'tomorrow')}
                                  className="text-xs px-2 py-1 hover:bg-blue-50 rounded whitespace-nowrap"
                                >
                                  Tomorrow
                                </button>
                                <button
                                  onClick={() => handleQuickDueDate(item.id, 'next-week')}
                                  className="text-xs px-2 py-1 hover:bg-blue-50 rounded whitespace-nowrap"
                                >
                                  Next Week
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingDueDate(item.id)}
                            className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 px-1 py-0.5 hover:bg-blue-50 rounded transition-colors mt-1"
                          >
                            <Calendar className="h-3 w-3" />
                            Add due date
                          </button>
                        )}
                      </div>
                      <button onClick={() => handleChecklistRemove(index)} className="text-gray-400 hover:text-red-600 p-1">
                        <span className="sr-only">Remove</span>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <div className="space-y-2 mt-3">
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 bg-transparent border-b border-gray-200 focus:outline-none focus:border-primary-500 text-gray-900"
                        placeholder="Add new item..."
                        value={newChecklistItem}
                        onChange={e => setNewChecklistItem(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleChecklistAdd(); }}
                      />
                      <input
                        type="date"
                        value={newChecklistDueDate}
                        onChange={(e) => setNewChecklistDueDate(e.target.value)}
                        className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        title="Due date (optional)"
                      />
                      <button onClick={handleChecklistAdd} className="text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded">
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Activities & Timeline Card */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Activities & Timeline</h3>
                      <p className="text-sm text-gray-600">Track activities, meetings, and progress</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowActivityForm(!showActivityForm)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add Activity
                  </button>
                </div>

                {/* Activity Form */}
                {showActivityForm && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Activity Type</label>
                        <select
                          value={activityFormData.activityType}
                          onChange={(e) => setActivityFormData(prev => ({ ...prev, activityType: e.target.value as any }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          {ASSIGNMENT_ACTIVITY_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                        <select
                          value={activityFormData.method}
                          onChange={(e) => setActivityFormData(prev => ({ ...prev, method: e.target.value as any }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          {ASSIGNMENT_ACTIVITY_METHODS.map(method => (
                            <option key={method} value={method}>{method}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                        <input
                          type="datetime-local"
                          value={format(activityFormData.dateTime, "yyyy-MM-dd'T'HH:mm")}
                          onChange={(e) => setActivityFormData(prev => ({ ...prev, dateTime: new Date(e.target.value) }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                        <select
                          value={activityFormData.priority}
                          onChange={(e) => setActivityFormData(prev => ({ ...prev, priority: e.target.value as any }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          {ASSIGNMENT_ACTIVITY_PRIORITIES.map(priority => (
                            <option key={priority} value={priority}>{priority}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                      <input
                        type="text"
                        value={activityFormData.subject}
                        onChange={(e) => setActivityFormData(prev => ({ ...prev, subject: e.target.value }))}
                        placeholder="Activity subject..."
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={activityFormData.notes}
                        onChange={(e) => setActivityFormData(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Activity notes..."
                        rows={3}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div className="mt-4 flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={activityFormData.followUpNeeded}
                          onChange={(e) => setActivityFormData(prev => ({ ...prev, followUpNeeded: e.target.checked }))}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700">Follow-up needed</span>
                      </label>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={handleAddActivity}
                        disabled={!activityFormData.subject.trim()}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 rounded-lg transition-colors"
                      >
                        Add Activity
                      </button>
                      <button
                        onClick={() => setShowActivityForm(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Activities List */}
                {selectedAssignment.activities && selectedAssignment.activities.length > 0 ? (
                  <div className="space-y-4">
                    {selectedAssignment.activities
                      .sort((a, b) => toDate(b.dateTime).getTime() - toDate(a.dateTime).getTime())
                      .slice(0, activitiesDisplayCount)
                      .map((activity) => {
                        const ActivityIcon = getActivityIcon(activity.activityType);
                        return (
                          <div key={activity.id} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="flex items-center justify-between p-3 hover:bg-gray-50">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <ActivityIcon className="h-5 w-5 text-gray-500" />
                                  <div className="flex-1">
                                    <h4 className="font-medium text-gray-900">{activity.subject}</h4>
                                    <div className="flex items-center gap-3 mt-1">
                                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getActivityStatusColor(activity.status)}`}>
                                        {activity.status}
                                      </span>
                                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(activity.priority || 'Medium')}`}>
                                        {activity.priority || 'Medium'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                  <span>📅 {format(toDate(activity.dateTime), 'MMM d, yyyy HH:mm')}</span>
                                  <span>📋 {activity.activityType} • {activity.method}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {activity.status === 'Scheduled' && (
                                  <button
                                    onClick={() => handleCompleteActivity(activity.id)}
                                    className="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded transition-colors flex items-center gap-1"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    Complete
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteActivity(activity.id)}
                                  className="text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            {activity.notes && (
                              <div className="px-3 pb-3 border-t border-gray-100">
                                <div className="text-sm text-gray-600 mt-2">
                                  {activity.notes}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                    {/* Show More/Less */}
                    {selectedAssignment.activities.length > 5 && (
                      <div className="text-center">
                        <button
                          onClick={() => setActivitiesDisplayCount(
                            activitiesDisplayCount === 5 ? selectedAssignment.activities!.length : 5
                          )}
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          {activitiesDisplayCount === 5 ? 
                            `Show all ${selectedAssignment.activities.length} activities` : 
                            'Show less'
                          }
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No activities yet</p>
                    <p className="text-xs mt-1">Add your first activity to start tracking progress</p>
                  </div>
                )}
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