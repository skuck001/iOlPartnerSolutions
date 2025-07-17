import React, { useEffect, useState, useCallback } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Target, 
  Calendar, 
  MapPin, 
  Award,
  AlertTriangle,
  Building,
  Activity,
  CheckCircle,
  Timer,
  Briefcase,
  Clock,
  Zap,
  Info
} from 'lucide-react';
import type { Opportunity, Account, Task, User } from '../types';
import { useDataContext } from '../context/DataContext';
import { format, isAfter, isBefore, subDays, startOfWeek, endOfWeek, differenceInDays, addDays } from 'date-fns';

// Helper function to safely parse any timestamp format
const safeParseDate = (timestamp: any): Date | null => {
  if (!timestamp) return null;
  
  try {
    if ((timestamp as any)?.toDate) {
      return (timestamp as any).toDate();
    } else if ((timestamp as any)?._seconds) {
      return new Date((timestamp as any)._seconds * 1000);
    } else if ((timestamp as any)?.seconds) {
      return new Date((timestamp as any).seconds * 1000);
    } else {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? null : date;
    }
  } catch (error) {
    console.error('Date parsing error:', error, timestamp);
    return null;
  }
};

interface PipelineData {
  stage: string;
  count: number;
  value: number;
  color: string;
  bgColor: string;
}

interface OpportunityHealth {
  healthy: Opportunity[];
  atRisk: Opportunity[];
  stalled: Opportunity[];
  closingSoon: Opportunity[];
}

