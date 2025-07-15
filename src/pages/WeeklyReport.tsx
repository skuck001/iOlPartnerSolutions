import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  Download, 
  Mail, 
  TrendingUp, 
  DollarSign, 
  Target, 
  Users, 
  Activity, 
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Clock,
  CheckCircle,
  Building2,
  MapPin,
  Package,
  Copy
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, isWithinInterval, subWeeks, addWeeks, getISOWeek } from 'date-fns';
import * as XLSX from 'xlsx';
import type { 
  Opportunity, 
  Account, 
  Contact, 
  Activity as ActivityType,
  OpportunityStage,
  OpportunityPriority 
} from '../types';
import { getDocuments } from '../lib/firestore';

interface WeeklySummary {
  totalDealValue: number;
  totalOpportunities: number;
  activeOpportunities: number;
  activitiesThisWeek: number;
  activitiesNextWeek: number;
  overdueActivities: number;
  stageDistribution: Record<OpportunityStage, number>;
  priorityDistribution: Record<OpportunityPriority, number>;
}

interface OpportunityProgress {
  opportunity: Opportunity;
  account: Account | undefined;
  lastActivity: ActivityType | undefined;
  nextActivity: ActivityType | undefined;
  weeklyChanges: string[];
  riskFactors: string[];
}

