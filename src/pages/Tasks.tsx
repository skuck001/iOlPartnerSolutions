import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { Task, TaskStatus, Opportunity, Activity, ActivityStatus, Account, Contact, ChecklistItem, User } from '../types';
import { ListView } from '../components/ListView';
import { TaskBoard } from '../components/TaskBoard';
import { ActivityManager } from '../components/ActivityManager';
import { useActivityManager } from '../hooks/useActivityManager';
import { useAccountsApi } from '../hooks/useAccountsApi';
import { useContactsApi } from '../hooks/useContactsApi';
import { useOpportunitiesApi } from '../hooks/useOpportunitiesApi';
import { useUsersApi } from '../hooks/useUsersApi';
import { format, addDays, startOfDay, isToday, isTomorrow, isThisWeek, isPast, isSameDay } from 'date-fns';
import { 
  LayoutGrid, 
  List, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Users, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  CheckSquare
} from 'lucide-react';

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

interface TaskStats {
  total: number;
  overdue: number;
  dueToday: number;
  scheduled: number;
  completed: number;
}

// Enhanced task interface that maps activities to tasks
interface EnhancedTask {
  id: string;
  title: string;
  opportunityId: string;
  opportunityTitle: string;
  accountName: string;
  assignedTo: string;
  dueDate: any; // Timestamp
  status: ActivityStatus; // Use actual activity status instead of mapped task status
  activityType: string;
  method: string;
  priority: 'High' | 'Medium' | 'Low';
  notes: string;
  relatedContacts: string[];
  bucket?: string;
}

interface OpportunityWithTodos {
  id: string;
  title: string;
  accountName: string;
  stage: string;
  uncompletedTodos: ChecklistItem[];
}

