import React, { useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, AlertCircle, Clock, CheckCircle, CalendarDays, X, Filter } from 'lucide-react';
import { PlannerFilters } from './PlannerFilters';
import type { UnifiedTask, UnifiedTaskFilters } from '../types';

interface PlannerCalendarProps {
  tasks: UnifiedTask[];
  onTaskClick?: (task: UnifiedTask) => void;
  filters: UnifiedTaskFilters;
  onUpdateFilters: (filters: UnifiedTaskFilters) => void;
  onClearFilters: () => void;
}

interface DaySection {
  date: Date;
  label: string;
  tasks: UnifiedTask[];
  isToday?: boolean;
  isPast?: boolean;
}

const formatDate = (date: Date): string => {
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  };
  return date.toLocaleDateString('en-US', options);
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
};

const getTaskIcon = (task: UnifiedTask) => {
  if (task.status === 'Completed') return <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />;
  if (task.status === 'Overdue') return <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />;
  return <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />;
};

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case 'Critical': return 'border-l-red-500';
    case 'High': return 'border-l-orange-500';
    case 'Medium': return 'border-l-yellow-500';
    case 'Low': return 'border-l-green-500';
    default: return 'border-l-gray-300';
  }
};

export const PlannerCalendar: React.FC<PlannerCalendarProps> = ({ 
  tasks, 
  onTaskClick,
  filters,
  onUpdateFilters,
  onClearFilters
}) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek;
    return new Date(today.setDate(diff));
  });
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Get tasks for selected date
  const selectedDateTasks = useMemo(() => {
    if (!selectedDate) return [];
    
    const selectedDateOnly = new Date(selectedDate);
    selectedDateOnly.setHours(0, 0, 0, 0);
    
    return tasks.filter(task => {
      const taskDate = new Date(task.dueDate);
      taskDate.setHours(0, 0, 0, 0);
      return taskDate.getTime() === selectedDateOnly.getTime();
    }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [tasks, selectedDate]);

  // Group tasks by date sections
  const { overdueTasks, todayTasks, tomorrowTasks, weekDays, laterTasks } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Filter out completed tasks unless they were completed today
    const activeTasks = tasks.filter(task => {
      if (task.status === 'Completed') {
        const completedDate = task.completedAt ? new Date(task.completedAt) : null;
        if (completedDate) {
          const completedDateOnly = new Date(completedDate);
          completedDateOnly.setHours(0, 0, 0, 0);
          return completedDateOnly.getTime() === today.getTime();
        }
        return false;
      }
      return true;
    });

    const overdue: UnifiedTask[] = [];
    const todayList: UnifiedTask[] = [];
    const tomorrowList: UnifiedTask[] = [];
    const later: UnifiedTask[] = [];
    const weekTasksByDay: Map<number, UnifiedTask[]> = new Map();

    // Initialize week days
    for (let i = 0; i < 7; i++) {
      weekTasksByDay.set(i, []);
    }

    activeTasks.forEach(task => {
      const taskDate = new Date(task.dueDate);
      taskDate.setHours(0, 0, 0, 0);

      if (taskDate < today && task.status !== 'Completed') {
        overdue.push(task);
      } else if (taskDate.getTime() === today.getTime()) {
        todayList.push(task);
      } else if (taskDate.getTime() === tomorrow.getTime()) {
        tomorrowList.push(task);
      } else if (taskDate >= dayAfterTomorrow && taskDate <= weekEnd) {
        const dayIndex = taskDate.getDay();
        const dayTasks = weekTasksByDay.get(dayIndex) || [];
        dayTasks.push(task);
        weekTasksByDay.set(dayIndex, dayTasks);
      } else if (taskDate > weekEnd) {
        later.push(task);
      }
    });

    // Sort tasks within each group by time
    const sortByTime = (a: UnifiedTask, b: UnifiedTask) => {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    };

    overdue.sort(sortByTime);
    todayList.sort(sortByTime);
    tomorrowList.sort(sortByTime);
    later.sort(sortByTime);

    // Create week days array
    const weekDaysArray: DaySection[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      const dayTasks = weekTasksByDay.get(i) || [];
      dayTasks.sort(sortByTime);
      
      const dateOnly = new Date(date);
      dateOnly.setHours(0, 0, 0, 0);
      
      weekDaysArray.push({
        date,
        label: formatDate(date),
        tasks: dayTasks,
        isToday: dateOnly.getTime() === today.getTime(),
        isPast: dateOnly < today
      });
    }

    // Debug logging for overdue tasks
    if (overdue.length > 0) {
      console.log(`PlannerCalendar: Found ${overdue.length} overdue tasks`);
    }

    return {
      overdueTasks: overdue,
      todayTasks: todayList,
      tomorrowTasks: tomorrowList,
      weekDays: weekDaysArray,
      laterTasks: later
    };
  }, [tasks, currentWeekStart]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
      return newDate;
    });
  };

  const goToToday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek;
    setCurrentWeekStart(new Date(today.setDate(diff)));
    setSelectedDate(new Date());
  };

  // Get days in month for month picker
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days: (Date | null)[] = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days in month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const monthDays = useMemo(() => getDaysInMonth(currentMonth), [currentMonth]);
  
  const getTaskCountForDate = (date: Date) => {
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);
    
    return tasks.filter(task => {
      const taskDate = new Date(task.dueDate);
      taskDate.setHours(0, 0, 0, 0);
      return taskDate.getTime() === dateOnly.getTime();
    }).length;
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setShowMonthPicker(false);
    
    // Update week view to show the selected date's week
    const dayOfWeek = date.getDay();
    const diff = date.getDate() - dayOfWeek;
    const weekStart = new Date(date);
    weekStart.setDate(diff);
    setCurrentWeekStart(weekStart);
  };

  const TaskCard: React.FC<{ task: UnifiedTask; showTime?: boolean }> = ({ task, showTime = true }) => (
    <div
      onClick={() => onTaskClick?.(task)}
      className={`p-1.5 bg-white rounded border-l-2 ${getPriorityColor(task.priority)} hover:shadow-sm transition-all cursor-pointer`}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5">
          {getTaskIcon(task)}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium text-gray-900 truncate ${
            task.isComplete ? 'line-through opacity-60' : ''
          }`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-gray-500 truncate">
              {task.parentTitle}
            </p>
            {showTime && (
              <p className="text-[10px] text-gray-400">
                {formatTime(task.dueDate)}
              </p>
            )}
            {task.assignedToName && (
              <p className="text-[10px] text-blue-600">
                • {task.assignedToName}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const SectionHeader: React.FC<{ title: string; count: number; color?: string }> = ({ 
    title, 
    count, 
    color = 'text-gray-700' 
  }) => (
    <div className="flex items-center justify-between mb-1.5">
      <h3 className={`text-xs font-semibold ${color}`}>{title}</h3>
      {count > 0 && (
        <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
          {count}
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Calendar Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateWeek('prev')}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={goToToday}
              className="px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => navigateWeek('next')}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          
          <span className="text-xs text-gray-500">
            {formatDate(currentWeekStart)} - {formatDate(new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000))}
          </span>
          
          <button
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            className={`p-1 rounded transition-colors ${
              showMonthPicker ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
            }`}
            title="Pick a date"
          >
            <CalendarDays className="w-4 h-4" />
          </button>
        </div>

        {/* Month Picker */}
        {showMonthPicker && (
          <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="p-0.5 hover:bg-gray-200 rounded"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <h4 className="text-xs font-semibold text-gray-700 min-w-[100px] text-center">
                  {currentMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </h4>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="p-0.5 hover:bg-gray-200 rounded"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <button
                onClick={() => setShowMonthPicker(false)}
                className="text-gray-500 hover:text-gray-700 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            
            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <div key={idx} className="text-[10px] text-gray-500 text-center font-medium">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-0.5">
              {monthDays.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="p-1" />;
                }
                
                const taskCount = getTaskCountForDate(date);
                const isToday = date.toDateString() === new Date().toDateString();
                const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                
                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => handleDateSelect(date)}
                    className={`p-1 text-xs rounded hover:bg-blue-50 transition-colors relative ${
                      isSelected 
                        ? 'bg-blue-100 text-blue-700 font-semibold' 
                        : isToday 
                          ? 'bg-blue-50 text-blue-600 font-semibold'
                          : 'text-gray-700'
                    }`}
                  >
                    {date.getDate()}
                    {taskCount > 0 && (
                      <div className="absolute top-0.5 right-0.5 w-1 h-1 bg-blue-500 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Week View */}
        <div className="mt-3">
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day, index) => {
              const isSelected = selectedDate && 
                new Date(selectedDate).toDateString() === day.date.toDateString();
              
              return (
                <div
                  key={index}
                  onClick={() => setSelectedDate(day.date)}
                  className={`text-center p-1.5 rounded border cursor-pointer transition-all hover:shadow-sm ${
                    isSelected
                      ? 'bg-blue-100 border-blue-400 ring-1 ring-blue-300'
                      : day.isToday 
                        ? 'bg-blue-50 border-blue-200' 
                        : day.isPast 
                          ? 'bg-gray-50 border-gray-200 hover:bg-gray-100' 
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="text-[10px] text-gray-500 font-medium">
                    {day.date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                  </div>
                  <div className={`text-sm font-semibold ${
                    isSelected ? 'text-blue-700' : day.isToday ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {day.date.getDate()}
                  </div>
                  {day.tasks.length > 0 && (
                    <div className={`mt-0.5 w-5 h-5 mx-auto rounded-full flex items-center justify-center text-[10px] font-medium ${
                      day.tasks.some(t => t.status === 'Overdue') 
                        ? 'bg-red-100 text-red-600' 
                        : isSelected
                          ? 'bg-blue-200 text-blue-700'
                          : 'bg-blue-100 text-blue-600'
                    }`}>
                      {day.tasks.length}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center px-3 py-1.5 border rounded text-xs font-medium ${
              showFilters
                ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100'
                : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            }`}
          >
            <Filter className="w-3 h-3 mr-1" />
            Filters
          </button>
          
          {Object.keys(filters).length > 0 && (
            <>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-600">
                {Object.keys(filters).length} active
              </span>
              <button
                onClick={onClearFilters}
                className="text-xs text-gray-600 hover:text-gray-900"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mt-2 mb-3">
          <PlannerFilters
            filters={filters}
            onUpdateFilters={onUpdateFilters}
            onClearFilters={onClearFilters}
          />
        </div>
      )}

      {/* Selected Date Tasks */}
      {selectedDate && (
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-blue-900">
                {selectedDate.toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric'
                })}
              </h3>
              <span className="text-xs text-blue-600">
                {selectedDateTasks.length} {selectedDateTasks.length === 1 ? 'task' : 'tasks'}
              </span>
            </div>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-blue-600 hover:text-blue-800 text-xs"
            >
              ✕
            </button>
          </div>
          
          {selectedDateTasks.length > 0 ? (
            <div className="space-y-1">
              {selectedDateTasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-blue-600 italic">No tasks scheduled</p>
          )}
        </div>
      )}

      {/* Task Sections */}
      <div className="space-y-3">
        {/* Overdue Section */}
        {overdueTasks.length > 0 && (
          <div className="bg-red-50 rounded-lg p-3 border border-red-100">
            <SectionHeader title="Overdue" count={overdueTasks.length} color="text-red-600" />
            <div className="space-y-1">
              {overdueTasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {/* Today Section */}
        <div className={`rounded-lg p-3 border ${
          todayTasks.length > 0 ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100'
        }`}>
          <SectionHeader 
            title="Today" 
            count={todayTasks.length} 
            color={todayTasks.length > 0 ? "text-blue-600" : "text-gray-600"}
          />
          {todayTasks.length > 0 ? (
            <div className="space-y-1">
              {todayTasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">No tasks scheduled</p>
          )}
        </div>

        {/* Tomorrow Section */}
        {tomorrowTasks.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <SectionHeader 
              title="Tomorrow" 
              count={tomorrowTasks.length} 
            />
            <div className="space-y-1">
              {tomorrowTasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {/* Later Section */}
        {laterTasks.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <SectionHeader title="Later" count={laterTasks.length} />
            <div className="space-y-1">
              {laterTasks.slice(0, 10).map(task => (
                <TaskCard key={task.id} task={task} showTime={false} />
              ))}
              {laterTasks.length > 10 && (
                <p className="text-xs text-gray-500 text-center mt-1">
                  +{laterTasks.length - 10} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};