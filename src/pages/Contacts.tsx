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
  Phone,
  Mail,
  Building2,
  MapPin,
  ArrowUpDown,
  AlertTriangle,
  Clock,
  CheckCircle,
  User,
  Package,
  Download,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Contact, ContactType, Account, Product, Opportunity, Activity as ActivityType } from '../types';
import { useDataContext } from '../context/DataContext';
import { format, formatDistanceToNow, isAfter, isBefore, startOfDay } from 'date-fns';

type SortField = 'name' | 'email' | 'position' | 'contactType' | 'lastContactDate' | 'createdAt';
type SortDirection = 'asc' | 'desc';

// Helper function to convert various date formats to Date object
const toDate = (dateValue: any): Date => {
  if (!dateValue) return new Date();
  
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
  
  // If it's a string or number, parse it
  const parsedDate = new Date(dateValue);
  return isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
};

export const Contacts: React.FC = () => {
  const navigate = useNavigate();
  const {
    cache,
    loading,
    getAccounts,
    getContacts,
    getProducts,
    getOpportunities
  } = useDataContext();
  
  const contacts = cache?.contacts || [];
  const accounts = cache?.accounts || [];
  const products = cache?.products || [];
  const opportunities = cache?.opportunities || [];
  const [pageLoading, setPageLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [contactTypeFilter, setContactTypeFilter] = useState<ContactType | 'All'>('All');
  const [accountFilter, setAccountFilter] = useState<string>('All');

  useEffect(() => {
    fetchAllData();
  }, []);

  // Update loading state when all data is loaded
  useEffect(() => {
    if (!loading?.contacts && !loading?.accounts && !loading?.products && !loading?.opportunities) {
      setPageLoading(false);
    }
  }, [loading]);

  const fetchAllData = async () => {
    try {
      // Fetch all data via DataContext (optimized with caching)
      await Promise.all([
        getContacts(),
        getAccounts(),
        getProducts(),
        getOpportunities()
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

  const getAccount = (accountId: string) => {
    return accounts.find(a => a.id === accountId);
  };

  const getProductsForContact = (contact: Contact) => {
    return products.filter(p => contact.productIds?.includes(p.id) || false);
  };

  const getOpportunitiesForContact = (contact: Contact) => {
    return opportunities.filter(opp => opp.contactIds?.includes(contact.id || '') || false);
  };

  const getActiveOpportunitiesCount = (contact: Contact) => {
    const contactOpportunities = getOpportunitiesForContact(contact);
    return contactOpportunities.filter(opp => 
      opp.stage !== 'Closed-Won' && opp.stage !== 'Closed-Lost'
    ).length;
  };

  const getMostRecentActivity = (contact: Contact): ActivityType | null => {
    let mostRecentActivity: ActivityType | null = null;
    let mostRecentDate: Date | null = null;
    
    opportunities.forEach(opportunity => {
      if (opportunity.activities) {
        opportunity.activities.forEach(activity => {
          // Check if this contact is involved in the activity
          if (activity.relatedContactIds.includes(contact.id || '')) {
            let activityDate: Date | null = null;
            
            // For completed activities, use completedAt if available, otherwise use dateTime
            if (activity.status === 'Completed') {
              activityDate = activity.completedAt ? toDate(activity.completedAt) : toDate(activity.dateTime);
            } else if (activity.status === 'Scheduled') {
              // For scheduled activities, only consider them if they're in the past
              const scheduledDate = toDate(activity.dateTime);
              if (scheduledDate < new Date()) {
                activityDate = scheduledDate;
              }
            }
            
            // Only update if we have a valid date and it's more recent than current most recent
            if (activityDate && (!mostRecentDate || activityDate > mostRecentDate)) {
              mostRecentDate = activityDate;
              mostRecentActivity = {
                ...activity,
                opportunityTitle: opportunity.title,
                opportunityId: opportunity.id
              } as any;
            }
          }
        });
      }
    });
    
    return mostRecentActivity;
  };

  const getActivityIcon = (activityType: string) => {
    const iconMap = {
      'Meeting': Calendar,
      'Email': Mail,
      'Call': Phone,
      'WhatsApp': MessageSquare,
      'Demo': Calendar,
      'Workshop': Users
    };
    return iconMap[activityType as keyof typeof iconMap] || Activity;
  };

  const isContactOverdue = (contact: Contact) => {
    if (!contact.lastContactDate) return false;
    const daysSinceLastContact = Math.floor(
      (new Date().getTime() - toDate(contact.lastContactDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceLastContact > 30; // Consider overdue if no contact in 30 days
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRowClick = (contact: Contact) => {
    navigate(`/contacts/${contact.id}`);
  };

  const handleAdd = () => {
    navigate('/contacts/new');
  };

  const getContactTypeColor = (contactType: ContactType) => {
    const colors = {
      'Primary': 'bg-blue-100 text-blue-800 border-blue-200',
      'Secondary': 'bg-gray-100 text-gray-800 border-gray-200',
      'Technical': 'bg-purple-100 text-purple-800 border-purple-200',
      'Billing': 'bg-green-100 text-green-800 border-green-200',
      'Decision Maker': 'bg-red-100 text-red-800 border-red-200',
      'Other': 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };
    return colors[contactType];
  };

  const filteredAndSortedContacts = (contacts || [])
    .filter(contact => {
      const account = getAccount(contact.accountId);
      const matchesSearch = (
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (contact.position && contact.position.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (account?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (contact.department && contact.department.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      
      const matchesContactType = contactTypeFilter === 'All' || contact.contactType === contactTypeFilter;
      const matchesAccount = accountFilter === 'All' || contact.accountId === accountFilter;
      
      return matchesSearch && matchesContactType && matchesAccount;
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'email':
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case 'position':
          aValue = (a.position || '').toLowerCase();
          bValue = (b.position || '').toLowerCase();
          break;
        case 'contactType':
          aValue = a.contactType;
          bValue = b.contactType;
          break;
        case 'lastContactDate':
          aValue = toMillis(a.lastContactDate) || 0;
          bValue = toMillis(b.lastContactDate) || 0;
          break;
        case 'createdAt':
          aValue = toMillis(a.createdAt);
          bValue = toMillis(b.createdAt);
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

  const CONTACT_TYPES: ContactType[] = ['Primary', 'Secondary', 'Technical', 'Billing', 'Decision Maker', 'Other'];

  const uniqueAccounts = Array.from(new Set((contacts || []).map(c => c.accountId)))
    .map(accountId => accounts.find(a => a.id === accountId))
    .filter(Boolean) as Account[];

  // Group contacts by account in alphabetical order
  const groupedContacts = filteredAndSortedContacts.reduce((groups, contact) => {
    const account = getAccount(contact.accountId);
    const accountName = account?.name || 'Unknown Account';
    
    if (!groups[accountName]) {
      groups[accountName] = [];
    }
    groups[accountName].push(contact);
    return groups;
  }, {} as Record<string, typeof filteredAndSortedContacts>);

  // Sort account names alphabetically
  const sortedAccountNames = Object.keys(groupedContacts).sort();

  const handleExportToExcel = () => {
    try {
      if (filteredAndSortedContacts.length === 0) {
        alert('No contacts to export');
        return;
      }

      // Prepare data for export
      const exportData = filteredAndSortedContacts.map((contact) => {
        const account = getAccount(contact.accountId);
        const contactProducts = getProductsForContact(contact);
        const contactOpportunities = getOpportunitiesForContact(contact);
        const activeOpportunities = getActiveOpportunitiesCount(contact);
        const isOverdue = isContactOverdue(contact);

        return {
          'Name': contact.name,
          'Email': contact.email,
          'Phone': contact.phone || '',
          'Position': contact.position || '',
          'Department': contact.department || '',
          'Contact Type': contact.contactType,
          'Account Name': account?.name || 'Unknown Account',
          'Account Headoffice Country': account?.region || '',
          'Account Region': account?.region || '',
          'Is Decision Maker': contact.isDecisionMaker ? 'Yes' : 'No',
          'Preferred Contact Method': contact.preferredContactMethod || '',
          'LinkedIn': contact.linkedIn || '',
          'Timezone': contact.timezone || '',
                  'Last Contact Date': contact.lastContactDate 
          ? format(toDate(contact.lastContactDate), 'yyyy-MM-dd') 
          : '',
        'Days Since Last Contact': contact.lastContactDate 
          ? Math.floor((new Date().getTime() - toDate(contact.lastContactDate).getTime()) / (1000 * 60 * 60 * 24))
          : '',
          'Is Overdue': isOverdue ? 'Yes' : 'No',
          'Product Count': contactProducts.length,
          'Products': contactProducts.map(p => p.name).join(', '),
          'Active Opportunities': activeOpportunities,
          'Total Opportunities': contactOpportunities.length,
          'Opportunity Titles': contactOpportunities.map(opp => opp.title).join(', '),
          'Notes': contact.notes || '',
                  'Created Date': format(toDate(contact.createdAt), 'yyyy-MM-dd'),
        'Last Updated': contact.updatedAt 
          ? format(toDate(contact.updatedAt), 'yyyy-MM-dd') 
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');

      // Generate filename with current date
      const filename = `contacts_export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);
      
      // Show success message
      console.log(`Exported ${exportData.length} contacts to ${filename}`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export data to Excel. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
            <p className="text-sm text-gray-600 mt-1">
              {filteredAndSortedContacts.length} of {contacts?.length || 0} contacts across {sortedAccountNames.length} companies
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportToExcel}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors shadow-sm"
              title={`Export ${filteredAndSortedContacts.length} contacts to Excel`}
            >
              <Download className="h-4 w-4" />
              Export Excel
              <span className="ml-1 px-2 py-0.5 bg-green-500 text-green-100 text-xs rounded-full">
                {filteredAndSortedContacts.length}
              </span>
            </button>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New Contact
            </button>
          </div>
        </div>
        
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search contacts, accounts, or positions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm"
            />
          </div>
          
          <div className="flex gap-3">
            <select
              value={contactTypeFilter}
              onChange={(e) => setContactTypeFilter(e.target.value as ContactType | 'All')}
              className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white shadow-sm"
            >
              <option value="All">All Contact Types</option>
              {CONTACT_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white shadow-sm"
            >
              <option value="All">All Accounts</option>
              {uniqueAccounts.map(account => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {pageLoading || loading?.contacts ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredAndSortedContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Users className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchTerm || contactTypeFilter !== 'All' || accountFilter !== 'All' 
                ? 'Try adjusting your search or filters' 
                : 'Get started by creating your first contact'}
            </p>
            {!searchTerm && contactTypeFilter === 'All' && accountFilter === 'All' && (
              <button
                onClick={handleAdd}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Contact
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg mx-6 mb-6 overflow-hidden border border-gray-200 mt-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Contact
                        {getSortIcon('name')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('email')}
                    >
                      <div className="flex items-center">
                        Email & Phone
                        {getSortIcon('email')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('position')}
                    >
                      <div className="flex items-center">
                        Position & Department
                        {getSortIcon('position')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('contactType')}
                    >
                      <div className="flex items-center">
                        Contact Type
                        {getSortIcon('contactType')}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Account
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Products
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Opportunities
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('lastContactDate')}
                    >
                      <div className="flex items-center">
                        Last Contact
                        {getSortIcon('lastContactDate')}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact Methods
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedAccountNames.map(accountName => (
                    <React.Fragment key={accountName}>
                      {/* Company Group Header */}
                      <tr className="bg-gray-50">
                        <td colSpan={10} className="px-6 py-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <Building2 className="h-5 w-5 text-gray-600 mr-2" />
                              <h3 className="text-lg font-semibold text-gray-900">{accountName}</h3>
                              <span className="ml-2 text-sm text-gray-500">
                                ({groupedContacts[accountName].length} contact{groupedContacts[accountName].length !== 1 ? 's' : ''})
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                      {/* Company Contacts */}
                      {groupedContacts[accountName].map((contact) => {
                        const account = getAccount(contact.accountId);
                        const contactProducts = getProductsForContact(contact);
                        const contactOpportunities = getOpportunitiesForContact(contact);
                        const activeOpportunities = getActiveOpportunitiesCount(contact);
                        const isOverdue = isContactOverdue(contact);
                        
                        return (
                          <tr
                            key={contact.id}
                            onClick={() => handleRowClick(contact)}
                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            {/* Contact Name */}
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <User className="h-8 w-8 text-gray-400 bg-gray-100 rounded-full p-1.5 mr-3" />
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {contact.name}
                                  </div>
                                  {contact.isDecisionMaker && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <CheckCircle className="h-3 w-3 text-green-500" />
                                      <span className="text-xs text-green-700 font-medium">Decision Maker</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Email & Phone */}
                            <td className="px-6 py-4">
                              <div className="space-y-2">
                                <div className="flex items-center">
                                  <Mail className="h-4 w-4 text-gray-400 mr-2" />
                                  <a 
                                    href={`mailto:${contact.email}`}
                                    className="text-sm text-blue-600 hover:text-blue-800 truncate"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {contact.email}
                                  </a>
                                </div>
                                {contact.phone && (
                                  <div className="flex items-center">
                                    <Phone className="h-4 w-4 text-gray-400 mr-2" />
                                    <a 
                                      href={`tel:${contact.phone}`}
                                      className="text-sm text-gray-900"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {contact.phone}
                                    </a>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Position & Department */}
                            <td className="px-6 py-4">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {contact.position || 'Not specified'}
                                </div>
                                {contact.department && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {contact.department}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Contact Type */}
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getContactTypeColor(contact.contactType)}`}>
                                {contact.contactType}
                              </span>
                            </td>

                            {/* Account */}
                            <td className="px-6 py-4">
                              <div className="flex items-start">
                                <Building2 className="h-4 w-4 text-gray-400 mr-2 mt-0.5" />
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {account?.name || 'Unknown Account'}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {account?.region}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Products */}
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <Package className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm text-gray-900 font-medium">
                                  {contactProducts.length}
                                </span>
                                {contactProducts.length > 0 && (
                                  <div className="ml-2 text-xs text-gray-500 truncate max-w-24">
                                    {contactProducts[0].name}
                                    {contactProducts.length > 1 && ` +${contactProducts.length - 1}`}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Opportunities */}
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-3">
                                <div className="flex items-center">
                                  <Activity className="h-4 w-4 text-blue-500 mr-1" />
                                  <span className="text-sm text-gray-900 font-medium">
                                    {contactOpportunities.length}
                                  </span>
                                </div>
                                {activeOpportunities > 0 && (
                                  <div className="flex items-center">
                                    <Clock className="h-3 w-3 text-green-500 mr-1" />
                                    <span className="text-xs text-green-600">
                                      {activeOpportunities} active
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Last Contact */}
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                {(() => {
                                  const recentActivity = getMostRecentActivity(contact);
                                  const ActivityIcon = recentActivity ? getActivityIcon(recentActivity.activityType) : Calendar;
                                  
                                  // Use completed activity date or fallback to lastContactDate
                                  const displayDate = recentActivity ? 
                                    (recentActivity.completedAt ? toDate(recentActivity.completedAt) : toDate(recentActivity.dateTime)) : 
                                    contact.lastContactDate ? toDate(contact.lastContactDate) : null;
                                  
                                  if (displayDate && displayDate <= new Date()) {
                                    return (
                                      <>
                                        <ActivityIcon className={`h-4 w-4 mr-2 ${
                                          isOverdue ? 'text-red-500' : 'text-gray-400'
                                        }`} />
                                        <div>
                                          <div className={`text-sm ${
                                            isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'
                                          }`}>
                                            {formatDistanceToNow(displayDate, { addSuffix: true })}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {format(displayDate, 'MMM d, yyyy')}
                                          </div>
                                          {recentActivity && (
                                            <div className="flex items-center gap-1 text-xs text-gray-600">
                                              <span className="capitalize">{recentActivity.activityType}</span>
                                              {recentActivity.status === 'Completed' && (
                                                <>
                                                  <CheckCircle className="h-3 w-3 text-green-500" />
                                                  <span className="text-green-600">Completed</span>
                                                </>
                                              )}
                                              {recentActivity.status === 'Scheduled' && (
                                                <>
                                                  <Clock className="h-3 w-3 text-blue-500" />
                                                  <span className="text-blue-600">Scheduled</span>
                                                </>
                                              )}
                                            </div>
                                          )}
                                          {isOverdue && (
                                            <div className="flex items-center gap-1 text-xs text-red-600">
                                              <AlertTriangle className="h-3 w-3" />
                                              Overdue
                                            </div>
                                          )}
                                        </div>
                                      </>
                                    );
                                  } else {
                                    return (
                                      <div className="flex items-center">
                                        <Activity className="h-4 w-4 mr-2 text-gray-300" />
                                        <span className="text-sm text-gray-500">No contact recorded</span>
                                      </div>
                                    );
                                  }
                                })()}
                              </div>
                            </td>

                            {/* Contact Methods */}
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2">
                                {contact.preferredContactMethod && (
                                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                    {contact.preferredContactMethod}
                                  </span>
                                )}
                                {contact.linkedIn && (
                                  <a 
                                    href={contact.linkedIn}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 text-blue-600 hover:text-blue-800"
                                    onClick={(e) => e.stopPropagation()}
                                    title="LinkedIn Profile"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/contacts/${contact.id}`);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/contacts/${contact.id}`);
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                                  title="Edit Contact"
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
    </div>
  );
}; 