export const Tasks: React.FC = () => {
  // API hooks
  const { getOpportunities, updateOpportunity } = useOpportunitiesApi();
  const { fetchAccounts } = useAccountsApi();
  const { getContacts } = useContactsApi();
  const { getAllUsers, getUserDisplayNameById } = useUsersApi();
  
  // State
  const [activities, setActivities] = useState<EnhancedTask[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [opportunitiesWithTodos, setOpportunitiesWithTodos] = useState<OpportunityWithTodos[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'scheduled'>('scheduled');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const fetchData = useCallback(async () => {
    try {
      const [opportunitiesResult, accountsResult, contactsResult, usersData] = await Promise.all([
        getOpportunities(),
        fetchAccounts(),
        getContacts(),
        getAllUsers() // Now using Cloud Function
      ]);
      
      const opps = opportunitiesResult.opportunities;
      const accs = accountsResult.accounts;
      const cons = contactsResult.contacts;
      const usrs = usersData;
      
      setOpportunities(opps);
      setAccounts(accs);
      setContacts(cons);
      setUsers(usrs);
      
      // Extract activities from all opportunities and convert to enhanced tasks
      const allActivities: EnhancedTask[] = [];
      
      opps.forEach(opportunity => {
        const account = accs.find(a => a.id === opportunity.accountId);
        
        (opportunity.activities || []).forEach(activity => {
          // Get contact names
          const relatedContactNames = activity.relatedContactIds
            .map(contactId => {
              const contact = cons.find(c => c.id === contactId);
              return contact?.name || 'Unknown Contact';
            })
            .filter(name => name !== 'Unknown Contact');
          
          const taskId = `${opportunity.id}_${activity.id}`;
          const enhancedTask: EnhancedTask = {
            id: taskId,
            title: activity.subject,
            opportunityId: opportunity.id,
            opportunityTitle: opportunity.title,
            accountName: account?.name || 'Unknown Account',
            assignedTo: getUserDisplayNameById(activity.assignedTo, usrs),
            dueDate: activity.dateTime,
            status: activity.status, // Use actual activity status
            activityType: activity.activityType,
            method: activity.method,
            priority: activity.priority || 'Medium',
            notes: activity.notes,
            relatedContacts: relatedContactNames,
            bucket: opportunity.stage
          };
          
          allActivities.push(enhancedTask);
        });
      });
      
      setActivities(allActivities);

      // Process opportunities with uncompleted todos
      const oppsWithTodos: OpportunityWithTodos[] = opps
        .map(opp => {
          const account = accs.find(a => a.id === opp.accountId);
          const uncompletedTodos = (opp.checklist || []).filter(item => !item.completed);
          
          return {
            id: opp.id,
            title: opp.title,
            accountName: account?.name || 'Unknown Account',
            stage: opp.stage,
            uncompletedTodos
          };
        })
        .filter(opp => opp.uncompletedTodos.length > 0); // Only include opportunities with uncompleted todos
      
      setOpportunitiesWithTodos(oppsWithTodos);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [getOpportunities, fetchAccounts, getContacts, getAllUsers]);

  // Unified activity management
  const activityManager = useActivityManager({ 
    opportunities, 
    onDataRefresh: fetchData 
  });

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleTodoItem = async (opportunityId: string, itemId: string) => {
    try {
      const opportunity = opportunities.find(o => o.id === opportunityId);
      if (!opportunity) return;

      const updatedChecklist = opportunity.checklist?.map(item =>
        item.id === itemId 
          ? { ...item, completed: !item.completed, completedAt: !item.completed ? new Date() : undefined }
          : item
      ) || [];

      await updateOpportunity(opportunityId, {
        checklist: updatedChecklist,
        updatedAt: new Date()
      });

      // Refresh data
      await fetchData();
    } catch (error) {
      console.error('Error toggling todo item:', error);
    }
  };

  const getOpportunityTitle = (opportunityId: string) => {
    const opportunity = opportunities.find(o => o.id === opportunityId);
    return opportunity?.title || 'Unknown Opportunity';
  };

  const handleRowClick = (task: EnhancedTask) => {
    // Navigate to opportunity details instead of task details
    window.location.href = `/opportunities/${task.opportunityId}`;
  };

  const handleCompleteActivity = (taskId: string) => {
    const [opportunityId, activityId] = taskId.split('_');
    const opportunity = opportunities.find(o => o.id === opportunityId);
    const account = accounts.find(a => a.id === opportunity?.accountId);
    const activity = opportunity?.activities.find(a => a.id === activityId);

    if (opportunity && account && activity) {
      activityManager.openActivityCompletion(
        activity,
        opportunity.id,
        opportunity.title,
        account.name
      );
    }
  };



  // Calculate task statistics
  const calculateStats = (): TaskStats => {
    const now = new Date();
    const today = startOfDay(now);
    
    return {
      total: activities.length,
      overdue: activities.filter(task => 
        task.status === 'Scheduled' && isPast(safeDateConversion(task.dueDate)) && !isToday(safeDateConversion(task.dueDate))
      ).length,
      dueToday: activities.filter(task => 
        task.status === 'Scheduled' && isToday(safeDateConversion(task.dueDate))
      ).length,
      scheduled: activities.filter(task => task.status === 'Scheduled').length,
      completed: activities.filter(task => task.status === 'Completed').length
    };
  };

  // Get next 7 days for calendar
  const getNext7Days = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(new Date(), i));
    }
    return days;
  };

  // Get tasks for a specific date
  const getTasksForDate = (date: Date) => {
    return activities.filter(task => isSameDay(safeDateConversion(task.dueDate), date));
  };

  // Filter tasks based on search and selected date
  const filteredTasks = activities.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.assignedTo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.opportunityTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.activityType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = selectedDate ? isSameDay(safeDateConversion(task.dueDate), selectedDate) : true;
    
    return matchesSearch && matchesDate;
  });

  // Group tasks by date for scheduled view
  const groupTasksByDate = () => {
    const groups: { [key: string]: EnhancedTask[] } = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: []
    };

    filteredTasks.forEach(task => {
      const taskDate = safeDateConversion(task.dueDate);
      
      if (task.status === 'Completed' || task.status === 'Cancelled') return; // Skip completed/cancelled tasks in scheduled view
      
      if (isPast(taskDate) && !isToday(taskDate)) {
        groups.overdue.push(task);
      } else if (isToday(taskDate)) {
        groups.today.push(task);
      } else if (isTomorrow(taskDate)) {
        groups.tomorrow.push(task);
      } else if (isThisWeek(taskDate)) {
        groups.thisWeek.push(task);
      } else {
        groups.later.push(task);
      }
    });

    return groups;
  };

  const stats = calculateStats();
  const next7Days = getNext7Days();
  const groupedTasks = groupTasksByDate();

  const getStatusColor = (status: ActivityStatus) => {
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

  const getActivityIcon = (activityType: string) => {
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

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Discovery': return 'bg-blue-100 text-blue-800';
      case 'Proposal': return 'bg-yellow-100 text-yellow-800';
      case 'Negotiation': return 'bg-orange-100 text-orange-800';
      case 'Closed-Won': return 'bg-green-100 text-green-800';
      case 'Closed-Lost': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const columns = [
    { 
      key: 'title' as keyof EnhancedTask, 
      label: 'Activity',
      render: (title: string, task: EnhancedTask) => (
        <div className="flex items-center gap-2">
          <span className="text-lg">{getActivityIcon(task.activityType)}</span>
          <div>
            <div className="font-medium">{title}</div>
            <div className="text-sm text-gray-500">{task.activityType} • {task.method}</div>
          </div>
        </div>
      )
    },
    { 
      key: 'status' as keyof EnhancedTask, 
      label: 'Status',
      render: (status: ActivityStatus) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(status)}`}>
          {status}
        </span>
      )
    },
    { 
      key: 'priority' as keyof EnhancedTask, 
      label: 'Priority',
      render: (priority: 'High' | 'Medium' | 'Low') => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(priority)}`}>
          {priority}
        </span>
      )
    },
    { key: 'assignedTo' as keyof EnhancedTask, label: 'Assigned To' },
    { 
      key: 'dueDate' as keyof EnhancedTask, 
      label: 'Due Date',
      render: (dueDate: any) => format(safeDateConversion(dueDate), 'MMM d, yyyy')
    }
  ];

  // Group tasks by opportunity for list view
  const groupTasksByOpportunity = () => {
    const groups: { [key: string]: EnhancedTask[] } = {};
    
    filteredTasks.forEach(task => {
      const key = `${task.opportunityTitle} (${task.accountName})`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(task);
    });
    
    return groups;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-iol-red"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Activities & Tasks</h1>
            <p className="text-gray-600 mt-1">Track all scheduled activities and manage to-do items across opportunities</p>
          </div>
          <Link to="/opportunities/new" className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Opportunity
          </Link>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-red-50 rounded-lg p-4 border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Overdue</p>
                <p className="text-2xl font-bold text-red-900 mt-1">{stats.overdue}</p>
              </div>
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Due Today</p>
                <p className="text-2xl font-bold text-orange-900 mt-1">{stats.dueToday}</p>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Scheduled</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{stats.scheduled}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Completed</p>
                <p className="text-2xl font-bold text-green-900 mt-1">{stats.completed}</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 2 Column Layout */}
      <div className="flex-1 flex overflow-hidden gap-6 p-6">
        {/* Left Column - Calendar and Activities */}
        <div className="flex-1 flex flex-col bg-white rounded-lg shadow-sm">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 rounded-t-lg">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-iol-red" />
              Activities & Tasks
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Schedule and track activities across all opportunities
            </p>
          </div>



          {/* 7-Day Calendar View */}
          {viewMode === 'scheduled' && (
            <div className="px-6 py-3 bg-white border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">Next 7 Days</h3>
                {selectedDate && (
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="text-xs text-iol-red hover:text-red-400 transition-colors"
                  >
                    Clear filter
                  </button>
                )}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {next7Days.map((date, index) => {
                  const tasksCount = getTasksForDate(date).length;
                  const isSelected = selectedDate && isSameDay(date, selectedDate);
                  const isCurrentDay = isToday(date);
                  
                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(isSelected ? null : date)}
                      className={`p-2 rounded-md transition-all ${
                        isSelected 
                          ? 'bg-iol-red text-white shadow-lg' 
                          : isCurrentDay
                          ? 'bg-gray-200 text-blue-600 border border-blue-400'
                          : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                      }`}
                    >
                      <div className="text-center">
                        <p className={`text-xs font-medium ${
                          isSelected ? 'text-white' : isCurrentDay ? 'text-blue-600' : 'text-gray-500'
                        }`}>
                          {format(date, 'EEE')}
                        </p>
                        <p className={`text-sm font-bold mt-0.5 ${
                          isSelected ? 'text-white' : isCurrentDay ? 'text-blue-600' : 'text-gray-900'
                        }`}>
                          {format(date, 'd')}
                        </p>
                        {tasksCount > 0 && (
                          <div className={`mt-1 w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold mx-auto ${
                            isSelected 
                              ? 'bg-white text-iol-red'
                              : isCurrentDay
                              ? 'bg-blue-500 text-white'
                              : 'bg-iol-red text-white'
                          }`}>
                            {tasksCount}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

                     {/* Search Bar and View Mode Toggle */}
           <div className="px-6 py-3 bg-white border-b border-gray-200">
             <div className="flex items-center justify-between gap-4">
               <div className="relative max-w-md">
                 <input
                   type="text"
                   placeholder="Search activities..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="pl-4 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-iol-red focus:border-transparent"
                 />
               </div>
               <div className="flex items-center bg-gray-100 rounded-lg p-1">
                 <button
                   onClick={() => setViewMode('scheduled')}
                   className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                     viewMode === 'scheduled' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
                   }`}
                 >
                   <Calendar className="h-4 w-4 inline mr-1" />
                   Scheduled
                 </button>
                 <button
                   onClick={() => setViewMode('list')}
                   className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                     viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
                   }`}
                 >
                   <List className="h-4 w-4 inline mr-1" />
                   List
                 </button>
                 <button
                   onClick={() => setViewMode('board')}
                   className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                     viewMode === 'board' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-600'
                   }`}
                 >
                   <LayoutGrid className="h-4 w-4 inline mr-1" />
                   Board
                 </button>
               </div>
             </div>
           </div>

          {/* Activities Content */}
          <div className="flex-1 overflow-hidden">
            {viewMode === 'scheduled' ? (
              <div className="h-full overflow-auto p-6">
                <div className="space-y-6">
                  {Object.entries(groupedTasks).map(([groupKey, groupTasks]) => {
                    if (groupTasks.length === 0) return null;
                    
                    const groupTitles = {
                      overdue: 'Overdue',
                      today: 'Today',
                      tomorrow: 'Tomorrow',
                      thisWeek: 'This Week',
                      later: 'Later'
                    };

                    const groupColors = {
                      overdue: 'text-red-600 border-red-200',
                      today: 'text-orange-600 border-orange-200',
                      tomorrow: 'text-blue-600 border-blue-200',
                      thisWeek: 'text-purple-600 border-purple-200',
                      later: 'text-gray-600 border-gray-200'
                    };

                    return (
                      <div key={groupKey} className="bg-white rounded-lg border border-gray-200">
                        <div className={`px-4 py-3 border-b ${groupColors[groupKey as keyof typeof groupColors]}`}>
                          <h3 className="font-medium">
                            {groupTitles[groupKey as keyof typeof groupTitles]} ({groupTasks.length})
                          </h3>
                        </div>
                        <div className="p-4 space-y-4">
                          {groupTasks.map((task) => (
                            <div
                              key={task.id}
                              className="border border-gray-200 rounded-lg overflow-hidden"
                            >
                              {/* Main task content */}
                              <div
                                onClick={() => handleRowClick(task)}
                                className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-3">
                                    <span className="text-lg">{getActivityIcon(task.activityType)}</span>
                                    <div className="flex-1">
                                      <h4 className="font-medium text-gray-900">{task.title}</h4>
                                      <div className="flex items-center gap-3 mt-1">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)}`}>
                                          {task.status}
                                        </span>
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(task.priority)}`}>
                                          {task.priority}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                    <span>👤 {task.assignedTo}</span>
                                    <span>📅 {format(safeDateConversion(task.dueDate), 'MMM d, yyyy')}</span>
                                    <span>🎯 {task.opportunityTitle}</span>
                                    <span>🏢 {task.accountName}</span>
                                    {task.relatedContacts.length > 0 && (
                                      <span>👥 {task.relatedContacts.join(', ')}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {task.status === 'Scheduled' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCompleteActivity(task.id);
                                      }}
                                      className="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded transition-colors flex items-center gap-1"
                                    >
                                      <CheckCircle className="h-3 w-3" />
                                      Complete
                                    </button>
                                  )}
                                  {task.status === 'Completed' && (
                                    <span className="text-sm text-green-600 flex items-center gap-1">
                                      <CheckCircle className="h-3 w-3" />
                                      Completed
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Notes section */}
                              <div className="px-3 pb-3 border-t border-gray-100">
                                <div className="flex items-start justify-between mb-2">
                                  <h5 className="text-sm font-medium text-gray-700 flex items-center gap-1">
                                    📝 Notes
                                  </h5>
                                </div>
                                <div className="text-sm text-gray-600 min-h-[2rem]">
                                  {task.notes || (
                                    <span className="text-gray-400 italic">No notes added yet</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {Object.values(groupedTasks).every(group => group.length === 0) && (
                    <div className="text-center py-12 text-gray-500">
                      <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-lg font-medium">No scheduled activities found</p>
                      <p className="text-sm mt-1">Activities are completed or try adjusting your search.</p>
                    </div>
                  )}
                </div>
              </div>
                         ) : viewMode === 'list' ? (
               <div className="h-full overflow-auto p-6">
                 <div className="space-y-6">
                   {Object.entries(groupTasksByOpportunity()).map(([opportunityKey, tasks]) => (
                     <div key={opportunityKey} className="bg-white rounded-lg border border-gray-200">
                       <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                         <h3 className="font-medium text-gray-900">{opportunityKey}</h3>
                         <p className="text-sm text-gray-600">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
                       </div>
                       <div className="overflow-x-auto">
                         <table className="min-w-full divide-y divide-gray-200">
                           <thead className="bg-gray-50">
                             <tr>
                               {columns.map((column) => (
                                 <th
                                   key={column.key}
                                   className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                 >
                                   {column.label}
                                 </th>
                               ))}
                             </tr>
                           </thead>
                           <tbody className="bg-white divide-y divide-gray-200">
                             {tasks.map((task) => (
                               <tr
                                 key={task.id}
                                 onClick={() => handleRowClick(task)}
                                 className="hover:bg-gray-50 cursor-pointer transition-colors"
                               >
                                 {columns.map((column) => (
                                   <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                     {column.render
                                       ? column.render(task[column.key] as any, task)
                                       : String(task[column.key])
                                     }
                                   </td>
                                 ))}
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>
                     </div>
                   ))}
                   
                   {Object.keys(groupTasksByOpportunity()).length === 0 && (
                     <div className="text-center py-12 text-gray-500">
                       <List className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                       <p className="text-lg font-medium">No activities found</p>
                       <p className="text-sm mt-1">Try adjusting your search or view different activities.</p>
                     </div>
                   )}
                 </div>
               </div>
             ) : (
              <TaskBoard
                tasks={filteredTasks}
                onTaskClick={handleRowClick}
                onStatusChange={() => {}} // Not used anymore
              />
            )}
          </div>
        </div>

        {/* Right Column - Opportunity To-Do Items */}
        <div className="flex-1 bg-white rounded-lg shadow-sm flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200 rounded-t-lg">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-iol-red" />
              Opportunity To-Do Items
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Uncompleted checklist items across all opportunities
            </p>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {opportunitiesWithTodos.length > 0 ? (
              <div className="space-y-6">
                {opportunitiesWithTodos.map(opportunity => (
                  <div key={opportunity.id} className="bg-gray-50 rounded-lg border border-gray-200">
                    <div className="px-4 py-3 border-b border-gray-200 bg-white rounded-t-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{opportunity.title}</h3>
                          <p className="text-sm text-gray-500">{opportunity.accountName}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStageColor(opportunity.stage)}`}>
                          {opportunity.stage}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {opportunity.uncompletedTodos.map(todo => (
                        <div key={todo.id} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
                          <button
                            onClick={() => handleToggleTodoItem(opportunity.id, todo.id)}
                            className="mt-0.5 w-4 h-4 border-2 border-gray-300 rounded hover:border-iol-red focus:outline-none focus:border-iol-red transition-colors flex-shrink-0"
                          >
                            <span className="sr-only">Mark as complete</span>
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 break-words">{todo.text}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Added {format(safeDateConversion(todo.createdAt), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <Link
                            to={`/opportunities/${opportunity.id}`}
                            className="text-iol-red hover:text-iol-red-dark text-xs flex items-center gap-1 flex-shrink-0"
                          >
                            View
                          </Link>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <CheckSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No pending to-do items</p>
                <p className="text-sm mt-1">All checklist items are completed or no opportunities have checklists.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Unified Activity Completion Modal */}
      {activityManager.activeActivity && activityManager.activityContext && (
        <ActivityManager
          activity={activityManager.activeActivity}
          opportunityId={activityManager.activityContext.opportunityId}
          opportunityTitle={activityManager.activityContext.opportunityTitle}
          accountName={activityManager.activityContext.accountName}
          onComplete={activityManager.completeActivity}
          onCancel={activityManager.closeActivityCompletion}
          isOpen={activityManager.isModalOpen}
        />
      )}
    </div>
  );
}; 