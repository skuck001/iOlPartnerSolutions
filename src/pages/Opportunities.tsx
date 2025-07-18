import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Edit3, 
  Calendar, 
  Users, 
  Activity, 
  TrendingUp,
  Building2,
  MapPin,
  ArrowUpDown,
  AlertTriangle,
  Clock,
  CheckCircle,
  DollarSign,
  Package,
  Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Opportunity, OpportunityStage, OpportunityPriority, Account, Contact, Product } from '../types';
import { useDataContext } from '../context/DataContext';
import { format, formatDistanceToNow, isAfter, isBefore, startOfDay } from 'date-fns';

type SortField = 'title' | 'stage' | 'priority' | 'estimatedDealValue' | 'expectedCloseDate' | 'lastActivityDate' | 'createdAt' | 'accountName';
type SortDirection = 'asc' | 'desc';

// Helper function to convert various date formats to Date object
const toDate = (dateValue: any): Date => {
  if (!dateValue) return new Date();
  
  // Debug logging to identify timestamp format
  console.log('toDate called with:', typeof dateValue, dateValue);
  
  // If it's already a Date object
  if (dateValue instanceof Date) {
    // Check if it's a valid date
    return isNaN(dateValue.getTime()) ? new Date() : dateValue;
  }
  
  // If it has a toDate method (Firebase Timestamp)
  if (dateValue && typeof dateValue.toDate === 'function') {
    const date = dateValue.toDate();
    return isNaN(date.getTime()) ? new Date() : date;
  }
  
  // Handle Cloud Functions timestamp format {_seconds: number, _nanoseconds: number}
  if (dateValue && typeof dateValue._seconds === 'number') {
    console.log('Converting Cloud Functions timestamp:', dateValue);
    return new Date(dateValue._seconds * 1000);
  }
  
  // Handle legacy format {seconds: number, nanoseconds: number}
  if (dateValue && typeof dateValue.seconds === 'number') {
    console.log('Converting legacy timestamp:', dateValue);
    return new Date(dateValue.seconds * 1000);
  }
  
  // If it's a string or number, parse it
  const parsedDate = new Date(dateValue);
  return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
};

// Helper function to get milliseconds from various date formats
const toMillis = (dateValue: any): number => {
  if (!dateValue) return 0;
  
  // If it has a toMillis method (Firebase Timestamp)
  if (dateValue && typeof dateValue.toMillis === 'function') {
    return dateValue.toMillis();
  }
  
  // If it's already a Date object
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? 0 : dateValue.getTime();
  }
  
  // If it has a toDate method (Firebase Timestamp)
  if (dateValue && typeof dateValue.toDate === 'function') {
    const date = dateValue.toDate();
    return isNaN(date.getTime()) ? 0 : date.getTime();
  }
  
  // Handle Cloud Functions timestamp format {_seconds: number, _nanoseconds: number}
  if (dateValue && typeof dateValue._seconds === 'number') {
    return dateValue._seconds * 1000;
  }
  
  // Handle legacy format {seconds: number, nanoseconds: number}
  if (dateValue && typeof dateValue.seconds === 'number') {
    return dateValue.seconds * 1000;
  }
  
  // If it's a string or number, parse it
  const parsedDate = new Date(dateValue);
  return isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
};

