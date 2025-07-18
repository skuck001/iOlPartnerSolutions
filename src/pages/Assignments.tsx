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
  User,
  Target,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAssignmentsApi } from '../hooks/useAssignmentsApi';
import { useAuth } from '../hooks/useAuth';
import { ASSIGNMENT_STATUSES } from '../types/Assignment';
import type { Assignment, AssignmentStatus } from '../types';
import { format, formatDistanceToNow, isAfter, isBefore, startOfDay } from 'date-fns';

type SortField = 'title' | 'status' | 'dueDate' | 'createdAt' | 'progress';
type SortDirection = 'asc' | 'desc';

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
    loading, 
    error 
  } = useAssignmentsApi();

  const [pageLoading, setPageLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | 'All'>('All');
  const [hideCompleted, setHideCompleted] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchAssignments();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!loading) {
      setPageLoading(false);
    }
  }, [loading]);

  const fetchAssignments = async () => {
    try {
      await getAssignments();
    } catch (error) {
      console.error('Error fetching assignments:', error);
      setPageLoading(false);
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
    navigate(`/assignments/${assignment.taskId}`);
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

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Assignments</h1>
            <p className="text-sm text-gray-600 mt-1">
              {filteredAndSortedAssignments.length} of {assignments?.length || 0} assignments
            </p>
          </div>
        </div>
        
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search assignments, task IDs, or details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Hide Completed Checkbox */}
            <label className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 rounded-lg bg-white shadow-sm hover:bg-gray-50 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={hideCompleted}
                onChange={(e) => setHideCompleted(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
              />
              <span className="text-sm text-gray-700 whitespace-nowrap">Hide Completed</span>
            </label>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AssignmentStatus | 'All')}
              className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white shadow-sm"
            >
              <option value="All">All Statuses</option>
              {ASSIGNMENT_STATUSES.map(status => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {pageLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <AlertTriangle className="h-12 w-12 text-red-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error loading assignments</h3>
            <p className="text-sm text-gray-500 mb-4">{String(error)}</p>
            <button
              onClick={fetchAssignments}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredAndSortedAssignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Target className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'All' || hideCompleted 
                ? 'Try adjusting your search or filters' 
                : 'Get started by creating your first assignment'}
            </p>
            {!searchTerm && statusFilter === 'All' && !hideCompleted && (
              <button
                onClick={handleAdd}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Assignment
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg mx-6 mb-6 overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('title')}
                    >
                      <div className="flex items-center">
                        Assignment
                        {getSortIcon('title')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center">
                        Status
                        {getSortIcon('status')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('progress')}
                    >
                      <div className="flex items-center">
                        Progress
                        {getSortIcon('progress')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('dueDate')}
                    >
                      <div className="flex items-center">
                        Due Date
                        {getSortIcon('dueDate')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className="flex items-center">
                        Created
                        {getSortIcon('createdAt')}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedAssignments.map((assignment) => {
                    const progress = getAssignmentProgress(assignment);
                    const isOverdue = isAssignmentOverdue(assignment);
                    
                    return (
                      <tr
                        key={assignment.taskId}
                        onClick={() => handleRowClick(assignment)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        {/* Assignment Title & ID */}
                        <td className="px-6 py-4">
                          <div className="flex items-start">
                            <Target className="h-4 w-4 text-gray-400 mr-2 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {assignment.title}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                ID: {assignment.taskId}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(assignment.status)}`}>
                            {ASSIGNMENT_STATUSES.find(s => s.value === assignment.status)?.label}
                          </span>
                        </td>

                        {/* Progress */}
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-300 ${
                                  assignment.status === 'done' ? 'bg-green-500' : 'bg-primary-500'
                                }`}
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {assignment.checklist.filter(item => item.completed).length} / {assignment.checklist.length} tasks
                          </div>
                        </td>

                        {/* Due Date */}
                        <td className="px-6 py-4">
                          {assignment.dueDate ? (
                            <div className="flex items-center">
                              <Calendar className={`h-4 w-4 mr-2 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`} />
                              <div>
                                <div className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                                  {format(toDate(assignment.dueDate), 'MMM d, yyyy')}
                                </div>
                                {isOverdue && (
                                  <div className="flex items-center gap-1 text-xs text-red-600">
                                    <AlertTriangle className="h-3 w-3" />
                                    Overdue
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">No due date</span>
                          )}
                        </td>

                        {/* Created Date */}
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 text-gray-400 mr-2" />
                            <div>
                              <div className="text-sm text-gray-900">
                                {format(toDate(assignment.createdAt), 'MMM d, yyyy')}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatDistanceToNow(toDate(assignment.createdAt), { addSuffix: true })}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Details */}
                        <td className="px-6 py-4">
                          <div className="max-w-48">
                            {assignment.details ? (
                              <p className="text-sm text-gray-900 line-clamp-2">
                                {assignment.details}
                              </p>
                            ) : (
                              <span className="text-sm text-gray-500 italic">No details</span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/assignments/${assignment.taskId}`);
                              }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/assignments/${assignment.taskId}`);
                              }}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                              title="Edit Assignment"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        {/* Export Button */}
        <button
          onClick={handleExportToExcel}
          className="group relative inline-flex items-center justify-center w-14 h-14 bg-green-600 text-white rounded-full hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-500 focus:ring-opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl"
          title={`Export ${filteredAndSortedAssignments.length} assignments to Excel`}
        >
          <Download className="h-6 w-6" />
          <span className="absolute right-16 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            Export Excel ({filteredAndSortedAssignments.length})
          </span>
        </button>

        {/* New Assignment Button */}
        <button
          onClick={handleAdd}
          className="group relative inline-flex items-center justify-center w-14 h-14 bg-primary-600 text-white rounded-full hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-500 focus:ring-opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl"
          title="Create New Assignment"
        >
          <Plus className="h-6 w-6" />
          <span className="absolute right-16 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            New Assignment
          </span>
        </button>
      </div>

      {/* Mobile Floating Action Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3 z-40">
        <button
          onClick={handleExportToExcel}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors shadow-sm"
          title={`Export ${filteredAndSortedAssignments.length} assignments to Excel`}
        >
          <Download className="h-5 w-5" />
          <span>Export ({filteredAndSortedAssignments.length})</span>
        </button>
        <button
          onClick={handleAdd}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50 transition-colors shadow-sm"
        >
          <Plus className="h-5 w-5" />
          <span>New</span>
        </button>
      </div>
    </div>
  );
};

export default Assignments; 