export const WeeklyReport: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [opportunityProgress, setOpportunityProgress] = useState<OpportunityProgress[]>([]);
  const [weeklyActivities, setWeeklyActivities] = useState<(ActivityType & { opportunity: Opportunity; account: Account })[]>([]);
  const [nextWeekActivities, setNextWeekActivities] = useState<(ActivityType & { opportunity: Opportunity; account: Account })[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (opportunities.length > 0 && accounts.length > 0) {
      analyzeWeeklyData();
    }
  }, [opportunities, accounts, contacts, selectedDate]);

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

  const analyzeWeeklyData = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday start
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
    const nextWeekStart = addWeeks(weekStart, 1);
    const nextWeekEnd = addWeeks(weekEnd, 1);
    const lastWeekStart = subWeeks(weekStart, 1);
    const lastWeekEnd = subWeeks(weekEnd, 1);

    // Calculate summary metrics
    const activeOpps = opportunities.filter(opp => 
      !['Closed-Won', 'Closed-Lost'].includes(opp.stage)
    );

    const totalDealValue = activeOpps.reduce((sum, opp) => sum + (opp.estimatedDealValue || 0), 0);

    // Stage distribution
    const stageDistribution = activeOpps.reduce((acc, opp) => {
      acc[opp.stage] = (acc[opp.stage] || 0) + 1;
      return acc;
    }, {} as Record<OpportunityStage, number>);

    // Priority distribution
    const priorityDistribution = activeOpps.reduce((acc, opp) => {
      const priority = opp.priority || 'Medium';
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {} as Record<OpportunityPriority, number>);

    // Analyze activities
    const allActivities: (ActivityType & { opportunity: Opportunity; account: Account })[] = [];
    const thisWeekActivities: typeof allActivities = [];
    const nextWeekActivities: typeof allActivities = [];
    let overdueCount = 0;

    opportunities.forEach(opp => {
      const account = accounts.find(a => a.id === opp.accountId);
      if (!account) return;

      (opp.activities || []).forEach(activity => {
        const activityDate = activity.dateTime.toDate();
        const enhancedActivity = { ...activity, opportunity: opp, account };
        allActivities.push(enhancedActivity);

        // This week activities
        if (isWithinInterval(activityDate, { start: weekStart, end: weekEnd })) {
          thisWeekActivities.push(enhancedActivity);
        }

        // Next week activities
        if (isWithinInterval(activityDate, { start: nextWeekStart, end: nextWeekEnd })) {
          nextWeekActivities.push(enhancedActivity);
        }

        // Overdue activities
        if (activity.status === 'Scheduled' && activityDate < new Date()) {
          overdueCount++;
        }
      });
    });

    setWeeklyActivities(thisWeekActivities.sort((a, b) => b.dateTime.toMillis() - a.dateTime.toMillis()));
    setNextWeekActivities(nextWeekActivities.sort((a, b) => a.dateTime.toMillis() - b.dateTime.toMillis()));

    setSummary({
      totalDealValue,
      totalOpportunities: opportunities.length,
      activeOpportunities: activeOpps.length,
      activitiesThisWeek: thisWeekActivities.length,
      activitiesNextWeek: nextWeekActivities.length,
      overdueActivities: overdueCount,
      stageDistribution,
      priorityDistribution
    });

    // Analyze opportunity progress
    const progress = activeOpps.map(opp => {
      const account = accounts.find(a => a.id === opp.accountId);
      const activities = (opp.activities || []).sort((a, b) => b.dateTime.toMillis() - a.dateTime.toMillis());
      const lastActivity = activities.find(a => a.status === 'Completed');
      const nextActivity = activities.find(a => a.status === 'Scheduled');

      // Detect weekly changes (simplified - would need proper change tracking)
      const weeklyChanges: string[] = [];
      if (opp.updatedAt && isWithinInterval(opp.updatedAt.toDate(), { start: weekStart, end: weekEnd })) {
        weeklyChanges.push('Opportunity updated this week');
      }

      const thisWeekActivityCount = activities.filter(a => 
        isWithinInterval(a.dateTime.toDate(), { start: weekStart, end: weekEnd })
      ).length;

      if (thisWeekActivityCount > 0) {
        weeklyChanges.push(`${thisWeekActivityCount} activities this week`);
      }

      // Risk factors
      const riskFactors: string[] = [];
      const daysSinceLastActivity = lastActivity ? 
        Math.floor((new Date().getTime() - lastActivity.dateTime.toDate().getTime()) / (1000 * 60 * 60 * 24)) : 
        999;

      if (daysSinceLastActivity > 14) {
        riskFactors.push(`${daysSinceLastActivity} days since last activity`);
      }

      const overdueActivities = activities.filter(a => 
        a.status === 'Scheduled' && a.dateTime.toDate() < new Date()
      );
      if (overdueActivities.length > 0) {
        riskFactors.push(`${overdueActivities.length} overdue activities`);
      }

      if (opp.expectedCloseDate && opp.expectedCloseDate.toDate() < addWeeks(new Date(), 2) && opp.stage === 'Discovery') {
        riskFactors.push('Close date approaching but still in Discovery');
      }

      return {
        opportunity: opp,
        account,
        lastActivity,
        nextActivity,
        weeklyChanges,
        riskFactors
      };
    });

    // Sort by priority and risk factors
    progress.sort((a, b) => {
      const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
      const aPriority = priorityOrder[a.opportunity.priority || 'Medium'];
      const bPriority = priorityOrder[b.opportunity.priority || 'Medium'];
      
      if (aPriority !== bPriority) return aPriority - bPriority;
      return b.riskFactors.length - a.riskFactors.length;
    });

    setOpportunityProgress(progress);
  };

  const getStageColor = (stage: OpportunityStage) => {
    const colors = {
      'Discovery': 'bg-blue-100 text-blue-800',
      'Proposal': 'bg-yellow-100 text-yellow-800',
      'Negotiation': 'bg-orange-100 text-orange-800',
      'Closed-Won': 'bg-green-100 text-green-800',
      'Closed-Lost': 'bg-red-100 text-red-800'
    };
    return colors[stage];
  };

  const getPriorityColor = (priority: OpportunityPriority) => {
    const colors = {
      'Critical': 'bg-red-100 text-red-800',
      'High': 'bg-orange-100 text-orange-800',
      'Medium': 'bg-yellow-100 text-yellow-800',
      'Low': 'bg-green-100 text-green-800'
    };
    return colors[priority];
  };

  const getActivityIcon = (type: string) => {
    const icons = {
      'Meeting': Calendar,
      'Email': Mail,
      'Call': Users,
      'WhatsApp': Users,
      'Demo': Package,
      'Workshop': Users
    };
    return icons[type as keyof typeof icons] || Activity;
  };

  const exportToExcel = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
    
    // Create workbook
    const workbook = XLSX.utils.book_new();
    
    // Executive Summary Sheet
    const summaryData = [
      ['WEEKLY SALES REPORT'],
      [`Week of ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`],
      [''],
      ['EXECUTIVE SUMMARY'],
      ['Active Opportunities', summary?.activeOpportunities || 0],
      ['Total Pipeline Value', `$${(summary?.totalDealValue || 0).toLocaleString()}`],
      ['Activities This Week', summary?.activitiesThisWeek || 0],
      ['Upcoming Activities', summary?.activitiesNextWeek || 0],
      ['Overdue Activities', summary?.overdueActivities || 0],
      [''],
      ['PIPELINE BY STAGE'],
      ...Object.entries(summary?.stageDistribution || {}).map(([stage, count]) => [stage, count]),
      [''],
      ['PRIORITY DISTRIBUTION'],
      ...Object.entries(summary?.priorityDistribution || {}).map(([priority, count]) => [priority, count])
    ];
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Executive Summary');
    
    // Opportunities Detail Sheet
    const opportunityHeaders = [
      'Opportunity Title',
      'Account',
      'Stage',
      'Priority',
      'Deal Value',
      'Region',
      'iOL Products',
      'Commercial Model',
      'Expected Close Date',
      'Last Activity',
      'Next Activity',
      'Weekly Changes',
      'Risk Factors'
    ];
    
    const opportunityData = [
      opportunityHeaders,
      ...opportunityProgress.map(progress => [
        progress.opportunity.title,
        progress.account?.name || 'Unknown',
        progress.opportunity.stage,
        progress.opportunity.priority || 'Medium',
        `$${(progress.opportunity.estimatedDealValue || 0).toLocaleString()}`,
        progress.opportunity.region || '',
        progress.opportunity.iolProducts?.join(', ') || '',
        progress.opportunity.commercialModel || '',
        progress.opportunity.expectedCloseDate ? format(progress.opportunity.expectedCloseDate.toDate(), 'MMM d, yyyy') : '',
        progress.lastActivity ? `${progress.lastActivity.subject} (${format(progress.lastActivity.dateTime.toDate(), 'MMM d')})` : 'No recent activity',
        progress.nextActivity ? `${progress.nextActivity.subject} (${format(progress.nextActivity.dateTime.toDate(), 'MMM d')})` : 'No scheduled activity',
        progress.weeklyChanges.join('; '),
        progress.riskFactors.join('; ')
      ])
    ];
    
    const opportunitySheet = XLSX.utils.aoa_to_sheet(opportunityData);
    XLSX.utils.book_append_sheet(workbook, opportunitySheet, 'Opportunities');
    
    // Activities This Week Sheet
    const activitiesHeaders = [
      'Date',
      'Time',
      'Activity Type',
      'Subject',
      'Status',
      'Method',
      'Opportunity',
      'Account',
      'Notes'
    ];
    
    const activitiesData = [
      activitiesHeaders,
      ...weeklyActivities.map(activity => [
        format(activity.dateTime.toDate(), 'MMM d, yyyy'),
        format(activity.dateTime.toDate(), 'h:mm a'),
        activity.activityType,
        activity.subject,
        activity.status,
        activity.method,
        activity.opportunity.title,
        activity.account.name,
        activity.notes || ''
      ])
    ];
    
    const activitiesSheet = XLSX.utils.aoa_to_sheet(activitiesData);
    XLSX.utils.book_append_sheet(workbook, activitiesSheet, 'This Week Activities');
    
    // Next Week Activities Sheet
    const nextWeekData = [
      activitiesHeaders,
      ...nextWeekActivities.map(activity => [
        format(activity.dateTime.toDate(), 'MMM d, yyyy'),
        format(activity.dateTime.toDate(), 'h:mm a'),
        activity.activityType,
        activity.subject,
        activity.status,
        activity.method,
        activity.opportunity.title,
        activity.account.name,
        activity.notes || ''
      ])
    ];
    
    const nextWeekSheet = XLSX.utils.aoa_to_sheet(nextWeekData);
    XLSX.utils.book_append_sheet(workbook, nextWeekSheet, 'Next Week Activities');
    
    // Generate filename
    const filename = `Weekly_Sales_Report_${format(weekStart, 'yyyy-MM-dd')}.xlsx`;
    
    // Save file
    XLSX.writeFile(workbook, filename);
  };

  const copyToClipboard = async () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
    
    let emailContent = `WEEKLY SALES REPORT\n`;
    emailContent += `Week of ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}\n\n`;
    
    emailContent += `EXECUTIVE SUMMARY\n`;
    emailContent += `================\n`;
    emailContent += `Active Opportunities: ${summary?.activeOpportunities || 0}\n`;
    emailContent += `Total Pipeline Value: $${(summary?.totalDealValue || 0).toLocaleString()}\n`;
    emailContent += `Activities This Week: ${summary?.activitiesThisWeek || 0}\n`;
    emailContent += `Upcoming Activities: ${summary?.activitiesNextWeek || 0}\n`;
    if ((summary?.overdueActivities || 0) > 0) {
      emailContent += `⚠️ Overdue Activities: ${summary?.overdueActivities}\n`;
    }
    emailContent += `\n`;

    emailContent += `PIPELINE BY STAGE\n`;
    emailContent += `================\n`;
    Object.entries(summary?.stageDistribution || {}).forEach(([stage, count]) => {
      emailContent += `${stage}: ${count} opportunities\n`;
    });
    emailContent += `\n`;

    emailContent += `KEY OPPORTUNITIES\n`;
    emailContent += `================\n`;
    opportunityProgress.slice(0, 10).forEach(progress => {
      emailContent += `• ${progress.opportunity.title} (${progress.account?.name})\n`;
      emailContent += `  Stage: ${progress.opportunity.stage} | Value: $${(progress.opportunity.estimatedDealValue || 0).toLocaleString()}\n`;
      if (progress.weeklyChanges.length > 0) {
        emailContent += `  Updates: ${progress.weeklyChanges.join(', ')}\n`;
      }
      if (progress.riskFactors.length > 0) {
        emailContent += `  ⚠️ Risks: ${progress.riskFactors.join(', ')}\n`;
      }
      emailContent += `\n`;
    });

    try {
      await navigator.clipboard.writeText(emailContent);
      alert('Report copied to clipboard! You can now paste it into an email.');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert('Failed to copy to clipboard. Please try again.');
    }
  };

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

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
            <h1 className="text-2xl font-semibold text-gray-900">Weekly Sales Report</h1>
            <p className="text-sm text-gray-500">
              Week of {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="week"
              value={`${selectedDate.getFullYear()}-W${getISOWeek(selectedDate).toString().padStart(2, '0')}`}
              onChange={(e) => {
                const [year, week] = e.target.value.split('-W');
                const date = new Date(parseInt(year), 0, 1 + (parseInt(week) - 1) * 7);
                setSelectedDate(date);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              onClick={copyToClipboard}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50"
            >
              <Copy className="h-4 w-4" />
              Copy for Email
            </button>
            <button
              onClick={exportToExcel}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50"
            >
              <Download className="h-4 w-4" />
              Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Executive Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-primary-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Executive Summary</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Active Opportunities</p>
                    <p className="text-2xl font-bold text-blue-900">{summary?.activeOpportunities || 0}</p>
                  </div>
                  <Target className="h-8 w-8 text-blue-500" />
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Pipeline Value</p>
                    <p className="text-2xl font-bold text-green-900">${(summary?.totalDealValue || 0).toLocaleString()}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-500" />
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">This Week Activities</p>
                    <p className="text-2xl font-bold text-purple-900">{summary?.activitiesThisWeek || 0}</p>
                  </div>
                  <Activity className="h-8 w-8 text-purple-500" />
                </div>
              </div>

              <div className="bg-orange-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600">Next Week Planned</p>
                    <p className="text-2xl font-bold text-orange-900">{summary?.activitiesNextWeek || 0}</p>
                  </div>
                  <Calendar className="h-8 w-8 text-orange-500" />
                </div>
              </div>
            </div>

            {/* Risk Alert */}
            {(summary?.overdueActivities || 0) > 0 && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <p className="text-sm font-medium text-red-800">
                    ⚠️ {summary?.overdueActivities} overdue activities require attention
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Pipeline Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pipeline by Stage</h3>
              <div className="space-y-3">
                {Object.entries(summary?.stageDistribution || {}).map(([stage, count]) => (
                  <div key={stage} className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2.5 py-1 text-sm font-medium rounded-full ${getStageColor(stage as OpportunityStage)}`}>
                      {stage}
                    </span>
                    <span className="text-lg font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Distribution</h3>
              <div className="space-y-3">
                {Object.entries(summary?.priorityDistribution || {}).map(([priority, count]) => (
                  <div key={priority} className="flex items-center justify-between">
                    <span className={`inline-flex items-center px-2.5 py-1 text-sm font-medium rounded-full ${getPriorityColor(priority as OpportunityPriority)}`}>
                      {priority}
                    </span>
                    <span className="text-lg font-semibold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Opportunity Progress */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Opportunity Progress & Status</h3>
            <div className="space-y-4">
              {opportunityProgress.slice(0, 15).map((progress) => (
                <div key={progress.opportunity.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Link
                          to={`/opportunities/${progress.opportunity.id}`}
                          className="text-lg font-medium text-gray-900 hover:text-primary-600"
                        >
                          {progress.opportunity.title}
                        </Link>
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStageColor(progress.opportunity.stage)}`}>
                          {progress.opportunity.stage}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(progress.opportunity.priority || 'Medium')}`}>
                          {progress.opportunity.priority || 'Medium'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {progress.account?.name || 'Unknown Account'}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {progress.opportunity.region || 'No region'}
                        </div>
                        {progress.opportunity.iolProducts && progress.opportunity.iolProducts.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {progress.opportunity.iolProducts.slice(0, 2).join(', ')}
                            {progress.opportunity.iolProducts.length > 2 && ` +${progress.opportunity.iolProducts.length - 2}`}
                          </div>
                        )}
                      </div>

                      {/* Weekly Changes */}
                      {progress.weeklyChanges.length > 0 && (
                        <div className="mb-2">
                          <p className="text-sm text-blue-700 font-medium">This Week:</p>
                          <ul className="text-sm text-blue-600 ml-4">
                            {progress.weeklyChanges.map((change, idx) => (
                              <li key={idx}>• {change}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Risk Factors */}
                      {progress.riskFactors.length > 0 && (
                        <div className="mb-2">
                          <p className="text-sm text-red-700 font-medium">⚠️ Risk Factors:</p>
                          <ul className="text-sm text-red-600 ml-4">
                            {progress.riskFactors.map((risk, idx) => (
                              <li key={idx}>• {risk}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Activity Status */}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {progress.lastActivity && (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            Last: {progress.lastActivity.subject} ({format(progress.lastActivity.dateTime.toDate(), 'MMM d')})
                          </div>
                        )}
                        {progress.nextActivity && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-blue-500" />
                            Next: {progress.nextActivity.subject} ({format(progress.nextActivity.dateTime.toDate(), 'MMM d')})
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">
                        ${(progress.opportunity.estimatedDealValue || 0).toLocaleString()}
                      </p>
                      {progress.opportunity.expectedCloseDate && (
                        <p className="text-sm text-gray-500">
                          Close: {format(progress.opportunity.expectedCloseDate.toDate(), 'MMM yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* This Week's Activities */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">This Week's Activities</h3>
            {weeklyActivities.length > 0 ? (
              <div className="space-y-3">
                {weeklyActivities.map((activity) => {
                  const ActivityIcon = getActivityIcon(activity.activityType);
                  const isCompleted = activity.status === 'Completed';
                  return (
                    <div key={activity.id} className={`flex items-center gap-4 p-3 rounded-lg border ${
                      isCompleted ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className={`p-2 rounded-lg ${
                        isCompleted ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <ActivityIcon className={`h-4 w-4 ${
                          isCompleted ? 'text-green-600' : 'text-gray-600'
                        }`} />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{activity.subject}</p>
                        <p className="text-sm text-gray-600">
                          {activity.opportunity.title} • {activity.account.name}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {format(activity.dateTime.toDate(), 'MMM d, h:mm a')}
                        </p>
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                          isCompleted ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {activity.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No activities recorded for this week</p>
            )}
          </div>

          {/* Next Week's Planned Activities */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Next Week's Planned Activities</h3>
            {nextWeekActivities.length > 0 ? (
              <div className="space-y-3">
                {nextWeekActivities.map((activity) => {
                  const ActivityIcon = getActivityIcon(activity.activityType);
                  return (
                    <div key={activity.id} className="flex items-center gap-4 p-3 rounded-lg border bg-blue-50 border-blue-200">
                      <div className="p-2 rounded-lg bg-blue-100">
                        <ActivityIcon className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{activity.subject}</p>
                        <p className="text-sm text-gray-600">
                          {activity.opportunity.title} • {activity.account.name}
                        </p>
                                      {activity.notes && (
                <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{activity.notes}</p>
              )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {format(activity.dateTime.toDate(), 'EEE, MMM d, h:mm a')}
                        </p>
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {activity.activityType} • {activity.method}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No activities planned for next week</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 