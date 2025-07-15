import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  DollarSign, 
  Target, 
  MapPin, 
  Calendar, 
  Users, 
  Building2,
  Package,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  Activity,
  BarChart3,
  PieChart,
  Globe,
  Zap
} from 'lucide-react';
import { format, isAfter, isBefore, addDays, differenceInDays } from 'date-fns';
import type { 
  Opportunity, 
  Account, 
  Contact, 
  OpportunityStage, 
  OpportunityPriority 
} from '../types';
import { getDocuments } from '../lib/firestore';

interface PipelineMetrics {
  totalOpportunities: number;
  totalValue: number;
  activeOpportunities: number;
  activeValue: number;
  averageDealSize: number;
  conversionRate: number;
  stageDistribution: Record<OpportunityStage, { count: number; value: number }>;
  priorityDistribution: Record<OpportunityPriority, { count: number; value: number }>;
  regionalBreakdown: Record<string, { count: number; value: number }>;
  productBreakdown: Record<string, { count: number; value: number }>;
}

interface OpportunityHealth {
  healthy: Opportunity[];
  atRisk: Opportunity[];
  stalled: Opportunity[];
  closingSoon: Opportunity[];
}

export const OpportunityInsights: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<PipelineMetrics | null>(null);
  const [health, setHealth] = useState<OpportunityHealth | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (opportunities.length > 0) {
      calculateMetrics();
      analyzeHealth();
    }
  }, [opportunities, accounts]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [oppsData, accountsData, contactsData] = await Promise.all([
        getDocuments('opportunities'),
        getDocuments('accounts'),
        getDocuments('contacts')
      ]);
      
      setOpportunities(oppsData as Opportunity[]);
      setAccounts(accountsData as Account[]);
      setContacts(contactsData as Contact[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = () => {
    const activeOpps = opportunities.filter(opp => 
      !['Closed-Won', 'Closed-Lost'].includes(opp.stage)
    );

    const totalValue = opportunities.reduce((sum, opp) => sum + (opp.estimatedDealValue || 0), 0);
    const activeValue = activeOpps.reduce((sum, opp) => sum + (opp.estimatedDealValue || 0), 0);
    const closedWon = opportunities.filter(opp => opp.stage === 'Closed-Won');
    const conversionRate = opportunities.length > 0 ? (closedWon.length / opportunities.length) * 100 : 0;

    // Stage distribution
    const stageDistribution = opportunities.reduce((acc, opp) => {
      if (!acc[opp.stage]) {
        acc[opp.stage] = { count: 0, value: 0 };
      }
      acc[opp.stage].count++;
      acc[opp.stage].value += opp.estimatedDealValue || 0;
      return acc;
    }, {} as Record<OpportunityStage, { count: number; value: number }>);

    // Priority distribution
    const priorityDistribution = opportunities.reduce((acc, opp) => {
      const priority = opp.priority || 'Medium';
      if (!acc[priority]) {
        acc[priority] = { count: 0, value: 0 };
      }
      acc[priority].count++;
      acc[priority].value += opp.estimatedDealValue || 0;
      return acc;
    }, {} as Record<OpportunityPriority, { count: number; value: number }>);

    // Regional breakdown
    const regionalBreakdown = opportunities.reduce((acc, opp) => {
      const region = opp.region || 'Unknown';
      if (!acc[region]) {
        acc[region] = { count: 0, value: 0 };
      }
      acc[region].count++;
      acc[region].value += opp.estimatedDealValue || 0;
      return acc;
    }, {} as Record<string, { count: number; value: number }>);

    // Product breakdown
    const productBreakdown = opportunities.reduce((acc, opp) => {
      const products = opp.iolProducts || [];
      if (products.length === 0) {
        const key = 'No Products Defined';
        if (!acc[key]) acc[key] = { count: 0, value: 0 };
        acc[key].count++;
        acc[key].value += opp.estimatedDealValue || 0;
      } else {
        products.forEach(product => {
          if (!acc[product]) {
            acc[product] = { count: 0, value: 0 };
          }
          acc[product].count++;
          acc[product].value += (opp.estimatedDealValue || 0) / products.length; // Split value across products
        });
      }
      return acc;
    }, {} as Record<string, { count: number; value: number }>);

    setMetrics({
      totalOpportunities: opportunities.length,
      totalValue,
      activeOpportunities: activeOpps.length,
      activeValue,
      averageDealSize: activeOpps.length > 0 ? activeValue / activeOpps.length : 0,
      conversionRate,
      stageDistribution,
      priorityDistribution,
      regionalBreakdown,
      productBreakdown
    });
  };

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
      if (opp.expectedCloseDate && isBefore(opp.expectedCloseDate.toDate(), addDays(now, 30))) {
        closingSoon.push(opp);
      }

      // Check if stalled (no activity in last 14 days)
      const lastActivity = opp.activities && opp.activities.length > 0 
        ? opp.activities.sort((a, b) => b.dateTime.toMillis() - a.dateTime.toMillis())[0]
        : null;
      
      const daysSinceLastActivity = lastActivity 
        ? differenceInDays(now, lastActivity.dateTime.toDate())
        : 999;

      if (daysSinceLastActivity > 14) {
        stalled.push(opp);
      }

      // Check if at risk (overdue activities, long sales cycle, etc.)
      const overdueActivities = (opp.activities || []).filter(activity => 
        activity.status === 'Scheduled' && isBefore(activity.dateTime.toDate(), now)
      );

      const isAtRisk = overdueActivities.length > 0 || 
                     daysSinceLastActivity > 7 ||
                     (opp.expectedCloseDate && 
                      isBefore(opp.expectedCloseDate.toDate(), addDays(now, 7)) && 
                      opp.stage === 'Discovery');

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

  const getStageColor = (stage: OpportunityStage) => {
    const colors = {
      'Discovery': 'bg-blue-100 text-blue-800 border-blue-200',
      'Proposal': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Negotiation': 'bg-orange-100 text-orange-800 border-orange-200',
      'Closed-Won': 'bg-green-100 text-green-800 border-green-200',
      'Closed-Lost': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[stage];
  };

  const getPriorityColor = (priority: OpportunityPriority) => {
    const colors = {
      'Critical': 'bg-red-100 text-red-800 border-red-200',
      'High': 'bg-orange-100 text-orange-800 border-orange-200',
      'Medium': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Low': 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[priority];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Opportunity Insights</h1>
            <p className="text-sm text-gray-500">
              Comprehensive analysis of pipeline performance and opportunity health
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/opportunities"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Target className="h-4 w-4" />
              View All Opportunities
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Pipeline</p>
                  <p className="text-2xl font-bold text-gray-900">${(metrics?.totalValue || 0).toLocaleString()}</p>
                  <p className="text-sm text-gray-500">{metrics?.totalOpportunities || 0} opportunities</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Pipeline</p>
                  <p className="text-2xl font-bold text-gray-900">${(metrics?.activeValue || 0).toLocaleString()}</p>
                  <p className="text-sm text-gray-500">{metrics?.activeOpportunities || 0} active</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <Target className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Deal Size</p>
                  <p className="text-2xl font-bold text-gray-900">${(metrics?.averageDealSize || 0).toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Active opportunities</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Win Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{(metrics?.conversionRate || 0).toFixed(1)}%</p>
                  <p className="text-sm text-gray-500">Historical conversion</p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Pipeline Health */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Healthy</h3>
                  <p className="text-sm text-gray-500">Active engagement</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{health?.healthy.length || 0}</p>
                <p className="text-sm text-gray-500">opportunities</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">At Risk</h3>
                  <p className="text-sm text-gray-500">Needs attention</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-yellow-600">{health?.atRisk.length || 0}</p>
                <p className="text-sm text-gray-500">opportunities</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Clock className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Stalled</h3>
                  <p className="text-sm text-gray-500">No recent activity</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-red-600">{health?.stalled.length || 0}</p>
                <p className="text-sm text-gray-500">opportunities</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Zap className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Closing Soon</h3>
                  <p className="text-sm text-gray-500">Next 30 days</p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-orange-600">{health?.closingSoon.length || 0}</p>
                <p className="text-sm text-gray-500">opportunities</p>
              </div>
            </div>
          </div>

          {/* Pipeline Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Stage Distribution */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <PieChart className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Pipeline by Stage</h3>
              </div>
              <div className="space-y-4">
                {Object.entries(metrics?.stageDistribution || {}).map(([stage, data]) => (
                  <div key={stage} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2.5 py-1 text-sm font-medium rounded-full border ${getStageColor(stage as OpportunityStage)}`}>
                        {stage}
                      </span>
                      <span className="text-sm text-gray-600">{data.count} ops</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">${data.value.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">
                        {metrics?.totalValue ? ((data.value / metrics.totalValue) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority Distribution */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Pipeline by Priority</h3>
              </div>
              <div className="space-y-4">
                {Object.entries(metrics?.priorityDistribution || {}).map(([priority, data]) => (
                  <div key={priority} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2.5 py-1 text-sm font-medium rounded-full border ${getPriorityColor(priority as OpportunityPriority)}`}>
                        {priority}
                      </span>
                      <span className="text-sm text-gray-600">{data.count} ops</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">${data.value.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">
                        {metrics?.totalValue ? ((data.value / metrics.totalValue) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Regional & Product Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Regional Breakdown */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Globe className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Regional Distribution</h3>
              </div>
              <div className="space-y-3">
                {Object.entries(metrics?.regionalBreakdown || {})
                  .sort(([,a], [,b]) => b.value - a.value)
                  .slice(0, 6)
                  .map(([region, data]) => (
                  <div key={region} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{region}</p>
                        <p className="text-sm text-gray-500">{data.count} opportunities</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">${data.value.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Product Breakdown */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Package className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">iOL Products</h3>
              </div>
              <div className="space-y-3">
                {Object.entries(metrics?.productBreakdown || {})
                  .sort(([,a], [,b]) => b.value - a.value)
                  .slice(0, 6)
                  .map(([product, data]) => (
                  <div key={product} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Package className="h-4 w-4 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{product}</p>
                        <p className="text-xs text-gray-500">{data.count} opportunities</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 text-sm">${data.value.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* At Risk Opportunities */}
          {health?.atRisk && health.atRisk.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Opportunities Requiring Attention</h3>
              </div>
              <div className="space-y-4">
                {health.atRisk.slice(0, 5).map((opp) => {
                  const account = accounts.find(a => a.id === opp.accountId);
                  const lastActivity = opp.activities && opp.activities.length > 0 
                    ? opp.activities.sort((a, b) => b.dateTime.toMillis() - a.dateTime.toMillis())[0]
                    : null;
                  
                  return (
                    <div key={opp.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Link
                              to={`/opportunities/${opp.id}`}
                              className="text-lg font-medium text-gray-900 hover:text-primary-600"
                            >
                              {opp.title}
                            </Link>
                            <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full border ${getStageColor(opp.stage)}`}>
                              {opp.stage}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {account?.name || 'Unknown Account'}
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {opp.region || 'No region'}
                            </div>
                          </div>
                          {lastActivity && (
                            <p className="text-sm text-gray-500">
                              Last activity: {lastActivity.subject} ({format(lastActivity.dateTime.toDate(), 'MMM d, yyyy')})
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-gray-900">
                            ${(opp.estimatedDealValue || 0).toLocaleString()}
                          </p>
                          {opp.expectedCloseDate && (
                            <p className="text-sm text-gray-500">
                              Close: {format(opp.expectedCloseDate.toDate(), 'MMM yyyy')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 