export const Dashboard: React.FC = () => {
  // Data context
  const { loadAllData, isLoading } = useDataContext();
  
  // State
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<OpportunityHealth | null>(null);

  // Helper function for getting user display names
  const getUserDisplayName = useCallback((user: User): string => {
    if (user.displayName && user.displayName.trim()) {
      return user.displayName;
    }
    
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`.trim();
    }
    
    if (user.firstName) {
      return user.firstName;
    }
    
    if (user.lastName) {
      return user.lastName;
    }
    
    if (user.email) {
      return user.email.split('@')[0];
    }
    
    return 'Unknown User';
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Dashboard: Loading all data using DataContext...');
        const data = await loadAllData();
        
        // Set data from the cached/fresh response
        setOpportunities(data.opportunities || []);
        setAccounts(data.accounts || []);
        setTasks(data.tasks || []);
        setUsers(data.users || []);
        
        console.log('Dashboard: Data loaded successfully:', {
          opportunities: data.opportunities?.length || 0,
          accounts: data.accounts?.length || 0,
          tasks: data.tasks?.length || 0,
          users: data.users?.length || 0
        });
      } catch (error) {
        console.error('Dashboard: Error fetching data:', error);
        // Set empty defaults on error
        setOpportunities([]);
        setAccounts([]);
        setTasks([]);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [loadAllData]);

  useEffect(() => {
    if (opportunities.length > 0) {
      analyzeHealth();
    }
  }, [opportunities]);

  // Calculate pipeline data
  const pipelineData: PipelineData[] = [
    { stage: 'Discovery', count: 0, value: 0, color: 'text-blue-800', bgColor: 'bg-blue-500' },
    { stage: 'Proposal', count: 0, value: 0, color: 'text-yellow-800', bgColor: 'bg-yellow-500' },
    { stage: 'Negotiation', count: 0, value: 0, color: 'text-orange-800', bgColor: 'bg-orange-500' },
    { stage: 'Closed-Won', count: 0, value: 0, color: 'text-green-800', bgColor: 'bg-green-500' },
    { stage: 'Closed-Lost', count: 0, value: 0, color: 'text-red-800', bgColor: 'bg-red-500' }
  ];

  opportunities.forEach(opp => {
    const stageData = pipelineData.find(p => p.stage === opp.stage);
    if (stageData) {
      stageData.count++;
      stageData.value += opp.estimatedDealValue || 0;
    }
  });

  // Calculate key metrics
  const totalPipelineValue = opportunities
    .filter(opp => !['Closed-Won', 'Closed-Lost'].includes(opp.stage))
    .reduce((sum, opp) => sum + (opp.estimatedDealValue || 0), 0);

  const totalClosedWonValue = opportunities
    .filter(opp => opp.stage === 'Closed-Won')
    .reduce((sum, opp) => sum + (opp.estimatedDealValue || 0), 0);

  const activeOpportunities = opportunities.filter(opp => 
    !['Closed-Won', 'Closed-Lost'].includes(opp.stage)
  );

  const overdueTasks = tasks.filter(task => {
    if (task.status === 'Done' || !task.dueDate) return false;
    const date = safeParseDate(task.dueDate);
    return date ? isBefore(date, new Date()) : false;
  });

  // Calculate activities this week across all opportunities
  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());
  
  const activitiesThisWeek = opportunities.reduce((count, opp) => {
    return count + (opp.activities || []).filter(activity => {
      const activityDate = safeParseDate(activity.dateTime);
      return activityDate ? (activityDate >= weekStart && activityDate <= weekEnd) : false;
    }).length;
  }, 0);

  // Calculate win rate
  const closedOpportunities = opportunities.filter(opp => 
    ['Closed-Won', 'Closed-Lost'].includes(opp.stage)
  );
  const winRate = closedOpportunities.length > 0 
    ? (pipelineData.find(p => p.stage === 'Closed-Won')?.count || 0) / closedOpportunities.length * 100 
    : 0;

  // Upcoming activities and overdue items
  const upcomingActivities = opportunities
    .flatMap(opp => 
      (opp.activities || [])
        .filter(activity => {
          if (activity.status !== 'Scheduled') return false;
          const date = safeParseDate(activity.dateTime);
          return date ? (isAfter(date, new Date()) && isBefore(date, subDays(new Date(), -7))) : false;
        })
        .map(activity => ({ ...activity, opportunityTitle: opp.title, opportunityId: opp.id }))
    )
    .sort((a, b) => {
      const dateA = safeParseDate(a.dateTime);
      const dateB = safeParseDate(b.dateTime);
      if (!dateA || !dateB) return 0;
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 5);

  // Stalled opportunities (no activity in 14 days)
  const stalledOpportunities = activeOpportunities.filter(opp => {
    if (!opp.lastActivityDate) return true;
    const date = safeParseDate(opp.lastActivityDate);
    return date ? differenceInDays(new Date(), date) > 14 : false;
  }).slice(0, 5);

  // Calculate max value for bar chart scaling
  const maxPipelineValue = Math.max(...pipelineData.map(stage => stage.value));

  const analyzeHealth = () => {
    const now = new Date();
    const activeOpps = opportunities.filter(opp => 
      !['Closed-Won', 'Closed-Lost'].includes(opp.stage)
    );

    const healthy: Opportunity[] = [];
    const atRisk: Opportunity[] = [];
    const stalled: Opportunity[] = [];
    const closingSoon: Opportunity[] = [];

    activeOpps.forEach(opp => {
      // Check if closing soon (within 30 days)
              const closeDate = safeParseDate(opp.expectedCloseDate);
              if (closeDate && isBefore(closeDate, addDays(now, 30))) {
        closingSoon.push(opp);
      }

      // Check if stalled (no activity in last 14 days)
      const lastActivity = opp.activities && opp.activities.length > 0 
        ? opp.activities.sort((a, b) => {
            try {
              let dateA, dateB;
              if ((a.dateTime as any)?.toMillis) {
                dateA = (a.dateTime as any).toMillis();
              } else {
                dateA = new Date(a.dateTime).getTime();
              }
              
              if ((b.dateTime as any)?.toMillis) {
                dateB = (b.dateTime as any).toMillis();
              } else {
                dateB = new Date(b.dateTime).getTime();
              }
              
              return dateB - dateA;
            } catch (error) {
              console.error('Date sorting error:', error);
              return 0;
            }
          })[0]
        : null;
      
              const daysSinceLastActivity = lastActivity 
        ? (() => {
            const date = safeParseDate(lastActivity.dateTime);
            return date ? differenceInDays(now, date) : 999;
          })()
        : 999;

      if (daysSinceLastActivity > 14) {
        stalled.push(opp);
      }

      // Check if at risk (overdue activities, long sales cycle, etc.)
      const overdueActivities = (opp.activities || []).filter(activity => {
        if (activity.status !== 'Scheduled') return false;
        const date = safeParseDate(activity.dateTime);
        return date ? isBefore(date, now) : false;
      });

      const isAtRisk = overdueActivities.length > 0 || 
                     daysSinceLastActivity > 7 ||
                     (() => {
                       const date = safeParseDate(opp.expectedCloseDate);
                       return date && isBefore(date, addDays(now, 7)) && opp.stage === 'Discovery';
                     })();

      if (isAtRisk && !stalled.includes(opp)) {
        atRisk.push(opp);
      }

      // Healthy opportunities
      if (!stalled.includes(opp) && !atRisk.includes(opp) && daysSinceLastActivity <= 7) {
        healthy.push(opp);
      }
    });

    setHealth({ healthy, atRisk, stalled, closingSoon });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Partner Solutions Dashboard</h1>
          <p className="text-gray-600 mt-2">Hospitality Tech Partnerships - Business Unit Overview</p>
        </div>

        {/* Opportunity Health KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm font-medium text-gray-600">Healthy</p>
                  <div className="relative group">
                    <Info className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                      <div className="space-y-1">
                        <div>• Recent activity within 7 days</div>
                        <div>• No overdue activities</div>
                        <div>• Consistent engagement</div>
                      </div>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
                <p className="text-2xl font-bold text-green-600">{health?.healthy.length || 0}</p>
                <p className="text-sm text-gray-500 flex items-center mt-1">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active engagement
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm font-medium text-gray-600">At Risk</p>
                  <div className="relative group">
                    <Info className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                      <div className="space-y-1">
                        <div>• Overdue activities or gaps (7-14 days)</div>
                        <div>• Close date approaching in Discovery</div>
                        <div>• Needs immediate intervention</div>
                      </div>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
                <p className="text-2xl font-bold text-yellow-600">{health?.atRisk.length || 0}</p>
                <p className="text-sm text-gray-500 flex items-center mt-1">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Needs attention
                </p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm font-medium text-gray-600">Stalled</p>
                  <div className="relative group">
                    <Info className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                      <div className="space-y-1">
                        <div>• No activity for 14+ days</div>
                        <div>• High risk of losing opportunity</div>
                        <div>• Requires emergency re-engagement</div>
                      </div>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
                <p className="text-2xl font-bold text-red-600">{health?.stalled.length || 0}</p>
                <p className="text-sm text-gray-500 flex items-center mt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  No recent activity
                </p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <Clock className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm font-medium text-gray-600">Closing Soon</p>
                  <div className="relative group">
                    <Info className="h-3 w-3 text-gray-400 hover:text-gray-600 cursor-help" />
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                      <div className="space-y-1">
                        <div>• Expected close within 30 days</div>
                        <div>• Time-sensitive opportunities</div>
                        <div>• Focus on closing activities</div>
                      </div>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
                <p className="text-2xl font-bold text-orange-600">{health?.closingSoon.length || 0}</p>
                <p className="text-sm text-gray-500 flex items-center mt-1">
                  <Zap className="h-3 w-3 mr-1" />
                  Next 30 days
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Zap className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>

        </div>

        {/* Business Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Pipeline</p>
                <p className="text-2xl font-bold text-gray-900">${totalPipelineValue.toLocaleString()}</p>
                <p className="text-sm text-blue-600 flex items-center mt-1">
                  <Target className="h-3 w-3 mr-1" />
                  {activeOpportunities.length} opportunities
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Closed Won (Total)</p>
                <p className="text-2xl font-bold text-gray-900">${totalClosedWonValue.toLocaleString()}</p>
                <p className="text-sm text-green-600 flex items-center mt-1">
                  <Award className="h-3 w-3 mr-1" />
                  {winRate.toFixed(1)}% win rate
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Week Activity</p>
                <p className="text-2xl font-bold text-gray-900">{activitiesThisWeek}</p>
                <p className="text-sm flex items-center mt-1">
                  {overdueTasks.length > 0 ? (
                    <span className="text-red-600 flex items-center">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {overdueTasks.length} overdue tasks
                    </span>
                  ) : (
                    <span className="text-green-600 flex items-center">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      On track
                    </span>
                  )}
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Activity className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline Chart and Action Items */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Sales Pipeline Pie Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Sales Pipeline</h3>
            <div className="flex items-center justify-between">
              {/* Pie Chart */}
              <div className="relative">
                {(() => {
                  const totalCount = pipelineData.reduce((sum, stage) => sum + stage.count, 0);
                  if (totalCount === 0) {
                    return (
                      <div className="w-40 h-40 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-500 text-sm">No data</span>
                      </div>
                    );
                  }

                  const radius = 70;
                  const centerX = 80;
                  const centerY = 80;
                  let cumulativeAngle = 0;

                  const stageColors = {
                    'Discovery': '#3b82f6',
                    'Proposal': '#eab308', 
                    'Negotiation': '#f97316',
                    'Closed-Won': '#22c55e',
                    'Closed-Lost': '#ef4444'
                  };

                  return (
                    <svg width="160" height="160" className="transform -rotate-90">
                      {pipelineData.map((stage) => {
                        if (stage.count === 0) return null;
                        
                        const percentage = (stage.count / totalCount) * 100;
                        const angle = (percentage / 100) * 360;
                        const startAngle = cumulativeAngle;
                        const endAngle = cumulativeAngle + angle;
                        
                        // Convert to radians
                        const startAngleRad = (startAngle * Math.PI) / 180;
                        const endAngleRad = (endAngle * Math.PI) / 180;
                        
                        // Calculate arc coordinates
                        const x1 = centerX + radius * Math.cos(startAngleRad);
                        const y1 = centerY + radius * Math.sin(startAngleRad);
                        const x2 = centerX + radius * Math.cos(endAngleRad);
                        const y2 = centerY + radius * Math.sin(endAngleRad);
                        
                        const largeArcFlag = angle > 180 ? 1 : 0;
                        
                        const pathData = [
                          `M ${centerX} ${centerY}`,
                          `L ${x1} ${y1}`,
                          `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                          'Z'
                        ].join(' ');
                        
                        cumulativeAngle += angle;
                        
                        return (
                          <path
                            key={stage.stage}
                            d={pathData}
                            fill={stageColors[stage.stage as keyof typeof stageColors]}
                            stroke="white"
                            strokeWidth="2"
                            className="hover:opacity-80 transition-opacity"
                          />
                        );
                      })}
                      {/* Center circle for donut effect */}
                      <circle 
                        cx={centerX} 
                        cy={centerY} 
                        r="25" 
                        fill="white"
                        stroke="none"
                      />
                      <text 
                        x={centerX} 
                        y={centerY + 5} 
                        textAnchor="middle" 
                        className="text-xs font-semibold fill-gray-700 transform rotate-90"
                        style={{ transformOrigin: `${centerX}px ${centerY}px` }}
                      >
                        {totalCount}
                      </text>
                    </svg>
                  );
                })()}
              </div>

              {/* Legend */}
              <div className="flex-1 ml-6 space-y-2">
                {pipelineData.map((stage) => {
                  const totalCount = pipelineData.reduce((sum, s) => sum + s.count, 0);
                  const percentOfTotal = totalCount > 0 ? ((stage.count / totalCount) * 100).toFixed(1) : '0';
                  const valuePercent = (totalPipelineValue + totalClosedWonValue) > 0 ? ((stage.value / (totalPipelineValue + totalClosedWonValue)) * 100).toFixed(1) : '0';
                  
                  const stageColors = {
                    'Discovery': 'bg-blue-500',
                    'Proposal': 'bg-yellow-500', 
                    'Negotiation': 'bg-orange-500',
                    'Closed-Won': 'bg-green-500',
                    'Closed-Lost': 'bg-red-500'
                  };

                  return (
                    <div key={stage.stage} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${stageColors[stage.stage as keyof typeof stageColors]}`}></div>
                        <span className="font-medium text-gray-700 w-20">{stage.stage}</span>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <span className="text-gray-900 font-semibold">${stage.value.toLocaleString()}</span>
                        <span className="text-gray-500">({stage.count})</span>
                        <span className="text-gray-400 w-8">{percentOfTotal}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Items */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Action Items</h3>
            <div className="space-y-4">
              {/* Upcoming Activities */}
              <div>
                <h4 className="font-medium text-gray-800 mb-2 flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-blue-500" />
                  Upcoming Activities
                </h4>
                {upcomingActivities.slice(0, 3).map((activity) => (
                  <div key={activity.id} className="text-sm text-gray-600 mb-1 pl-6">
                    {(() => {
                  const date = safeParseDate(activity.dateTime);
                  return date ? format(date, 'MMM d') : 'N/A';
                })()} - {activity.subject}
                  </div>
                ))}
              </div>

              {/* Stalled Opportunities */}
              <div>
                <h4 className="font-medium text-gray-800 mb-2 flex items-center">
                  <Timer className="h-4 w-4 mr-2 text-orange-500" />
                  Stalled Opportunities
                </h4>
                {stalledOpportunities.slice(0, 3).map((opp) => (
                  <div key={opp.id} className="text-sm text-gray-600 mb-1 pl-6">
                    {opp.title} - {opp.stage}
                  </div>
                ))}
              </div>

              {/* Overdue Tasks */}
              {overdueTasks.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-800 mb-2 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
                    Overdue Tasks
                  </h4>
                  {overdueTasks.slice(0, 3).map((task) => (
                    <div key={task.id} className="text-sm text-gray-600 mb-1 pl-6">
                      {task.title} - Due {(() => {
                  const date = safeParseDate(task.dueDate);
                  return date ? format(date, 'MMM d') : 'N/A';
                })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 