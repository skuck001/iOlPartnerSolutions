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
import type { Contact, ContactType, Account, Product, Opportunity } from '../types';
import { getDocuments } from '../lib/firestore';
import { format, formatDistanceToNow, isAfter, isBefore, startOfDay } from 'date-fns';

type SortField = 'name' | 'email' | 'position' | 'contactType' | 'lastContactDate' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export const Contacts: React.FC = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [contactTypeFilter, setContactTypeFilter] = useState<ContactType | 'All'>('All');
  const [accountFilter, setAccountFilter] = useState<string>('All');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [contactsData, accountsData, productsData, opportunitiesData] = await Promise.all([
        getDocuments('contacts'),
        getDocuments('accounts'),
        getDocuments('products'),
        getDocuments('opportunities')
      ]);
      setContacts(contactsData as Contact[]);
      setAccounts(accountsData as Account[]);
      setProducts(productsData as Product[]);
      setOpportunities(opportunitiesData as Opportunity[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
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

  const isContactOverdue = (contact: Contact) => {
    if (!contact.lastContactDate) return false;
    const daysSinceLastContact = Math.floor(
      (new Date().getTime() - contact.lastContactDate.toDate().getTime()) / (1000 * 60 * 60 * 24)
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

  const filteredAndSortedContacts = contacts
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
          aValue = a.lastContactDate?.toMillis() || 0;
          bValue = b.lastContactDate?.toMillis() || 0;
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

  const CONTACT_TYPES: ContactType[] = ['Primary', 'Secondary', 'Technical', 'Billing', 'Decision Maker', 'Other'];

  const uniqueAccounts = Array.from(new Set(contacts.map(c => c.accountId)))
    .map(accountId => accounts.find(a => a.id === accountId))
    .filter(Boolean) as Account[];

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
          'Account Industry': account?.industry || '',
          'Account Region': account?.region || '',
          'Is Decision Maker': contact.isDecisionMaker ? 'Yes' : 'No',
          'Preferred Contact Method': contact.preferredContactMethod || '',
          'LinkedIn': contact.linkedIn || '',
          'Timezone': contact.timezone || '',
          'Last Contact Date': contact.lastContactDate 
            ? format(contact.lastContactDate.toDate(), 'yyyy-MM-dd') 
            : '',
          'Days Since Last Contact': contact.lastContactDate 
            ? Math.floor((new Date().getTime() - contact.lastContactDate.toDate().getTime()) / (1000 * 60 * 60 * 24))
            : '',
          'Is Overdue': isOverdue ? 'Yes' : 'No',
          'Product Count': contactProducts.length,
          'Products': contactProducts.map(p => p.name).join(', '),
          'Active Opportunities': activeOpportunities,
          'Total Opportunities': contactOpportunities.length,
          'Opportunity Titles': contactOpportunities.map(opp => opp.title).join(', '),
          'Notes': contact.notes || '',
          'Created Date': format(contact.createdAt.toDate(), 'yyyy-MM-dd'),
          'Last Updated': contact.updatedAt 
            ? format(contact.updatedAt.toDate(), 'yyyy-MM-dd') 
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
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
            <p className="text-sm text-gray-600 mt-1">
              {filteredAndSortedContacts.length} of {contacts.length} contacts
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
        {loading ? (
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
                  {filteredAndSortedContacts.map((contact) => {
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
                                {account?.industry} • {account?.region}
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
                            {contact.lastContactDate ? (
                              <>
                                <Calendar className={`h-4 w-4 mr-2 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`} />
                                <div>
                                  <div className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                                    {formatDistanceToNow(contact.lastContactDate.toDate(), { addSuffix: true })}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {format(contact.lastContactDate.toDate(), 'MMM d, yyyy')}
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
                              <span className="text-sm text-gray-500">Never contacted</span>
                            )}
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
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 