import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Task, TaskStatus, Opportunity, Activity, ActivityStatus, Account, Contact } from '../types';
import { ListView } from '../components/ListView';
import { TaskBoard } from '../components/TaskBoard';
import { getDocuments, updateDocument } from '../lib/firestore';
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
  Edit3,
  Save,
  X
} from 'lucide-react';

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

export const Tasks: React.FC = () => {
  const [activities, setActivities] = useState<EnhancedTask[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'scheduled'>('scheduled');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Notes editing state
  const [editingNotes, setEditingNotes] = useState<{ [key: string]: boolean }>({});
  const [notesText, setNotesText] = useState<{ [key: string]: string }>({});
  const [savingNotes, setSavingNotes] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [opportunitiesData, accountsData, contactsData] = await Promise.all([
        getDocuments('opportunities'),
        getDocuments('accounts'),
        getDocuments('contacts')
      ]);
      
      const opps = opportunitiesData as Opportunity[];
      const accs = accountsData as Account[];
      const cons = contactsData as Contact[];
      
      setOpportunities(opps);
      setAccounts(accs);
      setContacts(cons);
      
      // Extract activities from all opportunities and convert to enhanced tasks
      const allActivities: EnhancedTask[] = [];
      const initialNotesText: { [key: string]: string } = {};
      
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
            assignedTo: activity.assignedTo,
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
          initialNotesText[taskId] = activity.notes || '';
        });
      });
      
      setActivities(allActivities);
      setNotesText(initialNotesText);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
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

  const handleCompleteActivity = async (taskId: string) => {
    try {
      // Parse the taskId to get opportunityId and activityId
      const [opportunityId, activityId] = taskId.split('_');
      
      if (!opportunityId || !activityId) {
        console.error('Invalid task ID format:', taskId);
        return;
      }
      
      const opportunity = opportunities.find(o => o.id === opportunityId);
      if (!opportunity) {
        console.error('Opportunity not found:', opportunityId);
        return;
      }
      
      // Update the activity status to Completed, keeping any updated notes
      const currentNotes = notesText[taskId] || '';
      const updatedActivities = opportunity.activities.map(activity => 
        activity.id === activityId 
          ? { 
              ...activity, 
              status: 'Completed' as ActivityStatus,
              notes: currentNotes, // Save current notes when completing
              completedAt: new Date(),
              updatedAt: new Date(),
              updatedBy: 'current-user'
            }
          : activity
      );
      
      // Update the opportunity with the modified activities
      await updateDocument('opportunities', opportunityId, {
        activities: updatedActivities,
        updatedAt: new Date()
      });
      
      // Refresh the data
      await fetchData();
    } catch (error) {
      console.error('Error completing activity:', error);
    }
  };

  const handleSaveNotes = async (taskId: string) => {
    try {
      setSavingNotes(prev => ({ ...prev, [taskId]: true }));
      
      // Parse the taskId to get opportunityId and activityId
      const [opportunityId, activityId] = taskId.split('_');
      
      if (!opportunityId || !activityId) {
        console.error('Invalid task ID format:', taskId);
        return;
      }
      
      const opportunity = opportunities.find(o => o.id === opportunityId);
      if (!opportunity) {
        console.error('Opportunity not found:', opportunityId);
        return;
      }
      
      // Update the activity notes
      const updatedNotes = notesText[taskId] || '';
      const updatedActivities = opportunity.activities.map(activity => 
        activity.id === activityId 
          ? { 
              ...activity, 
              notes: updatedNotes,
              updatedAt: new Date(),
              updatedBy: 'current-user'
            }
          : activity
      );
      
      // Update the opportunity with the modified activities
      await updateDocument('opportunities', opportunityId, {
        activities: updatedActivities,
        updatedAt: new Date()
      });
      
      // Update local state and exit edit mode
      setActivities(prev => prev.map(task => 
        task.id === taskId ? { ...task, notes: updatedNotes } : task
      ));
      setEditingNotes(prev => ({ ...prev, [taskId]: false }));
      
    } catch (error) {
      console.error('Error saving notes:', error);
    } finally {
      setSavingNotes(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleEditNotes = (taskId: string) => {
    setEditingNotes(prev => ({ ...prev, [taskId]: true }));
  };

  const handleCancelEditNotes = (taskId: string) => {
    // Reset notes text to original value
    const task = activities.find(t => t.id === taskId);
    if (task) {
      setNotesText(prev => ({ ...prev, [taskId]: task.notes }));
    }
    setEditingNotes(prev => ({ ...prev, [taskId]: false }));
  };

  const handleNotesChange = (taskId: string, value: string) => {
    setNotesText(prev => ({ ...prev, [taskId]: value }));
  };

  // Calculate task statistics
  const calculateStats = (): TaskStats => {
    const now = new Date();
    const today = startOfDay(now);
    
    return {
      total: activities.length,
      overdue: activities.filter(task => 
        task.status === 'Scheduled' && isPast(task.dueDate.toDate()) && !isToday(task.dueDate.toDate())
      ).length,
      dueToday: activities.filter(task => 
        task.status === 'Scheduled' && isToday(task.dueDate.toDate())
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
    return activities.filter(task => isSameDay(task.dueDate.toDate(), date));
  };

  // Filter tasks based on search and selected date
  const filteredTasks = activities.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.assignedTo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.opportunityTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.activityType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = selectedDate ? isSameDay(task.dueDate.toDate(), selectedDate) : true;
    
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
      const taskDate = task.dueDate.toDate();
      
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
      render: (dueDate: any) => format(dueDate.toDate(), 'MMM d, yyyy')
    },
    { 
      key: 'opportunityTitle' as keyof EnhancedTask, 
      label: 'Opportunity',
      render: (opportunityTitle: string, task: EnhancedTask) => (
        <div>
          <div className="font-medium">{opportunityTitle}</div>
          <div className="text-sm text-gray-500">{task.accountName}</div>
        </div>
      )
    }
  ];

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
            <p className="text-gray-600 mt-1">Track all scheduled activities and tasks across opportunities</p>
          </div>
          <div className="flex items-center gap-4">
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
            <Link to="/opportunities/new" className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Opportunity
            </Link>
          </div>
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

      {/* 7-Day Calendar View */}
      {viewMode === 'scheduled' && (
        <div className="px-6 py-3 bg-gray-900 border-b border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-white">Next 7 Days</h3>
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
                      ? 'bg-gray-700 text-blue-400 border border-blue-400'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-600'
                  }`}
                >
                  <div className="text-center">
                    <p className={`text-xs font-medium ${
                      isSelected ? 'text-white' : isCurrentDay ? 'text-blue-400' : 'text-gray-400'
                    }`}>
                      {format(date, 'EEE')}
                    </p>
                    <p className={`text-sm font-bold mt-0.5 ${
                      isSelected ? 'text-white' : isCurrentDay ? 'text-blue-400' : 'text-gray-200'
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

      {/* Search Bar */}
      {viewMode === 'scheduled' && (
        <div className="px-6 py-3 bg-white border-b border-gray-200">
          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-4 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-iol-red focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Content */}
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
                                <span>📅 {format(task.dueDate.toDate(), 'MMM d, yyyy')}</span>
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
                              {!editingNotes[task.id] && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditNotes(task.id);
                                  }}
                                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                                >
                                  <Edit3 className="h-3 w-3" />
                                  Edit
                                </button>
                              )}
                            </div>

                            {editingNotes[task.id] ? (
                              <div className="space-y-2">
                                <textarea
                                  value={notesText[task.id] || ''}
                                  onChange={(e) => handleNotesChange(task.id, e.target.value)}
                                  placeholder="Add notes or comments about this activity..."
                                  className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-iol-red focus:border-transparent resize-none"
                                  rows={3}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSaveNotes(task.id);
                                    }}
                                    disabled={savingNotes[task.id]}
                                    className="text-sm bg-iol-red hover:bg-iol-red-dark text-white px-3 py-1 rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                                  >
                                    <Save className="h-3 w-3" />
                                    {savingNotes[task.id] ? 'Saving...' : 'Save'}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCancelEditNotes(task.id);
                                    }}
                                    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 rounded transition-colors flex items-center gap-1"
                                  >
                                    <X className="h-3 w-3" />
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div 
                                className="text-sm text-gray-600 min-h-[2rem] cursor-text"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditNotes(task.id);
                                }}
                              >
                                {task.notes || (
                                  <span className="text-gray-400 italic">Click to add notes...</span>
                                )}
                              </div>
                            )}
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
            onStatusChange={() => {}} // Not used anymore
          />
        )}
      </div>
    </div>
  );
}; 