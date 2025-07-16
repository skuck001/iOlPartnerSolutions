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
  Download,
  ExternalLink,
  Globe,
  Tag,
  Star
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Account, Industry, CompanySize, Contact, Product, Opportunity } from '../types';
import { getDocuments } from '../lib/firestore';
import { format, formatDistanceToNow, isAfter, isBefore, startOfDay } from 'date-fns';

type SortField = 'name' | 'industry' | 'region' | 'status' | 'companySize' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export const Accounts: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [industryFilter, setIndustryFilter] = useState<Industry | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [regionFilter, setRegionFilter] = useState<string>('All');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [accountsData, contactsData, productsData, opportunitiesData] = await Promise.all([
        getDocuments('accounts'),
        getDocuments('contacts'),
        getDocuments('products'),
        getDocuments('opportunities')
      ]);
      setAccounts(accountsData as Account[]);
      setContacts(contactsData as Contact[]);
      setProducts(productsData as Product[]);
      setOpportunities(opportunitiesData as Opportunity[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getContactsForAccount = (account: Account) => {
    return contacts.filter(c => c.accountId === account.id);
  };

  const getProductsForAccount = (account: Account) => {
    return products.filter(p => p.accountId === account.id);
  };

  const getOpportunitiesForAccount = (account: Account) => {
    return opportunities.filter(opp => opp.accountId === account.id);
  };

  const getActiveOpportunitiesCount = (account: Account) => {
    const accountOpportunities = getOpportunitiesForAccount(account);
    return accountOpportunities.filter(opp => 
      opp.stage !== 'Closed-Won' && opp.stage !== 'Closed-Lost'
    ).length;
  };

  const getTotalDealValue = (account: Account) => {
    const accountOpportunities = getOpportunitiesForAccount(account);
    return accountOpportunities
      .filter(opp => opp.stage !== 'Closed-Lost')
      .reduce((total, opp) => total + (opp.estimatedDealValue || 0), 0);
  };

  const getWonDealValue = (account: Account) => {
    const accountOpportunities = getOpportunitiesForAccount(account);
    return accountOpportunities
      .filter(opp => opp.stage === 'Closed-Won')
      .reduce((total, opp) => total + (opp.estimatedDealValue || 0), 0);
  };

  const getPrimaryContact = (account: Account) => {
    const accountContacts = getContactsForAccount(account);
    return accountContacts.find(c => c.contactType === 'Primary') || accountContacts[0];
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRowClick = (account: Account) => {
    navigate(`/accounts/${account.id}`);
  };

  const handleAdd = () => {
    navigate('/accounts/new');
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'Active': 'bg-green-100 text-green-800 border-green-200',
      'Inactive': 'bg-gray-100 text-gray-800 border-gray-200',
      'Prospect': 'bg-blue-100 text-blue-800 border-blue-200',
      'Partner': 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getCompanySizeColor = (size: CompanySize) => {
    const colors = {
      'Startup': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Small': 'bg-blue-100 text-blue-800 border-blue-200',
      'Medium': 'bg-green-100 text-green-800 border-green-200',
      'Large': 'bg-orange-100 text-orange-800 border-orange-200',
      'Enterprise': 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colors[size];
  };

  const getIndustryIcon = (industry: Industry) => {
    const icons = {
      'PMS': '🏨',
      'CRS': '📅',
      'ChannelManager': '🔗',
      'GDS': '🌐',
      'Connectivity': '⚡',
      'Business Intelligence': '📊',
      'Revenue Management': '💰',
      'Distribution': '📈',
      'Other': '🏢'
    };
    return icons[industry] || '🏢';
  };

  const filteredAndSortedAccounts = accounts
    .filter(account => {
      const matchesSearch = (
        account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (account.description && account.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        account.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (account.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      
      const matchesIndustry = industryFilter === 'All' || account.industry === industryFilter;
      const matchesStatus = statusFilter === 'All' || account.status === statusFilter;
      const matchesRegion = regionFilter === 'All' || account.region === regionFilter;
      
      return matchesSearch && matchesIndustry && matchesStatus && matchesRegion;
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'industry':
          aValue = a.industry;
          bValue = b.industry;
          break;
        case 'region':
          aValue = a.region.toLowerCase();
          bValue = b.region.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'companySize':
          const sizeOrder = { 'Startup': 1, 'Small': 2, 'Medium': 3, 'Large': 4, 'Enterprise': 5 };
          aValue = sizeOrder[a.companySize || 'Small'];
          bValue = sizeOrder[b.companySize || 'Small'];
          break;
        case 'createdAt':
          aValue = a.createdAt.toMillis();
          bValue = b.createdAt.toMillis();
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

  const INDUSTRIES: Industry[] = ['PMS', 'CRS', 'ChannelManager', 'GDS', 'Connectivity', 'Business Intelligence', 'Revenue Management', 'Distribution', 'Other'];
  const STATUSES = ['Active', 'Inactive', 'Prospect', 'Partner'];

  const uniqueRegions = Array.from(new Set(accounts.map(a => a.region))).sort();

  const handleExportToExcel = () => {
    try {
      if (filteredAndSortedAccounts.length === 0) {
        alert('No accounts to export');
        return;
      }

      // Prepare data for export
      const exportData = filteredAndSortedAccounts.map((account) => {
        const accountContacts = getContactsForAccount(account);
        const accountProducts = getProductsForAccount(account);
        const accountOpportunities = getOpportunitiesForAccount(account);
        const activeOpportunities = getActiveOpportunitiesCount(account);
        const totalDealValue = getTotalDealValue(account);
        const wonDealValue = getWonDealValue(account);
        const primaryContact = getPrimaryContact(account);

        return {
          'Account Name': account.name,
          'Industry': account.industry,
          'Region': account.region,
          'Status': account.status,
          'Company Size': account.companySize || '',
          'Headquarters': account.headquarters || '',
          'Website': account.website || '',
          'Description': account.description || '',
          'Parent Account': account.parentAccountId ? accounts.find(a => a.id === account.parentAccountId)?.name || 'Unknown' : '',
          'Primary Contact': primaryContact?.name || '',
          'Primary Contact Email': primaryContact?.email || '',
          'Primary Contact Phone': primaryContact?.phone || '',
          'Total Contacts': accountContacts.length,
          'Contact Names': accountContacts.map(c => c.name).join(', '),
          'Total Products': accountProducts.length,
          'Product Names': accountProducts.map(p => p.name).join(', '),
          'Total Opportunities': accountOpportunities.length,
          'Active Opportunities': activeOpportunities,
          'Won Opportunities': accountOpportunities.filter(opp => opp.stage === 'Closed-Won').length,
          'Lost Opportunities': accountOpportunities.filter(opp => opp.stage === 'Closed-Lost').length,
          'Total Deal Value': totalDealValue,
          'Won Deal Value': wonDealValue,
          'Opportunity Titles': accountOpportunities.map(opp => opp.title).join(', '),
          'Tags': (account.tags || []).join(', '),
          'Notes': account.notes || '',
          'Created Date': format(account.createdAt.toDate(), 'yyyy-MM-dd'),
          'Last Updated': account.updatedAt 
            ? format(account.updatedAt.toDate(), 'yyyy-MM-dd') 
            : ''
        };
      });

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);

      // Auto-size columns
      const columnWidths = [];
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Accounts');

      // Generate filename with current date
      const filename = `accounts_export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);
      
      // Show success message
      console.log(`Exported ${exportData.length} accounts to ${filename}`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export data to Excel. Please try again.');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Accounts</h1>
            <p className="text-sm text-gray-600 mt-1">
              {filteredAndSortedAccounts.length} of {accounts.length} accounts
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportToExcel}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors shadow-sm"
              title={`Export ${filteredAndSortedAccounts.length} accounts to Excel`}
            >
              <Download className="h-4 w-4" />
              Export Excel
              <span className="ml-1 px-2 py-0.5 bg-green-500 text-green-100 text-xs rounded-full">
                {filteredAndSortedAccounts.length}
              </span>
            </button>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New Account
            </button>
          </div>
        </div>
        
        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search accounts, regions, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm"
            />
          </div>
          
          <div className="flex gap-3">
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value as Industry | 'All')}
              className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white shadow-sm"
            >
              <option value="All">All Industries</option>
              {INDUSTRIES.map(industry => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white shadow-sm"
            >
              <option value="All">All Statuses</option>
              {STATUSES.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white shadow-sm"
            >
              <option value="All">All Regions</option>
              {uniqueRegions.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredAndSortedAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Building2 className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchTerm || industryFilter !== 'All' || statusFilter !== 'All' || regionFilter !== 'All'
                ? 'Try adjusting your search or filters' 
                : 'Get started by creating your first account'}
            </p>
            {!searchTerm && industryFilter === 'All' && statusFilter === 'All' && regionFilter === 'All' && (
              <button
                onClick={handleAdd}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Account
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
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Account
                        {getSortIcon('name')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('industry')}
                    >
                      <div className="flex items-center">
                        Industry
                        {getSortIcon('industry')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('region')}
                    >
                      <div className="flex items-center">
                        Region & Size
                        {getSortIcon('region')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center">
                        Status
                        {getSortIcon('status')}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contacts
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Products
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Opportunities
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deal Value
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Primary Contact
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tags & Links
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedAccounts.map((account) => {
                    const accountContacts = getContactsForAccount(account);
                    const accountProducts = getProductsForAccount(account);
                    const accountOpportunities = getOpportunitiesForAccount(account);
                    const activeOpportunities = getActiveOpportunitiesCount(account);
                    const totalDealValue = getTotalDealValue(account);
                    const wonDealValue = getWonDealValue(account);
                    const primaryContact = getPrimaryContact(account);
                    
                    return (
                      <tr
                        key={account.id}
                        onClick={() => handleRowClick(account)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        {/* Account Name */}
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                              {account.logo ? (
                                <img src={account.logo} alt={account.name} className="h-8 w-8 rounded" />
                              ) : (
                                <span className="text-lg">{getIndustryIcon(account.industry)}</span>
                              )}
                            </div>
                            <div className="max-w-48">
                              <div className="text-sm font-medium text-gray-900 line-clamp-1">
                                {account.name}
                              </div>
                              {account.website && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Globe className="h-3 w-3 text-blue-500" />
                                  <a 
                                    href={account.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800 truncate"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {account.website.replace(/^https?:\/\//, '')}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Industry */}
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <span className="text-lg mr-2">{getIndustryIcon(account.industry)}</span>
                            <span className="text-sm text-gray-900">{account.industry}</span>
                          </div>
                        </td>

                        {/* Region & Size */}
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center">
                              <MapPin className="h-3 w-3 text-gray-400 mr-1" />
                              <span className="text-sm text-gray-900">{account.region}</span>
                            </div>
                            {account.companySize && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getCompanySizeColor(account.companySize)}`}>
                                {account.companySize}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(account.status)}`}>
                            {account.status}
                          </span>
                        </td>

                        {/* Contacts */}
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <Users className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900 font-medium">
                              {accountContacts.length}
                            </span>
                            {accountContacts.length > 0 && (
                              <div className="ml-2 text-xs text-gray-500 truncate max-w-24">
                                {accountContacts[0].name}
                                {accountContacts.length > 1 && ` +${accountContacts.length - 1}`}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Products */}
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <Package className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900 font-medium">
                              {accountProducts.length}
                            </span>
                            {accountProducts.length > 0 && (
                              <div className="ml-2 text-xs text-gray-500 truncate max-w-24">
                                {accountProducts[0].name}
                                {accountProducts.length > 1 && ` +${accountProducts.length - 1}`}
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
                                {accountOpportunities.length}
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
                            {wonDealValue > 0 && (
                              <div className="flex items-center">
                                <CheckCircle className="h-3 w-3 text-blue-500 mr-1" />
                                <span className="text-xs text-blue-600">
                                  {accountOpportunities.filter(opp => opp.stage === 'Closed-Won').length} won
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Deal Value */}
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center">
                              <DollarSign className="h-4 w-4 text-green-500 mr-1" />
                              <span className="text-sm font-medium text-gray-900">
                                {totalDealValue > 0 ? `$${totalDealValue.toLocaleString()}` : '$0'}
                              </span>
                            </div>
                            {wonDealValue > 0 && (
                              <div className="flex items-center">
                                <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
                                <span className="text-xs text-green-600">
                                  ${wonDealValue.toLocaleString()} won
                                </span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Primary Contact */}
                        <td className="px-6 py-4">
                          {primaryContact ? (
                            <div className="flex items-center">
                              <Users className="h-4 w-4 text-gray-400 mr-2" />
                              <div>
                                <div className="text-sm text-gray-900 truncate max-w-32">
                                  {primaryContact.name}
                                </div>
                                <div className="text-xs text-gray-500 truncate max-w-32">
                                  {primaryContact.position || primaryContact.email}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">No contact</span>
                          )}
                        </td>

                        {/* Tags & Links */}
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {(account.tags || []).length > 0 && (
                              <div className="flex items-center">
                                <Tag className="h-3 w-3 text-gray-400 mr-1" />
                                <div className="flex flex-wrap gap-1">
                                  {(account.tags || []).slice(0, 2).map((tag, index) => (
                                    <span key={index} className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                                      {tag}
                                    </span>
                                  ))}
                                  {(account.tags || []).length > 2 && (
                                    <span className="text-xs text-gray-500">
                                      +{(account.tags || []).length - 2}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            {account.headquarters && (
                              <div className="flex items-center">
                                <Building2 className="h-3 w-3 text-gray-400 mr-1" />
                                <span className="text-xs text-gray-500 truncate max-w-24">
                                  {account.headquarters}
                                </span>
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
                                navigate(`/accounts/${account.id}`);
                              }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/accounts/${account.id}`);
                              }}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                              title="Edit Account"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 