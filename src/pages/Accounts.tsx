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
import type { Account, Contact, Product, Opportunity } from '../types';
import { format, formatDistanceToNow, isAfter, isBefore, startOfDay } from 'date-fns';
import { useUsersApi } from '../hooks/useUsersApi';
import { useDataContext } from '../context/DataContext';

type SortField = 'name' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export const Accounts: React.FC = () => {
  const navigate = useNavigate();
  const {
    cache,
    loading,
    getAccounts,
    getContacts,
    getProducts,
    getOpportunities
  } = useDataContext();
  
  const { getUserById, getUserDisplayName } = useUsersApi();
  
  const accounts = cache?.accounts || [];
  const contacts = cache?.contacts || [];
  const products = cache?.products || [];
  const opportunities = cache?.opportunities || [];
  
  const [pageLoading, setPageLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    // Fetch owner names for all accounts using Cloud Functions API
    const fetchOwnerNames = async () => {
      const ownerIds = Array.from(new Set(accounts.map(account => account.ownerId).filter(Boolean)));
      const names: Record<string, string> = {};
      
      await Promise.all(
        ownerIds.map(async (ownerId) => {
          try {
            const user = await getUserById(ownerId);
            names[ownerId] = user ? getUserDisplayName(user) : 'Unknown User';
          } catch (error) {
            console.error(`Error fetching user ${ownerId}:`, error);
            names[ownerId] = 'Unknown User';
          }
        })
      );
      
      setOwnerNames(names);
    };

    if (accounts && accounts.length > 0) {
      fetchOwnerNames();
    }
  }, [accounts, getUserById, getUserDisplayName]);

  // Update loading state when all data is loaded
  useEffect(() => {
    if (!loading?.accounts && !loading?.contacts && !loading?.products && !loading?.opportunities) {
      setPageLoading(false);
    }
  }, [loading]);

  const fetchAllData = async () => {
    try {
      // Fetch all data via DataContext (optimized with caching)
      await Promise.all([
        getAccounts(),
        getContacts(),
        getProducts(),
        getOpportunities()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const getContactsForAccount = (account: Account) => {
    return (contacts || []).filter(c => c.accountId === account.id);
  };

  const getProductsForAccount = (account: Account) => {
    return (products || []).filter(p => p.accountId === account.id);
  };

  const getOpportunitiesForAccount = (account: Account) => {
    return (opportunities || []).filter(opp => opp.accountId === account.id);
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

  const filteredAndSortedAccounts = (accounts || [])
    .filter(account => {
      const matchesSearch = (
        account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (account.description && account.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        account.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (account.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      
      return matchesSearch;
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'createdAt':
          aValue = a.createdAt?.seconds || 0;
          bValue = b.createdAt?.seconds || 0;
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
          'Headoffice Country': account.region,
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
          'Created Date': account.createdAt?.seconds ? format(new Date(account.createdAt.seconds * 1000), 'yyyy-MM-dd') : '',
          'Last Updated': account.updatedAt?.seconds 
            ? format(new Date(account.updatedAt.seconds * 1000), 'yyyy-MM-dd') 
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
    <div className="min-h-screen flex flex-col bg-gray-50">


      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Accounts</h1>
            <p className="text-sm text-gray-600 mt-1">
              {filteredAndSortedAccounts.length} of {accounts?.length || 0} accounts
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
              placeholder="Search accounts or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {pageLoading || loading?.accounts ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredAndSortedAccounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Building2 className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchTerm
                ? 'Try adjusting your search' 
                : 'Get started by creating your first account'}
            </p>
            {!searchTerm && (
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
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Owner
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
                                <span className="text-lg">🏢</span>
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

                        {/* Owner */}
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <Users className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900 font-medium">
                              {ownerNames[account.ownerId] || 'N/A'}
                            </span>
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