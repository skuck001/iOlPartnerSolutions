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
  Package,
  Copy,
  Sparkles,
  ChevronDown,
  ChevronRight
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
  closedWonOpportunities: number;
  closedLostOpportunities: number;
  activitiesThisWeek: number;
  activitiesNextWeek: number;
  overdueActivities: number;
  totalBlockers: number;
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
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();
  }, [getOpportunities, fetchAccounts, getContacts]);

  useEffect(() => {
    if (opportunities.length > 0 && accounts.length > 0) {
      analyzeWeeklyData();
    }
  }, [opportunities, accounts, contacts, selectedDate]);

  // Initialize all groups as expanded when opportunity progress changes
  useEffect(() => {
    if (opportunityProgress.length > 0) {
      const accountNames = opportunityProgress
        .slice(0, 15)
        .reduce((accounts, progress) => {
          const accountName = progress.account?.name || 'Unknown Account';
          accounts.add(accountName);
          return accounts;
        }, new Set<string>());
      
      const initialExpandedState: Record<string, boolean> = {};
      accountNames.forEach(accountName => {
        initialExpandedState[accountName] = true; // Start expanded
      });
      setExpandedGroups(initialExpandedState);
    }
  }, [opportunityProgress]);

  const toggleGroup = (accountName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [accountName]: !prev[accountName]
    }));
  };

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
    
    const closedWonOpps = opportunities.filter(opp => opp.stage === 'Closed-Won');
    const closedLostOpps = opportunities.filter(opp => opp.stage === 'Closed-Lost');

    const totalDealValue = activeOpps.reduce((sum, opp) => sum + (opp.estimatedDealValue || 0), 0);



    // Analyze activities
    const allActivities: (ActivityType & { opportunity: Opportunity; account: Account })[] = [];
    const thisWeekActivities: typeof allActivities = [];
    const nextWeekActivities: typeof allActivities = [];
    let overdueCount = 0;
    let totalBlockersCount = 0;

    opportunities.forEach(opp => {
      const account = accounts.find(a => a.id === opp.accountId);
      if (!account) return;

      // Count unresolved blockers
      if (opp.blockers && opp.blockers.length > 0) {
        totalBlockersCount += opp.blockers.filter(blocker => !blocker.completed).length;
      }

      (opp.activities || []).forEach(activity => {
        const activityDate = safeDateConversion(activity.dateTime);
        const enhancedActivity = { ...activity, opportunity: opp, account };
        allActivities.push(enhancedActivity);

        // This week activities
        if (isWithinInterval(activityDate, { start: new Date(weekStart), end: new Date(weekEnd) })) {
          thisWeekActivities.push(enhancedActivity);
        }

        // Next week activities
        if (isWithinInterval(activityDate, { start: new Date(nextWeekStart), end: new Date(nextWeekEnd) })) {
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
        const timeA = (a.dateTime as any)?.toMillis ? (a.dateTime as any).toMillis() : safeDateConversion(a.dateTime).getTime();
        const timeB = (b.dateTime as any)?.toMillis ? (b.dateTime as any).toMillis() : safeDateConversion(b.dateTime).getTime();
        return timeB - timeA;
      } catch (error) {
        console.error('Date sorting error:', error);
        return 0;
      }
    }));
    setNextWeekActivities(nextWeekActivities.sort((a, b) => {
      try {
        const timeA = (a.dateTime as any)?.toMillis ? (a.dateTime as any).toMillis() : safeDateConversion(a.dateTime).getTime();
        const timeB = (b.dateTime as any)?.toMillis ? (b.dateTime as any).toMillis() : safeDateConversion(b.dateTime).getTime();
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
      closedWonOpportunities: closedWonOpps.length,
      closedLostOpportunities: closedLostOpps.length,
      activitiesThisWeek: thisWeekActivities.length,
      activitiesNextWeek: nextWeekActivities.length,
      overdueActivities: overdueCount,
      totalBlockers: totalBlockersCount
    });

    // Analyze opportunity progress
    const progress = activeOpps.map(opp => {
      const account = accounts.find(a => a.id === opp.accountId);
      const activities = (opp.activities || []).sort((a, b) => {
        try {
          const timeA = (a.dateTime as any)?.toMillis ? (a.dateTime as any).toMillis() : safeDateConversion(a.dateTime).getTime();
          const timeB = (b.dateTime as any)?.toMillis ? (b.dateTime as any).toMillis() : safeDateConversion(b.dateTime).getTime();
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
      const thisWeekActivityCount = activities.filter(a => 
        isWithinInterval(safeDateConversion(a.dateTime), { start: new Date(weekStart), end: new Date(weekEnd) })
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

      // Check for unresolved blockers
      const unresolvedBlockers = opp.blockers ? opp.blockers.filter(blocker => !blocker.completed) : [];
      if (unresolvedBlockers.length > 0) {
        riskFactors.push(`${unresolvedBlockers.length} active blockers`);
      }

      if (opp.expectedCloseDate && safeDateConversion(opp.expectedCloseDate) < addWeeks(new Date(), 2) && opp.stage === 'Lead') {
        riskFactors.push('Close date approaching but still in Lead stage');
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
      'Lead': 'bg-gray-100 text-gray-800',
      'Qualified': 'bg-blue-100 text-blue-800',
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
      ['Closed Won Opportunities', summary?.closedWonOpportunities || 0],
      ['Closed Lost Opportunities', summary?.closedLostOpportunities || 0],
      ['Total Pipeline Value', `$${(summary?.totalDealValue || 0).toLocaleString()}`],
      ['Activities This Week', summary?.activitiesThisWeek || 0],
      ['Upcoming Activities', summary?.activitiesNextWeek || 0],
      ['Overdue Activities', summary?.overdueActivities || 0],
      ['Active Blockers', summary?.totalBlockers || 0],

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
      'iOL Products',
      'Commercial Model',
      'Expected Close Date',
      'Executive Summary',
      'Last Activity',
      'Last Activity Details',
      'Next Activity',
      'Next Activity Details',
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
        progress.opportunity.iolProducts?.join(', ') || '',
        progress.opportunity.commercialModel || '',
        progress.opportunity.expectedCloseDate ? format(safeDateConversion(progress.opportunity.expectedCloseDate), 'MMM d, yyyy') : '',
        progress.opportunity.aiSummary || '',
        progress.lastActivity ? `${progress.lastActivity.subject} (${format(safeDateConversion(progress.lastActivity.dateTime), 'MMM d')})` : 'No recent activity',
        progress.lastActivity ? (progress.lastActivity.details || progress.lastActivity.notes || '') : '',
        progress.nextActivity ? `${progress.nextActivity.subject} (${format(safeDateConversion(progress.nextActivity.dateTime), 'MMM d')})` : 'No scheduled activity',
        progress.nextActivity ? (progress.nextActivity.details || progress.nextActivity.notes || '') : '',
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

  const generateEmailContent = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
    
    let emailContent = `WEEKLY SALES REPORT\n`;
    emailContent += `Week of ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}\n\n`;
    
    emailContent += `EXECUTIVE SUMMARY\n`;
    emailContent += `================\n`;
    emailContent += `Active Opportunities: ${summary?.activeOpportunities || 0}\n`;
    emailContent += `Closed Won: ${summary?.closedWonOpportunities || 0}\n`;
    emailContent += `Closed Lost: ${summary?.closedLostOpportunities || 0}\n`;
    emailContent += `Total Pipeline Value: $${(summary?.totalDealValue || 0).toLocaleString()}\n`;
    emailContent += `Activities This Week: ${summary?.activitiesThisWeek || 0}\n`;
    emailContent += `Upcoming Activities: ${summary?.activitiesNextWeek || 0}\n`;
    if ((summary?.overdueActivities || 0) > 0) {
      emailContent += `⚠️ Overdue Activities: ${summary?.overdueActivities}\n`;
    }
    if ((summary?.totalBlockers || 0) > 0) {
      emailContent += `🚫 Active Blockers: ${summary?.totalBlockers}\n`;
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

    return emailContent;
  };

  const copyToClipboard = async () => {
    try {
      const emailContent = generateEmailContent();
      await navigator.clipboard.writeText(emailContent);
      alert('Report copied to clipboard! You can now paste it into an email.');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert('Failed to copy to clipboard. Please try again.');
    }
  };

  const openInOutlook = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
    
    const subject = `Weekly Sales Report - ${format(weekStart, 'MMM d')} to ${format(weekEnd, 'MMM d, yyyy')}`;
    const body = generateEmailContent();
    
    // URL encode the subject and body
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    
    // Create mailto URL
    const mailtoUrl = `mailto:?subject=${encodedSubject}&body=${encodedBody}`;
    
    // Open email client
    try {
      window.open(mailtoUrl);
    } catch (err) {
      console.error('Failed to open email client:', err);
      alert('Failed to open email client. Please try copying the content instead.');
    }
  };

  const copyOpportunityCards = async () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });

    // Group opportunities by account (matching the visual display)
    const groupedByAccount = opportunityProgress.slice(0, 15).reduce((groups, progress) => {
      const accountName = progress.account?.name || 'Unknown Account';
      if (!groups[accountName]) {
        groups[accountName] = [];
      }
      groups[accountName].push(progress);
      return groups;
    }, {} as Record<string, typeof opportunityProgress>);

    let emailContent = `OPPORTUNITY PROGRESS & STATUS\n`;
    emailContent += `Week of ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}\n`;
    emailContent += `${'='.repeat(80)}\n\n`;

    // Create content for each account group
    Object.keys(groupedByAccount).sort().forEach((accountName) => {
      const accountOpportunities = groupedByAccount[accountName];
      
      // Account header
      emailContent += `🏢 ${accountName.toUpperCase()} (${accountOpportunities.length} opportunit${accountOpportunities.length !== 1 ? 'ies' : 'y'})\n`;
      emailContent += `${'─'.repeat(80)}\n\n`;

      // Create table header
      emailContent += `| Opportunity | Stage | Value | Priority | Last Activity | Next Activity | Status |\n`;
      emailContent += `|-------------|-------|-------|----------|---------------|---------------|--------|\n`;

      // Add each opportunity as a table row
      accountOpportunities.forEach((progress) => {
        const opportunityName = progress.opportunity.title.length > 25 
          ? progress.opportunity.title.substring(0, 22) + '...' 
          : progress.opportunity.title;
        
        const stage = progress.opportunity.stage;
        
        const value = `$${(progress.opportunity.estimatedDealValue || 0).toLocaleString()}`;
        
        const priority = progress.opportunity.priority || 'Medium';
        
        const lastActivity = progress.lastActivity 
          ? `${progress.lastActivity.subject.substring(0, 20)}${progress.lastActivity.subject.length > 20 ? '...' : ''} (${format(safeDateConversion(progress.lastActivity.dateTime), 'MMM d')})`
          : 'None';
        
        const nextActivity = progress.nextActivity 
          ? `${progress.nextActivity.subject.substring(0, 20)}${progress.nextActivity.subject.length > 20 ? '...' : ''} (${format(safeDateConversion(progress.nextActivity.dateTime), 'MMM d')})`
          : 'None';
        
        let status = '';
        if (progress.riskFactors.length > 0) {
          status = '⚠️ Risks';
        } else if (progress.weeklyChanges.length > 0) {
          status = '📈 Active';
        } else {
          status = '✅ On Track';
        }

        emailContent += `| ${opportunityName} | ${stage} | ${value} | ${priority} | ${lastActivity} | ${nextActivity} | ${status} |\n`;
      });

      emailContent += `\n`;

      // Add detailed information for high priority or risky opportunities
      const importantOpportunities = accountOpportunities.filter(progress => 
        progress.opportunity.priority === 'Critical' || 
        progress.opportunity.priority === 'High' || 
        progress.riskFactors.length > 0
      );

      if (importantOpportunities.length > 0) {
        emailContent += `📋 DETAILED NOTES FOR ${accountName.toUpperCase()}:\n`;
        emailContent += `${'-'.repeat(50)}\n`;

        importantOpportunities.forEach((progress) => {
          emailContent += `\n• ${progress.opportunity.title}\n`;
          
          if (progress.opportunity.priority === 'Critical' || progress.opportunity.priority === 'High') {
            emailContent += `  🔴 ${progress.opportunity.priority} Priority\n`;
          }

          // Contacts
          const opportunityContacts = contacts.filter(c => progress.opportunity.contactIds.includes(c.id || ''));
          if (opportunityContacts.length > 0) {
            emailContent += `  👥 Contacts: ${opportunityContacts.map(c => c.name).join(', ')}\n`;
          }

          // Products
          if (progress.opportunity.iolProducts && progress.opportunity.iolProducts.length > 0) {
            emailContent += `  📦 Products: ${progress.opportunity.iolProducts.join(', ')}\n`;
          }

          // AI Summary
          if (progress.opportunity.aiSummary) {
            emailContent += `  ✨ Executive Summary: ${progress.opportunity.aiSummary}\n`;
          }

          // Risk factors
          if (progress.riskFactors.length > 0) {
            emailContent += `  ⚠️ Attention Required: ${progress.riskFactors.join(' • ')}\n`;
          }

          // Weekly changes
          if (progress.weeklyChanges.length > 0) {
            emailContent += `  📈 This Week: ${progress.weeklyChanges.join(' • ')}\n`;
          }
        });

        emailContent += `\n`;
      }

      emailContent += `\n`;
    });

    try {
      await navigator.clipboard.writeText(emailContent);
      alert('Opportunity cards copied to clipboard! The content is now formatted as tables for easy pasting.');
    } catch (err) {
      console.error('Failed to copy opportunity cards to clipboard:', err);
      alert('Failed to copy opportunity cards to clipboard. Please try again.');
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Active Opportunities</p>
                    <p className="text-2xl font-bold text-blue-900">{summary?.activeOpportunities || 0}</p>
                  </div>
                  <Target className="h-8 w-8 text-blue-500" />
                </div>
              </div>

              <div className="bg-emerald-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-600">Closed Won</p>
                    <p className="text-2xl font-bold text-emerald-900">{summary?.closedWonOpportunities || 0}</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                </div>
              </div>

              <div className="bg-red-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-600">Closed Lost</p>
                    <p className="text-2xl font-bold text-red-900">{summary?.closedLostOpportunities || 0}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500" />
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
            {((summary?.overdueActivities || 0) > 0 || (summary?.totalBlockers || 0) > 0) && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <div className="text-sm font-medium text-red-800">
                    <div className="flex items-center gap-4">
                      {(summary?.overdueActivities || 0) > 0 && (
                        <span>⚠️ {summary?.overdueActivities} overdue activities</span>
                      )}
                      {(summary?.totalBlockers || 0) > 0 && (
                        <span>🚫 {summary?.totalBlockers} active blockers</span>
                      )}
                    </div>
                    <p className="text-xs text-red-600 mt-1">
                      These issues require immediate attention
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>



          {/* Opportunity Progress */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Opportunity Progress & Status</h3>
            <div className="space-y-8">
              {(() => {
                // Group opportunities by account
                const groupedByAccount = opportunityProgress.slice(0, 15).reduce((groups, progress) => {
                  const accountName = progress.account?.name || 'Unknown Account';
                  if (!groups[accountName]) {
                    groups[accountName] = [];
                  }
                  groups[accountName].push(progress);
                  return groups;
                }, {} as Record<string, typeof opportunityProgress>);

                // Sort account names and render groups
                return Object.keys(groupedByAccount)
                  .sort()
                  .map((accountName) => (
                    <div key={accountName} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      {/* Account Header */}
                      <div 
                        className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-300 cursor-pointer hover:bg-gray-100 -m-4 p-4 rounded-t-lg transition-colors"
                        onClick={() => toggleGroup(accountName)}
                      >
                        {expandedGroups[accountName] ? (
                          <ChevronDown className="h-5 w-5 text-gray-600" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-600" />
                        )}
                        <Building2 className="h-5 w-5 text-gray-600" />
                        <h4 className="text-lg font-semibold text-gray-900">{accountName}</h4>
                        <span className="text-sm text-gray-500">
                          ({groupedByAccount[accountName].length} opportunit{groupedByAccount[accountName].length !== 1 ? 'ies' : 'y'})
                        </span>
                      </div>
                      
                      {/* Opportunities for this account */}
                      {expandedGroups[accountName] && (
                        <div className="space-y-3">
                          {groupedByAccount[accountName].map((progress) => {
                return (
                <div key={progress.opportunity.id} className="bg-white border border-gray-100 rounded-lg p-6 hover:shadow-md transition-all duration-200">
                  {/* Header Section */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Link
                          to={`/opportunities/${progress.opportunity.id}`}
                          className="text-xl font-semibold text-gray-900 hover:text-red-600 transition-colors"
                        >
                          {progress.opportunity.title}
                        </Link>
                        {progress.opportunity.priority === 'Critical' && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-red-600 text-white">
                            Critical
                          </span>
                        )}
                        {progress.opportunity.priority === 'High' && (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-red-100 text-red-700">
                            High Priority
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                        <div className="flex items-center gap-1">
                          <Building2 className="h-4 w-4" />
                          <span className="font-medium">{progress.account?.name || 'Unknown Account'}</span>
                          {progress.opportunity.iolProducts && progress.opportunity.iolProducts.length > 0 && (
                            <span className="text-gray-500">
                              • {progress.opportunity.iolProducts.slice(0, 2).join(', ')}
                              {progress.opportunity.iolProducts.length > 2 && ` +${progress.opportunity.iolProducts.length - 2} more`}
                            </span>
                          )}
                        </div>
                        {(() => {
                          const opportunityContacts = contacts.filter(c => progress.opportunity.contactIds.includes(c.id || ''));
                          return opportunityContacts.length > 0 && (
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              <span className="text-gray-500">
                                {opportunityContacts.map(c => c.name).join(', ')}
                              </span>
                            </div>
                          );
                        })()}
                        <div className="flex items-center gap-1">
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                            {progress.opportunity.stage}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900 mb-1">
                        ${(progress.opportunity.estimatedDealValue || 0).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500 mb-2">Opportunity Value</div>
                      {progress.opportunity.expectedCloseDate && (
                        <div className="text-sm text-gray-500">
                          Expected: {format(safeDateConversion(progress.opportunity.expectedCloseDate), 'MMM yyyy')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Executive Summary */}
                  {progress.opportunity.aiSummary && (
                    <div className="mb-4 p-4 bg-gray-50 rounded-lg border-l-4 border-red-600">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-gray-900">Executive Summary</span>
                        {progress.opportunity.aiSummaryGeneratedAt && (
                          <span className="text-xs text-gray-500">
                            Updated {format(safeDateConversion(progress.opportunity.aiSummaryGeneratedAt), 'MMM d')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 leading-relaxed">
                        {progress.opportunity.aiSummary}
                      </p>
                    </div>
                  )}

                  {/* Key Information - Vertical Layout */}
                  <div className="space-y-4 mb-4">
                    {/* Last Activity */}
                    {progress.lastActivity && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                          <CheckCircle className="h-3 w-3" />
                          <span>Last Activity</span>
                          <span className="text-gray-400">•</span>
                          <span className="normal-case">
                            {format(safeDateConversion(progress.lastActivity.dateTime), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <div className="text-sm text-gray-900 font-medium">{progress.lastActivity.subject}</div>
                        {progress.lastActivity.notes && (
                          <div className="text-sm text-gray-600 mt-1">
                            {progress.lastActivity.notes}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Next Activity */}
                    {progress.nextActivity && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                          <Clock className="h-3 w-3" />
                          <span>Next Activity</span>
                          <span className="text-gray-400">•</span>
                          <span className="normal-case">
                            {format(safeDateConversion(progress.nextActivity.dateTime), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <div className="text-sm text-gray-900 font-medium">{progress.nextActivity.subject}</div>
                        {progress.nextActivity.notes && (
                          <div className="text-sm text-gray-600 mt-1">
                            {progress.nextActivity.notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Weekly Updates and Risks - Simplified */}
                  {(progress.weeklyChanges.length > 0 || progress.riskFactors.length > 0) && (
                    <div className="border-t border-gray-100 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* This Week Updates */}
                        {progress.weeklyChanges.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="text-sm font-medium text-gray-900">This Week</span>
                            </div>
                            <div className="text-sm text-gray-600">
                              {progress.weeklyChanges.join(' • ')}
                            </div>
                          </div>
                        )}
                        
                        {/* Risk Factors */}
                        {progress.riskFactors.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                              <span className="text-sm font-medium text-gray-900">Attention Required</span>
                            </div>
                            <div className="text-sm text-red-600">
                              {progress.riskFactors.join(' • ')}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* No Activity Warning */}
                  {!progress.lastActivity && !progress.nextActivity && (
                    <div className="border-t border-gray-100 pt-4">
                      <div className="flex items-center gap-2 text-amber-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">No recent or scheduled activities</span>
                      </div>
                    </div>
                  )}
                </div>
                        );
                        })}
                        </div>
                      )}
                    </div>
                  ));
              })()}
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