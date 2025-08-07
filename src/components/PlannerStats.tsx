import React from 'react';
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Target, 
  FileCheck,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface PlannerStatsProps {
  stats: {
    total: number;
    overdue: number;
    dueToday: number;
    upcoming: number;
    completed: number;
    byPriority: {
      Critical: number;
      High: number;
      Medium: number;
      Low: number;
    };
    byType: {
      OpportunityActivity: number;
      OpportunityChecklist: number;
      OpportunityBlocker: number;
      AssignmentActivity: number;
      AssignmentChecklist: number;
    };
  };
}

const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
}> = ({ title, value, icon, color, trend, trendValue }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-6">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {trend && trendValue !== undefined && (
          <div className="flex items-center mt-1">
            {trend === 'up' ? (
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
            ) : trend === 'down' ? (
              <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
            ) : null}
            <span className={`text-xs font-medium ${
              trend === 'up' ? 'text-green-600' : 
              trend === 'down' ? 'text-red-600' : 'text-gray-600'
            }`}>
              {trendValue > 0 ? '+' : ''}{trendValue}%
            </span>
          </div>
        )}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        {icon}
      </div>
    </div>
  </div>
);

export const PlannerStats: React.FC<PlannerStatsProps> = ({ stats }) => {
  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const overdueRate = stats.total > 0 ? Math.round((stats.overdue / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Tasks"
          value={stats.total}
          icon={<Calendar className="w-6 h-6 text-gray-600" />}
          color="bg-gray-50"
        />
        <StatCard
          title="Overdue"
          value={stats.overdue}
          icon={<AlertTriangle className="w-6 h-6 text-red-600" />}
          color="bg-red-50"
          trend={stats.overdue > 0 ? 'up' : 'neutral'}
          trendValue={overdueRate}
        />
        <StatCard
          title="Due Today"
          value={stats.dueToday}
          icon={<Clock className="w-6 h-6 text-orange-600" />}
          color="bg-orange-50"
        />
        <StatCard
          title="Upcoming"
          value={stats.upcoming}
          icon={<TrendingUp className="w-6 h-6 text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={<CheckCircle className="w-6 h-6 text-green-600" />}
          color="bg-green-50"
          trend={completionRate > 50 ? 'up' : 'down'}
          trendValue={completionRate}
        />
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Breakdown */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">By Priority</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Critical</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{stats.byPriority.Critical}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-orange-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">High</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{stats.byPriority.High}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Medium</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{stats.byPriority.Medium}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-700">Low</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{stats.byPriority.Low}</span>
            </div>
          </div>
        </div>

        {/* Type Breakdown */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">By Type</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Target className="w-4 h-4 text-blue-600 mr-3" />
                <span className="text-sm font-medium text-gray-700">Opportunity Activities</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{stats.byType.OpportunityActivity}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-blue-600 mr-3" />
                <span className="text-sm font-medium text-gray-700">Opportunity Checklists</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{stats.byType.OpportunityChecklist}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle className="w-4 h-4 text-red-600 mr-3" />
                <span className="text-sm font-medium text-gray-700">Opportunity Blockers</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{stats.byType.OpportunityBlocker}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="w-4 h-4 text-green-600 mr-3" />
                <span className="text-sm font-medium text-gray-700">Assignment Activities</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{stats.byType.AssignmentActivity}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FileCheck className="w-4 h-4 text-green-600 mr-3" />
                <span className="text-sm font-medium text-gray-700">Assignment Checklists</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{stats.byType.AssignmentChecklist}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-900">{completionRate}%</div>
            <div className="text-sm text-blue-700">Completion Rate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-900">{stats.dueToday + stats.overdue}</div>
            <div className="text-sm text-orange-700">Urgent Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-900">{stats.byPriority.Critical + stats.byPriority.High}</div>
            <div className="text-sm text-green-700">High Priority</div>
          </div>
        </div>
      </div>
    </div>
  );
}; 