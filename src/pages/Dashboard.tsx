import React, { useEffect, useState } from 'react';
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
  Briefcase
} from 'lucide-react';
import type { Opportunity, Account, Task, User } from '../types';
import { getDocuments } from '../lib/firestore';
import { getAllUsers, getUserDisplayName } from '../lib/userUtils';
import { format, isAfter, isBefore, subDays, startOfWeek, endOfWeek, differenceInDays } from 'date-fns';

interface PipelineData {
  stage: string;
  count: number;
  value: number;
  color: string;
  bgColor: string;
}

export const Dashboard: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [opps, accs, tsks, usrs] = await Promise.all([
          getDocuments('opportunities'),
          getDocuments('accounts'),
          getDocuments('tasks'),
          getAllUsers()
        ]);
        
        setOpportunities(opps as Opportunity[]);
        setAccounts(accs as Account[]);
        setTasks(tsks as Task[]);
        setUsers(usrs);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

  const overdueTasks = tasks.filter(task => 
    task.status !== 'Done' && 
    task.dueDate && 
    isBefore(task.dueDate.toDate(), new Date())
  );

  // Calculate activities this week across all opportunities
  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());
  
  const activitiesThisWeek = opportunities.reduce((count, opp) => {
    return count + (opp.activities || []).filter(activity => {
      const activityDate = activity.dateTime.toDate();
      return activityDate >= weekStart && activityDate <= weekEnd;
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
        .filter(activity => 
          activity.status === 'Scheduled' && 
          isAfter(activity.dateTime.toDate(), new Date()) &&
          isBefore(activity.dateTime.toDate(), subDays(new Date(), -7))
        )
        .map(activity => ({ ...activity, opportunityTitle: opp.title, opportunityId: opp.id }))
    )
    .sort((a, b) => a.dateTime.toDate().getTime() - b.dateTime.toDate().getTime())
    .slice(0, 5);

  // Stalled opportunities (no activity in 14 days)
  const stalledOpportunities = activeOpportunities.filter(opp => {
    if (!opp.lastActivityDate) return true;
    return differenceInDays(new Date(), opp.lastActivityDate.toDate()) > 14;
  }).slice(0, 5);

  // Calculate max value for bar chart scaling
  const maxPipelineValue = Math.max(...pipelineData.map(stage => stage.value));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Partner Solutions Dashboard</h1>
          <p className="text-gray-600 mt-2">Hospitality Tech Partnerships - Business Unit Overview</p>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
                <p className="text-sm font-medium text-gray-600">Active Partners</p>
                <p className="text-2xl font-bold text-gray-900">{accounts.filter(acc => acc.status === 'Active' || acc.status === 'Partner').length}</p>
                <p className="text-sm text-purple-600 flex items-center mt-1">
                  <Building className="h-3 w-3 mr-1" />
                  {accounts.length} total accounts
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
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
          {/* Sales Pipeline Bar Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Sales Pipeline</h3>
            <div className="space-y-6">
              {pipelineData.map((stage) => (
                <div key={stage.stage} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">{stage.stage}</span>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">${stage.value.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">({stage.count} opportunities)</div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div 
                      className={`h-4 rounded-full ${stage.bgColor} transition-all duration-500 ease-out`}
                      style={{ 
                        width: maxPipelineValue > 0 ? `${(stage.value / maxPipelineValue) * 100}%` : '0%' 
                      }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {maxPipelineValue > 0 ? ((stage.value / (totalPipelineValue + totalClosedWonValue)) * 100).toFixed(1) : 0}% of total pipeline
                  </div>
                </div>
              ))}
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
                    {format(activity.dateTime.toDate(), 'MMM d')} - {activity.subject}
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
                      {task.title} - Due {format(task.dueDate.toDate(), 'MMM d')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* High-Priority Opportunities */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">High-Priority Opportunities</h2>
            <span className="text-iol-red font-medium">Deal Value</span>
          </div>

          <div className="space-y-4">
            {opportunities
              .filter(opp => !['Closed-Won', 'Closed-Lost'].includes(opp.stage))
              .sort((a, b) => {
                // Sort by priority first, then by deal value
                const priorityOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
                const aPriority = priorityOrder[a.priority] || 0;
                const bPriority = priorityOrder[b.priority] || 0;
                if (aPriority !== bPriority) return bPriority - aPriority;
                return (b.estimatedDealValue || 0) - (a.estimatedDealValue || 0);
              })
              .slice(0, 6)
              .map((opportunity) => {
                const assignedUser = users.find(u => u.id === opportunity.ownerId);
                const account = accounts.find(a => a.id === opportunity.accountId);
                
                return (
                  <div key={opportunity.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-gray-900">{opportunity.title}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            opportunity.stage === 'Discovery' ? 'bg-blue-100 text-blue-800' :
                            opportunity.stage === 'Proposal' ? 'bg-yellow-100 text-yellow-800' :
                            opportunity.stage === 'Negotiation' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {opportunity.stage}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            opportunity.priority === 'Critical' ? 'bg-red-100 text-red-800' :
                            opportunity.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                            opportunity.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {opportunity.priority}
                          </span>
                        </div>
                        
                        {account && (
                          <p className="text-sm text-gray-600 mb-2">
                            <Building className="h-3 w-3 inline mr-1" />
                            {account.name} • {account.industry}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {opportunity.region}
                          </div>
                          {assignedUser && (
                            <div className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              {getUserDisplayName(assignedUser)}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {opportunity.createdAt ? format(opportunity.createdAt.toDate(), 'MMM d') : 'No date'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right ml-4">
                        <p className="text-xl font-bold text-gray-900">
                          ${(opportunity.estimatedDealValue || 0).toLocaleString()}
                        </p>
                        {opportunity.expectedCloseDate && (
                          <p className="text-sm text-gray-500">
                            Close: {format(opportunity.expectedCloseDate.toDate(), 'MMM yyyy')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {activeOpportunities.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No active opportunities found. Add some opportunities to see them here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 