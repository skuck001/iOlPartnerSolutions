import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Plus, 
  Search, 
  Filter, 
  SortAsc, 
  SortDesc,
  Globe,
  MapPin,
  Users,
  Package,
  Eye
} from 'lucide-react';
import type { Account, Industry, CompanySize } from '../types';
import { getDocuments, createDocument, updateDocument, deleteDocument } from '../lib/firestore';

export const Accounts: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | 'All'>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const [sortField, setSortField] = useState<'name' | 'industry' | 'region' | 'createdAt'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);

  // Get unique values for filters
  const [uniqueRegions, setUniqueRegions] = useState<string[]>([]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    filterAndSortAccounts();
  }, [accounts, searchTerm, selectedIndustry, selectedStatus, selectedRegion, sortField, sortDirection]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const data = await getDocuments('accounts');
      const accountsData = data as Account[];
      setAccounts(accountsData);
      
      // Extract unique regions for filter
      const regions = [...new Set(accountsData.map(account => account.region).filter(Boolean))];
      setUniqueRegions(regions);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      // For demo purposes, use mock data if Firebase fails
      const mockAccounts: Account[] = [
        {
          id: '1',
          name: 'Amadeus',
          industry: 'Business Intelligence',
          region: 'Europe',
          website: 'https://amadeus.com',
          headquarters: 'Nice, France',
          companySize: 'Enterprise',
          description: 'Leading travel technology company providing solutions for airlines, hotels, and travel agencies.',
          status: 'Partner',
          tags: ['GDS', 'Technology', 'Travel'],
          createdAt: { toDate: () => new Date() } as any
        },
        {
          id: '2',
          name: 'Sabre',
          industry: 'GDS',
          region: 'North America',
          website: 'https://sabre.com',
          headquarters: 'Southlake, Texas',
          companySize: 'Enterprise',
          description: 'Global distribution system and travel technology company.',
          status: 'Active',
          tags: ['GDS', 'Airline'],
          createdAt: { toDate: () => new Date() } as any
        }
      ];
      setAccounts(mockAccounts);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortAccounts = () => {
    let filtered = [...accounts];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(account =>
        account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
        account.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (account.description && account.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (account.tags && account.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
      );
    }

    // Apply industry filter
    if (selectedIndustry !== 'All') {
      filtered = filtered.filter(account => account.industry === selectedIndustry);
    }

    // Apply status filter
    if (selectedStatus !== 'All') {
      filtered = filtered.filter(account => account.status === selectedStatus);
    }

    // Apply region filter
    if (selectedRegion !== 'All') {
      filtered = filtered.filter(account => account.region === selectedRegion);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'createdAt') {
        aValue = a.createdAt?.toDate?.() || new Date();
        bValue = b.createdAt?.toDate?.() || new Date();
      }

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredAccounts(filtered);
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };



  const clearFilters = () => {
    setSearchTerm('');
    setSelectedIndustry('All');
    setSelectedStatus('All');
    setSelectedRegion('All');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Partner':
        return 'bg-blue-100 text-blue-800';
      case 'Prospect':
        return 'bg-yellow-100 text-yellow-800';
      case 'Inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-iol-red"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-600">Manage travel technology companies and their products</p>
        </div>
        <Link
          to="/accounts/new"
          className="flex items-center gap-2 px-4 py-2 bg-iol-red text-white rounded-lg hover:bg-iol-red-dark"
        >
          <Plus className="h-4 w-4" />
          New Account
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iol-red"
            />
          </div>
          
          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Filter className="h-4 w-4" />
            Filters
            {(selectedIndustry !== 'All' || selectedStatus !== 'All' || selectedRegion !== 'All') && (
              <span className="bg-red-100 text-iol-red text-xs px-2 py-1 rounded-full">
                Active
              </span>
            )}
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                <select
                  value={selectedIndustry}
                  onChange={(e) => setSelectedIndustry(e.target.value as Industry | 'All')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iol-red"
                >
                  <option value="All">All Industries</option>
                  <option value="PMS">PMS</option>
                  <option value="CRS">CRS</option>
                  <option value="ChannelManager">Channel Manager</option>
                  <option value="GDS">GDS</option>
                  <option value="Connectivity">Connectivity</option>
                  <option value="Business Intelligence">Business Intelligence</option>
                  <option value="Revenue Management">Revenue Management</option>
                  <option value="Distribution">Distribution</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iol-red"
                >
                  <option value="All">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Partner">Partner</option>
                  <option value="Prospect">Prospect</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Region</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-iol-red"
                >
                  <option value="All">All Regions</option>
                  {uniqueRegions.map(region => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Clear Filters */}
            {(selectedIndustry !== 'All' || selectedStatus !== 'All' || selectedRegion !== 'All') && (
              <div className="mt-6">
                <button
                  onClick={clearFilters}
                  className="text-sm text-iol-red hover:text-iol-red-dark"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex justify-between items-center text-sm text-gray-600">
        <span>
          Showing {filteredAccounts.length} of {accounts.length} accounts
        </span>
        <div className="flex items-center gap-4">
          <span>Sort by:</span>
          <button
            onClick={() => handleSort('name')}
                          className={`flex items-center gap-1 ${sortField === 'name' ? 'text-iol-red' : 'text-gray-600'}`}
          >
            Name
            {sortField === 'name' && (
              sortDirection === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
            )}
          </button>
          <button
            onClick={() => handleSort('industry')}
                          className={`flex items-center gap-1 ${sortField === 'industry' ? 'text-iol-red' : 'text-gray-600'}`}
          >
            Industry
            {sortField === 'industry' && (
              sortDirection === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
            )}
          </button>
          <button
            onClick={() => handleSort('createdAt')}
                          className={`flex items-center gap-1 ${sortField === 'createdAt' ? 'text-iol-red' : 'text-gray-600'}`}
          >
            Created
            {sortField === 'createdAt' && (
              sortDirection === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredAccounts.map((account) => (
          <Link
            key={account.id}
            to={`/accounts/${account.id}`}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow block"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-iol-red" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">{account.name}</h3>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(account.status)}`}>
                    {account.status}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span>{account.industry}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{account.region}</span>
              </div>
              {account.website && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span className="truncate">{account.website.replace(/^https?:\/\//, '')}</span>
                </div>
              )}
            </div>

            {account.description && (
              <p className="text-sm text-gray-600 mt-4 line-clamp-2 leading-relaxed">
                {account.description}
              </p>
            )}

            {account.tags && account.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {account.tags.slice(0, 3).map((tag, index) => (
                  <span key={index} className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-md">
                    {tag}
                  </span>
                ))}
                {account.tags.length > 3 && (
                  <span className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-md">
                    +{account.tags.length - 3} more
                  </span>
                )}
              </div>
            )}

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
              <div className="text-xs text-gray-500">
                {account.companySize && (
                  <span>{account.companySize} Company</span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                Created {account.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Empty State */}
      {filteredAccounts.length === 0 && !loading && (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || selectedIndustry !== 'All' || selectedStatus !== 'All' || selectedRegion !== 'All'
              ? 'Try adjusting your search or filters.'
              : 'Get started by creating your first account.'}
          </p>
          {searchTerm || selectedIndustry !== 'All' || selectedStatus !== 'All' || selectedRegion !== 'All' ? (
            <button
              onClick={clearFilters}
                              className="text-iol-red hover:text-iol-red-dark"
            >
              Clear filters
            </button>
          ) : (
            <Link
              to="/accounts/new"
              className="flex items-center gap-2 px-4 py-2 bg-iol-red text-white rounded-lg hover:bg-iol-red-dark mx-auto"
            >
              <Plus className="h-4 w-4" />
              Create your first account
            </Link>
          )}
        </div>
      )}


    </div>
  );
}; 