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
  Star,
  Code,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Product, ProductCategory, ProductSubcategory, Account, Contact, Opportunity } from '../types';
import { useDataContext } from '../context/DataContext';
import { format, formatDistanceToNow, isAfter, isBefore, startOfDay } from 'date-fns';

type SortField = 'name' | 'category' | 'subcategory' | 'status' | 'version' | 'createdAt';
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

export const Products: React.FC = () => {
  const navigate = useNavigate();
  const {
    cache,
    loading,
    getAccounts,
    getContacts,
    getProducts,
    getOpportunities
  } = useDataContext();
  
  const products = cache?.products || [];
  const accounts = cache?.accounts || [];
  const contacts = cache?.contacts || [];
  const opportunities = cache?.opportunities || [];
  const [pageLoading, setPageLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [accountFilter, setAccountFilter] = useState<string>('All');

  useEffect(() => {
    fetchAllData();
  }, []);

  // Update loading state when all data is loaded
  useEffect(() => {
    if (!loading?.products && !loading?.accounts && !loading?.contacts && !loading?.opportunities) {
      setPageLoading(false);
    }
  }, [loading]);

  const fetchAllData = async () => {
    try {
      // Fetch all data via DataContext (optimized with caching)
      await Promise.all([
        getProducts(),
        getAccounts(),
        getContacts(),
        getOpportunities()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      setPageLoading(false);
    }
  };

  const getAccount = (accountId: string) => {
    return accounts.find(a => a.id === accountId);
  };

  const getContactsForProduct = (product: Product) => {
    return contacts.filter(c => c.productIds?.includes(product.id) || false);
  };

  const getOpportunitiesForProduct = (product: Product) => {
    return opportunities.filter(opp => opp.productId === product.id);
  };

  const getActiveOpportunitiesCount = (product: Product) => {
    const productOpportunities = getOpportunitiesForProduct(product);
    return productOpportunities.filter(opp => 
      opp.stage !== 'Closed-Won' && opp.stage !== 'Closed-Lost'
    ).length;
  };

  const getTotalDealValue = (product: Product) => {
    const productOpportunities = getOpportunitiesForProduct(product);
    return productOpportunities
      .filter(opp => opp.stage !== 'Closed-Lost')
      .reduce((total, opp) => total + (opp.estimatedDealValue || 0), 0);
  };

  const getWonDealValue = (product: Product) => {
    const productOpportunities = getOpportunitiesForProduct(product);
    return productOpportunities
      .filter(opp => opp.stage === 'Closed-Won')
      .reduce((total, opp) => total + (opp.estimatedDealValue || 0), 0);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRowClick = (product: Product) => {
    navigate(`/products/${product.id}`);
  };

  const handleAdd = () => {
    navigate('/products/new');
  };

  const getCategoryColor = (category: ProductCategory) => {
    const colors = {
      'Business Intelligence': 'bg-blue-100 text-blue-800 border-blue-200',
      'Revenue Management': 'bg-green-100 text-green-800 border-green-200',
      'Distribution': 'bg-purple-100 text-purple-800 border-purple-200',
      'Guest Experience': 'bg-pink-100 text-pink-800 border-pink-200',
      'Operations': 'bg-orange-100 text-orange-800 border-orange-200',
      'Connectivity': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Booking Engine': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'Channel Management': 'bg-teal-100 text-teal-800 border-teal-200',
      'Other': 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[category];
  };



  const getStatusColor = (status: string) => {
    const colors = {
      'Active': 'bg-green-100 text-green-800 border-green-200',
      'Deprecated': 'bg-red-100 text-red-800 border-red-200',
      'Development': 'bg-blue-100 text-blue-800 border-blue-200',
      'Beta': 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getCategoryIcon = (category: ProductCategory) => {
    const icons = {
      'Business Intelligence': '📊',
      'Revenue Management': '💰',
      'Distribution': '📈',
      'Guest Experience': '🎯',
      'Operations': '⚙️',
      'Connectivity': '🔗',
      'Booking Engine': '📅',
      'Channel Management': '🌐',
      'Other': '📦'
    };
    return icons[category] || '📦';
  };



  const filteredAndSortedProducts = (products || [])
    .filter(product => {
      const account = getAccount(product.accountId);
      const matchesSearch = (
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.subcategory.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (account?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||

        (product.tags || []).some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      
      const matchesBusinessType = businessTypeFilter === 'All';
      const matchesStatus = statusFilter === 'All' || product.status === statusFilter;
      const matchesAccount = accountFilter === 'All' || product.accountId === accountFilter;
      
      return matchesSearch && matchesBusinessType && matchesStatus && matchesAccount;
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'category':
          aValue = a.category;
          bValue = b.category;
          break;
        case 'subcategory':
          aValue = a.subcategory;
          bValue = b.subcategory;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'version':
          aValue = a.version || '';
          bValue = b.version || '';
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


  
  const STATUSES = ['Active', 'Deprecated', 'Development', 'Beta'];

  const uniqueAccounts = Array.from(new Set((products || []).map(p => p.accountId)))
    .map(accountId => accounts.find(a => a.id === accountId))
    .filter(Boolean) as Account[];

  const handleExportToExcel = () => {
    try {
      if (filteredAndSortedProducts.length === 0) {
        alert('No products to export');
        return;
      }

      // Prepare data for export
      const exportData = filteredAndSortedProducts.map((product) => {
        const account = getAccount(product.accountId);
        const productContacts = getContactsForProduct(product);
        const productOpportunities = getOpportunitiesForProduct(product);
        const activeOpportunities = getActiveOpportunitiesCount(product);
        const totalDealValue = getTotalDealValue(product);
        const wonDealValue = getWonDealValue(product);

        return {
          'Product Name': product.name,
          'Account Name': account?.name || 'Unknown Account',
          'Account Headoffice Country': account?.region || '',
          'Product Category': product.category,
          'Product Subcategory': product.subcategory,
          'Status': product.status,
          'Version': product.version || '',
          'Description': product.description || '',
          'Target Market': product.targetMarket || '',
          'Pricing': product.pricing || '',
          'Website': product.website || '',
          'Contact Count': productContacts.length,
          'Contact Names': productContacts.map(c => c.name).join(', '),
          'Primary Contact': productContacts.find(c => c.contactType === 'Primary')?.name || productContacts[0]?.name || '',
          'Primary Contact Email': productContacts.find(c => c.contactType === 'Primary')?.email || productContacts[0]?.email || '',
          'Technical Contact': productContacts.find(c => c.contactType === 'Technical')?.name || '',
          'Technical Contact Email': productContacts.find(c => c.contactType === 'Technical')?.email || '',
          'Total Opportunities': productOpportunities.length,
          'Active Opportunities': activeOpportunities,
          'Won Opportunities': productOpportunities.filter(opp => opp.stage === 'Closed-Won').length,
          'Lost Opportunities': productOpportunities.filter(opp => opp.stage === 'Closed-Lost').length,
          'Total Deal Value': totalDealValue,
          'Won Deal Value': wonDealValue,
          'Opportunity Titles': productOpportunities.map(opp => opp.title).join(', '),
          'Tags': (product.tags || []).join(', '),
          'Notes': product.notes || '',
          'Created Date': format(toDate(product.createdAt), 'yyyy-MM-dd'),
          'Last Updated': product.updatedAt 
            ? format(toDate(product.updatedAt), 'yyyy-MM-dd') 
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

      // Generate filename with current date
      const filename = `products_export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);
      
      // Show success message
      console.log(`Exported ${exportData.length} products to ${filename}`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export data to Excel. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4 sm:mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Products</h1>
            <p className="text-sm text-gray-600 mt-1">
              {filteredAndSortedProducts.length} of {products?.length || 0} products
            </p>
          </div>
          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={handleExportToExcel}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors shadow-sm"
              title={`Export ${filteredAndSortedProducts.length} products to Excel`}
            >
              <Download className="h-4 w-4" />
              Export Excel
              <span className="ml-1 px-2 py-0.5 bg-green-500 text-green-100 text-xs rounded-full">
                {filteredAndSortedProducts.length}
              </span>
            </button>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50 transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              New Product
            </button>
          </div>
        </div>
        
        {/* Search and Filters */}
        <div className="flex flex-col gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search products, accounts, or categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">

            
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
        {pageLoading || loading?.products ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredAndSortedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Package className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {searchTerm || businessTypeFilter !== 'All' || statusFilter !== 'All' || accountFilter !== 'All'
                ? 'Try adjusting your search or filters' 
                : 'Get started by creating your first product'}
            </p>
            {!searchTerm && businessTypeFilter === 'All' && statusFilter === 'All' && accountFilter === 'All' && (
              <button
                onClick={handleAdd}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create Product
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
                        Product
                        {getSortIcon('name')}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Account
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('category')}
                    >
                      <div className="flex items-center">
                        Business Type
                        {getSortIcon('category')}
                      </div>
                    </th>
                    <th 
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 group"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center">
                        Status & Version
                        {getSortIcon('status')}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contacts
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Opportunities
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Deal Value
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Target Market
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
                  {filteredAndSortedProducts.map((product) => {
                    const account = getAccount(product.accountId);
                    const productContacts = getContactsForProduct(product);
                    const productOpportunities = getOpportunitiesForProduct(product);
                    const activeOpportunities = getActiveOpportunitiesCount(product);
                    const totalDealValue = getTotalDealValue(product);
                    const wonDealValue = getWonDealValue(product);
                    
                    return (
                      <tr
                        key={product.id}
                        onClick={() => handleRowClick(product)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        {/* Product Name */}
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                              <span className="text-lg">📦</span>
                            </div>
                            <div className="max-w-48">
                              <div className="text-sm font-medium text-gray-900 line-clamp-1">
                                {product.name}
                              </div>
                              {product.website && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Globe className="h-3 w-3 text-blue-500" />
                                  <a 
                                    href={product.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:text-blue-800 truncate"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {product.website.replace(/^https?:\/\//, '')}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
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

                        {/* Category & Type */}
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-gray-900">
                              {product.category}
                            </div>
                            <div className="text-xs text-gray-500">
                              {product.subcategory}
                            </div>
                          </div>
                        </td>

                        {/* Status & Version */}
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(product.status)}`}>
                              {product.status}
                            </span>
                            {product.version && (
                              <div className="flex items-center">
                                <Code className="h-3 w-3 text-gray-400 mr-1" />
                                <span className="text-xs text-gray-600">v{product.version}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Contacts */}
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <Users className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900 font-medium">
                              {productContacts.length}
                            </span>
                            {productContacts.length > 0 && (
                              <div className="ml-2 text-xs text-gray-500 truncate max-w-24">
                                {productContacts.find(c => c.contactType === 'Primary')?.name || productContacts[0].name}
                                {productContacts.length > 1 && ` +${productContacts.length - 1}`}
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
                                {productOpportunities.length}
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
                                  {productOpportunities.filter(opp => opp.stage === 'Closed-Won').length} won
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

                        {/* Target Market */}
                        <td className="px-6 py-4">
                          <div>
                            {product.targetMarket ? (
                              <div className="text-sm text-gray-900 truncate max-w-32">
                                {product.targetMarket}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500">Not specified</span>
                            )}
                            {product.pricing && (
                              <div className="text-xs text-gray-500 mt-1 truncate max-w-32">
                                {product.pricing}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Tags & Links */}
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {(product.tags || []).length > 0 && (
                              <div className="flex items-center">
                                <Tag className="h-3 w-3 text-gray-400 mr-1" />
                                <div className="flex flex-wrap gap-1">
                                  {(product.tags || []).slice(0, 2).map((tag, index) => (
                                    <span key={index} className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                                      {tag}
                                    </span>
                                  ))}
                                  {(product.tags || []).length > 2 && (
                                    <span className="text-xs text-gray-500">
                                      +{(product.tags || []).length - 2}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            {product.description && (
                              <div className="text-xs text-gray-500 truncate max-w-32" title={product.description}>
                                {product.description}
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
                                navigate(`/products/${product.id}`);
                              }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/products/${product.id}`);
                              }}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                              title="Edit Product"
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

      {/* Floating Action Buttons - Desktop */}
      <div className="hidden md:flex fixed bottom-6 right-6 flex-col gap-3 z-50">
        {/* Export Button */}
        <button
          onClick={handleExportToExcel}
          className="group relative inline-flex items-center justify-center w-14 h-14 bg-green-600 text-white rounded-full hover:bg-green-700 focus:outline-none focus:ring-4 focus:ring-green-500 focus:ring-opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl"
          title={`Export ${filteredAndSortedProducts.length} products to Excel`}
        >
          <Download className="h-6 w-6" />
          <span className="absolute right-16 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            Export Excel ({filteredAndSortedProducts.length})
          </span>
        </button>

        {/* New Product Button */}
        <button
          onClick={handleAdd}
          className="group relative inline-flex items-center justify-center w-14 h-14 bg-primary-600 text-white rounded-full hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-500 focus:ring-opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl"
          title="Create New Product"
        >
          <Plus className="h-6 w-6" />
          <span className="absolute right-16 top-1/2 transform -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
            New Product
          </span>
        </button>
      </div>

      {/* Mobile Floating Action Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 flex gap-3 z-40">
        <button
          onClick={handleExportToExcel}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors shadow-sm"
          title={`Export ${filteredAndSortedProducts.length} products to Excel`}
        >
          <Download className="h-5 w-5" />
          <span>Export ({filteredAndSortedProducts.length})</span>
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