export const Opportunities: React.FC = () => {
  const navigate = useNavigate();
  const {
    cache,
    loading,
    getAccounts,
    getContacts,
    getProducts,
    getOpportunities
  } = useDataContext();
  
  const opportunities = cache?.opportunities || [];
  const accounts = cache?.accounts || [];
  const contacts = cache?.contacts || [];
  const products = cache?.products || [];
  const [pageLoading, setPageLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('accountName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [stageFilter, setStageFilter] = useState<OpportunityStage | 'All'>('All');
  const [priorityFilter, setPriorityFilter] = useState<OpportunityPriority | 'All'>('All');
  const [excludeClosed, setExcludeClosed] = useState(true); // New state for exclude closed checkbox

  useEffect(() => {
    fetchAllData();
  }, []);

  // Update loading state when all data is loaded
  useEffect(() => {
    if (!loading?.opportunities && !loading?.accounts && !loading?.contacts && !loading?.products) {
      setPageLoading(false);
    }
  }, [loading]);

  const fetchAllData = async () => {
    try {
      // Fetch all data via DataContext (optimized with caching)
      await Promise.all([
        getOpportunities(),
        getAccounts(),
        getContacts(),
        getProducts()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      setPageLoading(false);
    }
  };



  const getAccountName = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.name || 'Unknown';
  };

  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product?.name || null;
  };

  const getContactsForOpportunity = (opportunity: Opportunity) => {
    return contacts.filter(c => opportunity.contactIds.includes(c.id || ''));
  };

  const getNextScheduledActivity = (opportunity: Opportunity) => {
    const scheduledActivities = (opportunity.activities || [])
      .filter(a => a.status === 'Scheduled')
      .sort((a, b) => toMillis(a.dateTime) - toMillis(b.dateTime));
    return scheduledActivities[0] || null;
  };

  const getLastCompletedActivity = (opportunity: Opportunity) => {
    const completedActivities = (opportunity.activities || [])
      .filter(a => a.status === 'Completed')
      .sort((a, b) => toMillis(b.dateTime) - toMillis(a.dateTime));
    return completedActivities[0] || null;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'accountName' ? 'asc' : 'desc');
    }
  };

  const handleRowClick = (opportunity: Opportunity) => {
    navigate(`/opportunities/${opportunity.id}`);
  };

  const handleAdd = () => {
    navigate('/opportunities/new');
  };

  const getStageColor = (stage: OpportunityStage) => {
    const colors = {
      'Lead': 'bg-gray-100 text-gray-800 border-gray-200',
      'Qualified': 'bg-blue-100 text-blue-800 border-blue-200',
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

  const getStageProgress = (stage: OpportunityStage) => {
    const progress = {
      'Lead': 10,
      'Qualified': 25,
      'Proposal': 40,
      'Negotiation': 70,
      'Closed-Won': 100,
      'Closed-Lost': 0
    };
    return progress[stage];
  };

  const getActivitySummary = (opportunity: Opportunity) => {
    const activities = opportunity.activities || [];
    const scheduled = activities.filter(a => a.status === 'Scheduled').length;
    const completed = activities.filter(a => a.status === 'Completed').length;
    return { scheduled, completed, total: activities.length };
  };

  const isOpportunityOverdue = (opportunity: Opportunity) => {
    if (!opportunity.expectedCloseDate) return false;
    return isBefore(toDate(opportunity.expectedCloseDate), startOfDay(new Date()));
  };

  const filteredAndSortedOpportunities = (opportunities || [])
    .filter(opp => {
      const matchesSearch = (
        opp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opp.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        getAccountName(opp.accountId).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (opp.iolProducts || []).some(product => 
          product.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
      
      const matchesStage = stageFilter === 'All' || opp.stage === stageFilter;
      const matchesPriority = priorityFilter === 'All' || opp.priority === priorityFilter;
      
      // Add exclude closed filter
      const matchesClosedFilter = !excludeClosed || (opp.stage !== 'Closed-Won' && opp.stage !== 'Closed-Lost');
      
      return matchesSearch && matchesStage && matchesPriority && matchesClosedFilter;
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'stage':
          aValue = a.stage;
          bValue = b.stage;
          break;
        case 'priority':
          const priorityOrder = { 'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1 };
          aValue = priorityOrder[a.priority];
          bValue = priorityOrder[b.priority];
          break;
        case 'estimatedDealValue':
          aValue = a.estimatedDealValue || 0;
          bValue = b.estimatedDealValue || 0;
          break;
        case 'expectedCloseDate':
          aValue = toMillis(a.expectedCloseDate) || 0;
          bValue = toMillis(b.expectedCloseDate) || 0;
          break;
        case 'lastActivityDate':
          aValue = toMillis(a.lastActivityDate) || 0;
          bValue = toMillis(b.lastActivityDate) || 0;
          break;
        case 'createdAt':
          aValue = toMillis(a.createdAt);
          bValue = toMillis(b.createdAt);
          break;
        case 'accountName':
          aValue = getAccountName(a.accountId).toLowerCase();
          bValue = getAccountName(b.accountId).toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  // Group opportunities by account
  const groupedOpportunities = filteredAndSortedOpportunities.reduce((groups, opportunity) => {
    const accountName = getAccountName(opportunity.accountId);
    if (!groups[accountName]) {
      groups[accountName] = [];
    }
    groups[accountName].push(opportunity);
    return groups;
  }, {} as Record<string, Opportunity[]>);

  const getSortIcon = (field: SortField) => {
    if (sortField === field) {
      return (
        <ArrowUpDown 
          className={`h-3 w-3 ml-1 inline ${
            sortDirection === 'desc' ? 'transform rotate-180' : ''
          }`} 
        />
      );
    }
    return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-0 group-hover:opacity-50" />;
  };

  const STAGES: OpportunityStage[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed-Won', 'Closed-Lost'];
  const PRIORITIES: OpportunityPriority[] = ['Critical', 'High', 'Medium', 'Low'];

  const handleExportToExcel = () => {
    try {
      if (filteredAndSortedOpportunities.length === 0) {
        alert('No opportunities to export');
        return;
      }

      // Prepare data for export
      const exportData = filteredAndSortedOpportunities.map((opportunity) => {
      const account = accounts.find(a => a.id === opportunity.accountId);
      const product = opportunity.productId ? products.find(p => p.id === opportunity.productId) : null;
      const opportunityContacts = getContactsForOpportunity(opportunity);
      const activitySummary = getActivitySummary(opportunity);
      const nextScheduled = getNextScheduledActivity(opportunity);
      const lastCompleted = getLastCompletedActivity(opportunity);
      const isOverdue = isOpportunityOverdue(opportunity);

      return {
        'Opportunity Title': opportunity.title,
        'Account Name': account?.name || 'Unknown Account',
        
        'Product Name': product?.name || '',
        'Stage': opportunity.stage,
        'Priority': opportunity.priority,
        'Region': account?.region || '',
        'Deal Value': opportunity.estimatedDealValue || 0,
        'Expected Close Date': opportunity.expectedCloseDate 
          ? format(toDate(opportunity.expectedCloseDate), 'yyyy-MM-dd') 
          : '',
        'Is Overdue': isOverdue ? 'Yes' : 'No',
        'Commercial Model': opportunity.commercialModel || '',
        'Potential Volume': opportunity.potentialVolume || 0,
        'Summary': opportunity.summary || '',
        'Notes': opportunity.notes || '',
        'iOL Products': (opportunity.iolProducts || []).join(', '),
        'Total Activities': activitySummary.total,
        'Scheduled Activities': activitySummary.scheduled,
        'Completed Activities': activitySummary.completed,
        'Next Activity Date': nextScheduled 
          ? format(toDate(nextScheduled.dateTime), 'yyyy-MM-dd HH:mm') 
          : '',
        'Next Activity Subject': nextScheduled?.subject || '',
        'Next Activity Type': nextScheduled?.activityType || '',
        'Last Activity Date': lastCompleted 
          ? format(toDate(lastCompleted.dateTime), 'yyyy-MM-dd HH:mm') 
          : '',
        'Last Activity Subject': lastCompleted?.subject || '',
        'Last Activity Type': lastCompleted?.activityType || '',
        'Contact Count': opportunityContacts.length,
        'Primary Contact': opportunityContacts[0]?.name || '',
        'Primary Contact Email': opportunityContacts[0]?.email || '',
        'Primary Contact Position': opportunityContacts[0]?.position || '',
        'All Contacts': opportunityContacts.map(c => c.name).join(', '),
        'Tags': opportunity.tags.join(', '),
        'Created Date': format(toDate(opportunity.createdAt), 'yyyy-MM-dd'),
        'Last Updated': opportunity.updatedAt 
          ? format(toDate(opportunity.updatedAt), 'yyyy-MM-dd') 
          : ''
      };
    });

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-size columns
          const columnWidths: Array<{wch: number}> = [];
    const headers = Object.keys(exportData[0] || {});
    
    headers.forEach((header, index) => {
      const maxLength = Math.max(
        header.length,
        ...exportData.map(row => String(row[header as keyof typeof row] || '').length)
      );
      columnWidths[index] = { wch: Math.min(maxLength + 2, 50) }; // Cap at 50 characters
    });
    
    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Opportunities');

    // Generate filename with current date
    const filename = `opportunities_export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

    // Save file
    XLSX.writeFile(workbook, filename);
    
    // Show success message
    console.log(`Exported ${exportData.length} opportunities to ${filename}`);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert('Failed to export data to Excel. Please try again.');
  }
};

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Opportunities</h1>
            <p className="text-sm text-gray-600 mt-1">
              {filteredAndSortedOpportunities.length} of {opportunities?.length || 0} opportunities
            </p>
          </div>
        </div>
        
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search opportunities, accounts, or products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Exclude Closed Checkbox */}
            <label className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 rounded-lg bg-white shadow-sm hover:bg-gray-50 transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={excludeClosed}
                onChange={(e) => setExcludeClosed(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
              />
              <span className="text-sm text-gray-700 whitespace-nowrap">Exclude Closed</span>
            </label>
            
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as OpportunityStage | 'All')}
              className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white shadow-sm"
            >
              <option value="All">All Stages</option>
              {STAGES.map(stage => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
            
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as OpportunityPriority | 'All')}
              className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white shadow-sm"
            >
              <option value="All">All Priorities</option>
              {PRIORITIES.map(priority => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {pageLoading || loading?.opportunities ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredAndSortedOpportunities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <TrendingUp className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No opportunities found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchTerm || stageFilter !== 'All' || priorityFilter !== 'All' 
                ? 'Try adjusting your search or filters' 
                : 'Get started by creating your first opportunity'}
            </p>
            {!searchTerm && stageFilter === 'All' && priorityFilter === 'All' && (
              <button
                onClick={handleAdd}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Opportunity
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg mx-6 mb-6 overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('accountName')}
                    >
                      <div className="flex items-center">
                        Account & Product
                        {getSortIcon('accountName')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('title')}
                    >
                      <div className="flex items-center">
                        Opportunity
                        {getSortIcon('title')}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      iOL Products
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('stage')}
                    >
                      <div className="flex items-center">
                        Stage & Progress
                        {getSortIcon('stage')}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Next Activity
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Activity
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('priority')}
                    >
                      <div className="flex items-center">
                        Priority
                        {getSortIcon('priority')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('estimatedDealValue')}
                    >
                      <div className="flex items-center">
                        Deal Value
                        {getSortIcon('estimatedDealValue')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('expectedCloseDate')}
                    >
                      <div className="flex items-center">
                        Expected Close
                        {getSortIcon('expectedCloseDate')}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contacts
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {Object.entries(groupedOpportunities).map(([accountName, accountOpportunities]) => (
                    <React.Fragment key={accountName}>
                      {/* Account Group Header */}
                      <tr className="bg-gray-100">
                        <td colSpan={11} className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-gray-600" />
                            <span className="text-sm font-semibold text-gray-900">{accountName}</span>
                            <span className="text-xs text-gray-500">({accountOpportunities.length} opportunities)</span>
                          </div>
                        </td>
                      </tr>
                      {/* Account Opportunities */}
                      {accountOpportunities.map((opportunity) => {
                        const account = accounts.find(a => a.id === opportunity.accountId);
                        const product = opportunity.productId ? products.find(p => p.id === opportunity.productId) : null;
                        const opportunityContacts = getContactsForOpportunity(opportunity);
                        const isOverdue = isOpportunityOverdue(opportunity);
                        const progress = getStageProgress(opportunity.stage);
                        
                        // Calculate activity data specific to THIS opportunity
                        const nextScheduledActivity = getNextScheduledActivity(opportunity);
                        const lastCompletedActivity = getLastCompletedActivity(opportunity);
                        
                        return (
                          <tr
                            key={opportunity.id}
                            onClick={() => handleRowClick(opportunity)}
                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            {/* Account & Product */}
                            <td className="px-6 py-4">
                              <div className="flex items-start">
                                <Building2 className="h-4 w-4 text-gray-400 mr-2 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-gray-900 truncate">
                                    {account?.name || 'Unknown Account'}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate">
                                    {account?.region}
                                  </div>
                                  {opportunity.productId && getProductName(opportunity.productId) && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Package className="h-3 w-3 text-blue-500" />
                                      <span className="text-xs text-blue-700 font-medium truncate">
                                        {getProductName(opportunity.productId)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Opportunity Title */}
                            <td className="px-6 py-4">
                              <div className="max-w-48">
                                <div className="text-sm font-medium text-gray-900 leading-tight line-clamp-2">
                                  {opportunity.title}
                                </div>
                                <div className="flex items-center gap-1 mt-2">
                                  <MapPin className="h-3 w-3 text-gray-400" />
                                  <span className="text-xs text-gray-500">{account?.region || 'Unknown'}</span>
                                </div>
                              </div>
                            </td>

                            {/* iOL Products */}
                            <td className="px-6 py-4">
                              <div className="flex items-start">
                                <Package className="h-4 w-4 text-gray-400 mr-2 mt-0.5" />
                                <div className="max-w-32">
                                  {opportunity.iolProducts && opportunity.iolProducts.length > 0 ? (
                                    <div className="space-y-1">
                                      {opportunity.iolProducts.slice(0, 2).map((product, index) => (
                                        <div key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full truncate">
                                          {product.replace('iOL ', '')}
                                        </div>
                                      ))}
                                      {opportunity.iolProducts.length > 2 && (
                                        <div className="text-xs text-gray-500">
                                          +{opportunity.iolProducts.length - 2} more
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-500">Not specified</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Stage & Progress */}
                            <td className="px-6 py-4">
                              <div className="space-y-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStageColor(opportunity.stage)}`}>
                                  {opportunity.stage}
                                </span>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div 
                                    className={`h-1.5 rounded-full transition-all duration-300 ${
                                      opportunity.stage === 'Closed-Won' ? 'bg-green-500' : 
                                      opportunity.stage === 'Closed-Lost' ? 'bg-red-500' : 
                                      'bg-blue-500'
                                    }`}
                                    style={{ width: `${progress}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>

                            {/* Next Activity */}
                            <td className="px-6 py-4">
                              <div>
                                {nextScheduledActivity ? (
                                  (() => {
                                    const isToday = format(toDate(nextScheduledActivity.dateTime), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                                    const isActivityOverdue = isBefore(toDate(nextScheduledActivity.dateTime), new Date());
                                    
                                    return (
                                      <div className="flex items-center gap-2">
                                        <Clock className={`h-4 w-4 ${isActivityOverdue ? 'text-red-500' : isToday ? 'text-orange-500' : 'text-blue-500'}`} />
                                        <div>
                                          <div className={`text-sm font-medium ${isActivityOverdue ? 'text-red-600' : isToday ? 'text-orange-600' : 'text-gray-900'}`}>
                                            {format(toDate(nextScheduledActivity.dateTime), 'MMM d, h:mm a')}
                                          </div>
                                          <div className="text-xs text-gray-500 truncate max-w-32">
                                            {nextScheduledActivity.subject}
                                          </div>
                                          {isActivityOverdue && (
                                            <div className="text-xs text-red-600 font-medium">Overdue</div>
                                          )}
                                          {isToday && !isActivityOverdue && (
                                            <div className="text-xs text-orange-600 font-medium">Today</div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <span className="text-sm text-gray-500">None scheduled</span>
                                )}
                              </div>
                            </td>

                            {/* Last Activity */}
                            <td className="px-6 py-4">
                              <div>
                                {lastCompletedActivity ? (
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <div>
                                      <div className="text-sm text-gray-900">
                                        {formatDistanceToNow(toDate(lastCompletedActivity.dateTime), { addSuffix: true })}
                                      </div>
                                      <div className="text-xs text-gray-500 truncate max-w-32">
                                        {lastCompletedActivity.subject}
                                      </div>
                                      <div className="text-xs text-gray-400">
                                        {format(toDate(lastCompletedActivity.dateTime), 'MMM d')}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-500">No activity</span>
                                )}
                              </div>
                            </td>

                            {/* Priority */}
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(opportunity.priority)}`}>
                                {opportunity.priority}
                              </span>
                            </td>

                            {/* Deal Value */}
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <DollarSign className="h-4 w-4 text-green-500 mr-1" />
                                <span className="text-sm font-medium text-gray-900">
                                  {opportunity.estimatedDealValue 
                                    ? `$${opportunity.estimatedDealValue.toLocaleString()}` 
                                    : 'TBD'
                                  }
                                </span>
                              </div>
                            </td>

                            {/* Expected Close Date */}
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                {opportunity.expectedCloseDate ? (
                                  <>
                                    <Calendar className={`h-4 w-4 mr-2 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`} />
                                    <div>
                                      <div className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                                        {format(toDate(opportunity.expectedCloseDate), 'MMM d, yyyy')}
                                      </div>
                                      {isOverdue && (
                                        <div className="flex items-center gap-1 text-xs text-red-600">
                                          <AlertTriangle className="h-3 w-3" />
                                          Overdue
                                        </div>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-sm text-gray-500">Not set</span>
                                )}
                              </div>
                            </td>

                            {/* Contacts */}
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <Users className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm text-gray-900">
                                  {opportunityContacts.length}
                                </span>
                                {opportunityContacts.length > 0 && (
                                  <div className="ml-2 text-xs text-gray-500 truncate max-w-24">
                                    {opportunityContacts[0].name}
                                    {opportunityContacts.length > 1 && ` +${opportunityContacts.length - 1}`}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/opportunities/${opportunity.id}`);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/opportunities/${opportunity.id}`);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                                  title="Edit Opportunity"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        {/* Export Button */}
        <button
          onClick={handleExportToExcel}
          className="group relative inline-flex items-center justify-center w-14 h-14 bg-green-600 text-white rounded-full hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-500 focus:ring-opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl"
          title={`Export ${filteredAndSortedOpportunities.length} opportunities to Excel`}
        >
          <Download className="h-6 w-6" />
          <span className="absolute right-16 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            Export Excel ({filteredAndSortedOpportunities.length})
          </span>
        </button>

        {/* New Opportunity Button */}
        <button
          onClick={handleAdd}
          className="group relative inline-flex items-center justify-center w-14 h-14 bg-primary-600 text-white rounded-full hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-500 focus:ring-opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl"
          title="Create New Opportunity"
        >
          <Plus className="h-6 w-6" />
          <span className="absolute right-16 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            New Opportunity
          </span>
        </button>
      </div>

      {/* Mobile Floating Action Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3 z-40">
        <button
          onClick={handleExportToExcel}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors shadow-sm"
          title={`Export ${filteredAndSortedOpportunities.length} opportunities to Excel`}
        >
          <Download className="h-5 w-5" />
          <span>Export ({filteredAndSortedOpportunities.length})</span>
        </button>
        <button
          onClick={handleAdd}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50 transition-colors shadow-sm"
        >
          <Plus className="h-5 w-5" />
          <span>New</span>
        </button>
      </div>
    </div>
  );
}; 