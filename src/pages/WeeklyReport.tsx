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
import { useAccountsApi } from '../hooks/useAccountsApi';
import { useContactsApi } from '../hooks/useContactsApi';
import { useOpportunitiesApi } from '../hooks/useOpportunitiesApi';

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

interface WeeklySummary {
  totalDealValue: number;
  totalOpportunities: number;
  activeOpportunities: number;
  activitiesThisWeek: number;
  activitiesNextWeek: number;
  overdueActivities: number;
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
  // API hooks
  const { getOpportunities } = useOpportunitiesApi();
  const { fetchAccounts } = useAccountsApi();
  const { getContacts } = useContactsApi();
  
  // State
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
  }, [getOpportunities, fetchAccounts, getContacts]);

  useEffect(() => {
    if (opportunities.length > 0 && accounts.length > 0) {
      analyzeWeeklyData();
    }
  }, [opportunities, accounts, contacts, selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [oppsResult, accountsResult, contactsResult] = await Promise.all([
        getOpportunities(),
        fetchAccounts(),
        getContacts()
      ]);
      
      setOpportunities(oppsResult.opportunities);
      setAccounts(accountsResult.accounts);
      setContacts(contactsResult.contacts);
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



    // Analyze activities
    const allActivities: (ActivityType & { opportunity: Opportunity; account: Account })[] = [];
    const thisWeekActivities: typeof allActivities = [];
    const nextWeekActivities: typeof allActivities = [];
    let overdueCount = 0;

    opportunities.forEach(opp => {
      const account = accounts.find(a => a.id === opp.accountId);
      if (!account) return;

      (opp.activities || []).forEach(activity => {
        const activityDate = safeDateConversion(activity.dateTime);
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

    setWeeklyActivities(thisWeekActivities.sort((a, b) => {
      try {
        const timeA = (a.dateTime as any)?.toMillis ? (a.dateTime as any).toMillis() : new Date(a.dateTime).getTime();
        const timeB = (b.dateTime as any)?.toMillis ? (b.dateTime as any).toMillis() : new Date(b.dateTime).getTime();
        return timeB - timeA;
      } catch (error) {
        console.error('Date sorting error:', error);
        return 0;
      }
    }));
    setNextWeekActivities(nextWeekActivities.sort((a, b) => {
      try {
        const timeA = (a.dateTime as any)?.toMillis ? (a.dateTime as any).toMillis() : new Date(a.dateTime).getTime();
        const timeB = (b.dateTime as any)?.toMillis ? (b.dateTime as any).toMillis() : new Date(b.dateTime).getTime();
        return timeA - timeB;
      } catch (error) {
        console.error('Date sorting error:', error);
        return 0;
      }
    }));

    setSummary({
      totalDealValue,
      totalOpportunities: opportunities.length,
      activeOpportunities: activeOpps.length,
      activitiesThisWeek: thisWeekActivities.length,
      activitiesNextWeek: nextWeekActivities.length,
      overdueActivities: overdueCount
    });

    // Analyze opportunity progress
    const progress = activeOpps.map(opp => {
      const account = accounts.find(a => a.id === opp.accountId);
      const activities = (opp.activities || []).sort((a, b) => {
        try {
          const timeA = (a.dateTime as any)?.toMillis ? (a.dateTime as any).toMillis() : new Date(a.dateTime).getTime();
          const timeB = (b.dateTime as any)?.toMillis ? (b.dateTime as any).toMillis() : new Date(b.dateTime).getTime();
          return timeB - timeA;
        } catch (error) {
          console.error('Date sorting error:', error);
          return 0;
        }
      });
      const lastActivity = activities.find(a => a.status === 'Completed');
      const nextActivity = activities.find(a => a.status === 'Scheduled');

      // Detect weekly changes (simplified - would need proper change tracking)
      const weeklyChanges: string[] = [];
      if (opp.updatedAt && isWithinInterval(safeDateConversion(opp.updatedAt), { start: weekStart, end: weekEnd })) {
        weeklyChanges.push('Opportunity updated this week');
      }

      const thisWeekActivityCount = activities.filter(a => 
        isWithinInterval(safeDateConversion(a.dateTime), { start: weekStart, end: weekEnd })
      ).length;

      if (thisWeekActivityCount > 0) {
        weeklyChanges.push(`${thisWeekActivityCount} activities this week`);
      }

      // Risk factors
      const riskFactors: string[] = [];
      const daysSinceLastActivity = lastActivity ? 
        Math.floor((new Date().getTime() - safeDateConversion(lastActivity.dateTime).getTime()) / (1000 * 60 * 60 * 24)) : 
        999;

      if (daysSinceLastActivity > 14) {
        riskFactors.push(`${daysSinceLastActivity} days since last activity`);
      }

      const overdueActivities = activities.filter(a => 
        a.status === 'Scheduled' && safeDateConversion(a.dateTime) < new Date()
      );
      if (overdueActivities.length > 0) {
        riskFactors.push(`${overdueActivities.length} overdue activities`);
      }

      if (opp.expectedCloseDate && safeDateConversion(opp.expectedCloseDate) < addWeeks(new Date(), 2) && opp.stage === 'Discovery') {
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
        progress.opportunity.expectedCloseDate ? format(safeDateConversion(progress.opportunity.expectedCloseDate), 'MMM d, yyyy') : '',
        progress.lastActivity ? `${progress.lastActivity.subject} (${format(safeDateConversion(progress.lastActivity.dateTime), 'MMM d')})` : 'No recent activity',
        progress.nextActivity ? `${progress.nextActivity.subject} (${format(safeDateConversion(progress.nextActivity.dateTime), 'MMM d')})` : 'No scheduled activity',
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
        format(safeDateConversion(activity.dateTime), 'MMM d, yyyy'),
        format(safeDateConversion(activity.dateTime), 'h:mm a'),
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
        format(safeDateConversion(activity.dateTime), 'MMM d, yyyy'),
        format(safeDateConversion(activity.dateTime), 'h:mm a'),
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



          {/* Opportunity Progress */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Opportunity Progress & Status</h3>
            <div className="space-y-4">
              {opportunityProgress.slice(0, 15).map((progress) => {
                const priorityBorderColors = {
                  'Critical': 'border-l-red-500',
                  'High': 'border-l-orange-500', 
                  'Medium': 'border-l-yellow-500',
                  'Low': 'border-l-green-500'
                };
                const borderColor = priorityBorderColors[progress.opportunity.priority || 'Medium'];
                
                return (
                <div key={progress.opportunity.id} className={`border border-gray-200 ${borderColor} border-l-4 rounded-lg p-4 hover:bg-gray-50 transition-colors`}>
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

                      {/* Weekly Status and Risk Factors in one line */}
                      {(progress.weeklyChanges.length > 0 || progress.riskFactors.length > 0) && (
                        <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-start justify-between gap-4">
                            {/* This Week Updates */}
                            {progress.weeklyChanges.length > 0 && (
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  <span className="text-sm font-medium text-blue-700">This Week</span>
                                </div>
                                <div className="text-sm text-blue-600">
                                  {progress.weeklyChanges.join(' • ')}
                                </div>
                              </div>
                            )}
                            
                            {/* Risk Factors */}
                            {progress.riskFactors.length > 0 && (
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <AlertTriangle className="w-3 h-3 text-red-500" />
                                  <span className="text-sm font-medium text-red-700">Risks</span>
                                </div>
                                <div className="text-sm text-red-600">
                                  {progress.riskFactors.join(' • ')}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Activity Status with Notes */}
                      <div className="space-y-2">
                        {progress.lastActivity && (
                          <div className="flex items-start gap-2 p-2 bg-green-50 rounded-lg">
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-green-700">Last Activity</span>
                                <span className="text-xs text-green-600">
                                  {format(safeDateConversion(progress.lastActivity.dateTime), 'MMM d')}
                                </span>
                              </div>
                              <p className="text-sm text-green-800 font-medium">{progress.lastActivity.subject}</p>
                              {progress.lastActivity.notes && (
                                <p className="text-sm text-green-600 mt-1 line-clamp-2">{progress.lastActivity.notes}</p>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {progress.nextActivity && (
                          <div className="flex items-start gap-2 p-2 bg-blue-50 rounded-lg">
                            <Clock className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-blue-700">Next Activity</span>
                                <span className="text-xs text-blue-600">
                                  {format(safeDateConversion(progress.nextActivity.dateTime), 'MMM d')}
                                </span>
                              </div>
                              <p className="text-sm text-blue-800 font-medium">{progress.nextActivity.subject}</p>
                              {progress.nextActivity.notes && (
                                <p className="text-sm text-blue-600 mt-1 line-clamp-2">{progress.nextActivity.notes}</p>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {!progress.lastActivity && !progress.nextActivity && (
                          <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-lg">
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm text-yellow-700">No recent or scheduled activities</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right space-y-2">
                      <div>
                        <p className="text-xl font-bold text-gray-900">
                          ${(progress.opportunity.estimatedDealValue || 0).toLocaleString()}
                        </p>
                        {progress.opportunity.expectedCloseDate && (
                          <div className="flex flex-col items-end gap-1">
                            <p className="text-sm text-gray-500">
                              Close: {format(safeDateConversion(progress.opportunity.expectedCloseDate), 'MMM yyyy')}
                            </p>
                            {(() => {
                              const closeDate = safeDateConversion(progress.opportunity.expectedCloseDate);
                              const daysUntilClose = Math.ceil((closeDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                              if (daysUntilClose <= 0) {
                                return <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Overdue</span>;
                              } else if (daysUntilClose <= 30) {
                                return <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">{daysUntilClose} days left</span>;
                              } else if (daysUntilClose <= 60) {
                                return <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">{Math.ceil(daysUntilClose / 7)} weeks left</span>;
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                      
                      {/* Days in current stage indicator */}
                      {(() => {
                        const lastActivity = progress.lastActivity;
                        if (lastActivity) {
                          const daysSinceLastActivity = Math.floor((new Date().getTime() - safeDateConversion(lastActivity.dateTime).getTime()) / (1000 * 60 * 60 * 24));
                          if (daysSinceLastActivity > 7) {
                            return (
                              <div className="text-xs text-gray-500">
                                {daysSinceLastActivity} days since activity
                              </div>
                            );
                          }
                        }
                        return null;
                      })()}
                      
                      {/* Commercial model */}
                      {progress.opportunity.commercialModel && (
                        <div className="text-xs text-gray-500">
                          {progress.opportunity.commercialModel}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
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
                          {format(safeDateConversion(activity.dateTime), 'MMM d, h:mm a')}
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
                          {format(safeDateConversion(activity.dateTime), 'EEE, MMM d, h:mm a')}
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