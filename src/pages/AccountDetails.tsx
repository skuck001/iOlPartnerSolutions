import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Trash2,
  Building2,
  Globe,
  MapPin,
  Users,
  Briefcase,
  Plus,
  X,
  Calendar,
  Package
} from 'lucide-react';
import type { Account, Product, Contact, ContactType, Opportunity } from '../types';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { OwnerSelect } from '../components/OwnerSelect';
import { useAccountsApi } from '../hooks/useAccountsApi';
import { useContactsApi } from '../hooks/useContactsApi';
import { useProductsApi } from '../hooks/useProductsApi';
import { useOpportunitiesApi } from '../hooks/useOpportunitiesApi';

export const AccountDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isNew = id === 'new' || !id;
  
  // API hooks
  const { 
    accounts,
    fetchAccounts,
    getAccount, 
    createAccount, 
    updateAccount, 
    deleteAccount,
    loading: accountsLoading 
  } = useAccountsApi();
  
  const { 
    contacts,
    loadContacts, 
    createContact, 
    deleteContact,
    loading: contactsLoading 
  } = useContactsApi();
  
  const { 
    products,
    loadProducts,
    loading: productsLoading 
  } = useProductsApi();
  
  const { 
    opportunities,
    loadOpportunities,
    loading: opportunitiesLoading 
  } = useOpportunitiesApi();
  
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    position: '',
    phone: ''
  });
  
  const [formData, setFormData] = useState({
    name: '',
    region: '',
    website: '',
    parentAccountId: '',
    tags: [] as string[],
    notes: '',
    ownerId: currentUser?.uid || ''
  });

  useEffect(() => {
    // Set default owner for new accounts
    if (isNew && currentUser?.uid && !formData.ownerId) {
      setFormData(prev => ({ ...prev, ownerId: currentUser.uid }));
    }
  }, [isNew, currentUser?.uid, formData.ownerId]);

  // Load data when component mounts
  useEffect(() => {
    console.log('AccountDetails: Loading initial data...');
    
    const loadInitialData = async () => {
      try {
        await Promise.all([
          fetchAccounts(),
          loadContacts(),
          loadProducts(),
          loadOpportunities()
        ]);
        console.log('AccountDetails: Initial data loaded successfully');
      } catch (error) {
        console.error('AccountDetails: Error loading initial data:', error);
      }
    };

    loadInitialData();
  }, [fetchAccounts, loadContacts, loadProducts, loadOpportunities]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!isNew && id && id !== 'new') {
        const accountData = await getAccount(id);
        if (accountData) {
          setAccount(accountData);
          setFormData({
            name: accountData.name,
            region: accountData.region,
            website: accountData.website || '',
            parentAccountId: accountData.parentAccountId || '',
            tags: accountData.tags || [],
            notes: accountData.notes || '',
            ownerId: accountData.ownerId || currentUser?.uid || ''
          });
        }
      }
    } catch (error) {
      console.error('Error fetching account data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update loading state when all data is loaded
  useEffect(() => {
    if (!accountsLoading && !contactsLoading && !productsLoading && !opportunitiesLoading) {
      setLoading(false);
    }
  }, [accountsLoading, contactsLoading, productsLoading, opportunitiesLoading]);

  const relatedProducts = products.filter(p => p.accountId === id);
  const relatedContacts = contacts.filter(c => c.accountId === id);
  const relatedOpportunities = opportunities.filter(o => o.accountId === id);
  const parentAccount = accounts.find(a => a.id === formData.parentAccountId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // Clean data to remove undefined values
      const cleanData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value !== undefined && value !== '')
      );

      console.log('Saving account:', { isNew, id, formData: cleanData });

      if (isNew || !id) {
        const newAccount = await createAccount({
          name: cleanData.name,
          region: cleanData.region,
          website: cleanData.website,
          parentAccountId: cleanData.parentAccountId,
          tags: cleanData.tags,
          notes: cleanData.notes,
          ownerId: cleanData.ownerId
        });
        console.log('Account created:', newAccount);
        navigate('/accounts');
      } else {
        const updatedAccount = await updateAccount(id, cleanData);
        console.log('Account updated:', updatedAccount);
        setAccount(updatedAccount);
      }
    } catch (error) {
      console.error('Error saving account:', error);
      alert('Error saving account. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (account && id && confirm('Are you sure you want to delete this account?')) {
      try {
        await deleteAccount(id);
        navigate('/accounts');
      } catch (error) {
        console.error('Error deleting account:', error);
        alert('Error deleting account. Please try again.');
      }
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleCreateContact = async () => {
    if (newContact.name.trim() && newContact.email.trim() && formData.name.trim()) {
      try {
        const contactData = {
          ...newContact,
          accountId: id || '',
          contactType: 'Primary' as ContactType,
          productIds: [],
          ownerId: currentUser?.uid || ''
        };
        
        const newContactResponse = await createContact(contactData);
        
        // Reset form
        setNewContact({ name: '', email: '', position: '', phone: '' });
        setShowCreateContact(false);
      } catch (error) {
        console.error('Error creating contact:', error);
        alert('Error creating contact. Please try again.');
      }
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    if (confirm('Are you sure you want to remove this contact from the account?')) {
      try {
        // For accounts, we might want to delete the contact entirely or just unassign it
        // Since contacts belong to accounts, we'll delete the contact entirely
        await deleteContact(contactId);
      } catch (error) {
        console.error('Error removing contact:', error);
        alert('Error removing contact. Please try again.');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-b-2 rounded-full animate-spin border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-screen">
      {/* Compact Header */}
      <div className="px-6 py-3 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/accounts"
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {isNew ? 'New Account' : formData.name || 'Edit Account'}
              </h1>
              {parentAccount && (
                <p className="text-sm text-gray-500">Parent: {parentAccount.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isNew && (
              <button
                onClick={handleDelete}
                className="btn-danger-sm flex items-center gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 pb-20 overflow-auto">
        <div className="p-4 mx-auto max-w-7xl">
          <form id="account-form" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              
              {/* Left Column (2/3) - Core Information */}
              <div className="space-y-4 lg:col-span-2">
                
                {/* Basic Information */}
                <div className="p-4 bg-white rounded-lg shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="w-4 h-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Account Information</h2>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="block mb-1 text-xs font-medium text-gray-700">Account Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block mb-1 text-xs font-medium text-gray-700">Headoffice Country</label>
                      <input
                        type="text"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="e.g., United States, United Kingdom, Germany"
                        required
                      />
                    </div>

                    <div>
                      <label className="block mb-1 text-xs font-medium text-gray-700">Website</label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="https://..."
                      />
                    </div>

                    <div>
                      <label className="block mb-1 text-xs font-medium text-gray-700">Parent Account (Optional)</label>
                      <select
                        value={formData.parentAccountId}
                        onChange={(e) => setFormData({ ...formData, parentAccountId: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">No Parent Account</option>
                        {accounts
                          .filter(acc => acc.id !== id) // Don't allow self-reference
                          .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <OwnerSelect
                        value={formData.ownerId}
                        onChange={(ownerId) => setFormData({ ...formData, ownerId })}
                        label="Account Owner"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Products - Compact Version */}
                {relatedProducts.length > 0 && (
                  <div className="p-4 bg-white rounded-lg shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-500" />
                        <h2 className="text-base font-medium text-gray-900">Products ({relatedProducts.length})</h2>
                      </div>
                      <Link
                        to="/products"
                        className="text-xs text-primary-600 hover:text-primary-700"
                      >
                        View all
                      </Link>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {relatedProducts.slice(0, 4).map((product) => (
                        <div key={product.id} className="p-2 border border-gray-200 rounded-lg bg-gray-50">
                          <Link
                            to={`/products/${product.id}`}
                            className="block text-sm font-medium text-gray-900 truncate hover:text-primary-600"
                          >
                            {product.name}
                          </Link>
                          {product.description && (
                            <p className="mt-1 text-xs text-gray-500 line-clamp-1">{product.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {relatedProducts.length > 4 && (
                      <p className="mt-2 text-xs text-gray-500">
                        +{relatedProducts.length - 4} more products
                      </p>
                    )}
                  </div>
                )}

                {/* Opportunities */}
                {relatedOpportunities.length > 0 && (
                  <div className="p-4 bg-white rounded-lg shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-gray-500" />
                        <h2 className="text-base font-medium text-gray-900">Opportunities ({relatedOpportunities.length})</h2>
                      </div>
                      <Link
                        to="/opportunities"
                        className="text-xs text-primary-600 hover:text-primary-700"
                      >
                        View all
                      </Link>
                    </div>
                    <div className="space-y-2">
                      {relatedOpportunities.map((opportunity) => (
                        <div key={opportunity.id} className="p-3 border border-gray-200 rounded-lg bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <Link
                                to={`/opportunities/${opportunity.id}`}
                                className="block text-sm font-medium text-gray-900 hover:text-primary-600"
                              >
                                {opportunity.title}
                              </Link>
                              {opportunity.summary && (
                                <p className="mt-1 text-xs text-gray-500 line-clamp-2">{opportunity.summary}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  opportunity.stage === 'Closed-Won' ? 'bg-green-100 text-green-800' :
                                  opportunity.stage === 'Closed-Lost' ? 'bg-red-100 text-red-800' :
                                  opportunity.stage === 'Negotiation' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {opportunity.stage}
                                </span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  opportunity.priority === 'Critical' ? 'bg-red-100 text-red-800' :
                                  opportunity.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                                  opportunity.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {opportunity.priority}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Tags & Metadata */}
              <div className="space-y-4">
                
                {/* Tags */}
                <div className="p-4 bg-white rounded-lg shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <X className="w-4 h-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Tags</h2>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {formData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded-full"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1.5 text-blue-600 hover:text-blue-800"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                        className="flex-1 text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Add tag..."
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        className="px-2 py-1.5 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Contacts */}
                <div className="p-4 bg-white rounded-lg shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      <h2 className="text-base font-medium text-gray-900">
                        Contacts ({relatedContacts.length})
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCreateContact(!showCreateContact)}
                      className="px-2 py-1 text-xs font-medium border rounded-md text-primary-700 bg-primary-50 border-primary-200 hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50"
                    >
                      <Plus className="inline w-3 h-3 mr-1" />
                      Add
                    </button>
                  </div>

                  {/* Account contacts */}
                  {relatedContacts.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {relatedContacts.map((contact) => (
                        <div key={contact.id} className="relative p-2 border border-blue-200 rounded-lg bg-blue-50">
                          <button
                            type="button"
                            onClick={() => handleRemoveContact(contact.id || '')}
                            className="absolute text-blue-400 top-1 right-1 hover:text-red-600"
                            title="Remove contact"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <Link
                            to={`/contacts/${contact.id}`}
                            className="block pr-4 text-xs font-medium text-blue-900 truncate hover:text-blue-700"
                          >
                            {contact.name}
                          </Link>
                          {contact.position && (
                            <p className="text-xs text-blue-700 mt-0.5 truncate">{contact.position}</p>
                          )}
                          {contact.email && (
                            <p className="text-xs text-blue-600 mt-0.5 truncate">{contact.email}</p>
                          )}
                          {contact.phone && (
                            <p className="text-xs text-blue-600 mt-0.5 truncate">{contact.phone}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Create contact form (collapsible) */}
                  {showCreateContact && (
                    <div className="p-3 mb-3 border border-gray-200 rounded-lg bg-gray-50">
                      <h3 className="mb-2 text-sm font-medium text-gray-900">Create New Contact</h3>
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Contact name..."
                          value={newContact.name}
                          onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                          className="w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <input
                          type="email"
                          placeholder="Email address..."
                          value={newContact.email}
                          onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                          className="w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Position..."
                            value={newContact.position}
                            onChange={(e) => setNewContact({ ...newContact, position: e.target.value })}
                            className="w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <input
                            type="tel"
                            placeholder="Phone..."
                            value={newContact.phone}
                            onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                            className="w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowCreateContact(false)}
                            className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleCreateContact}
                            disabled={!newContact.name.trim() || !newContact.email.trim() || isNew}
                            className="px-2 py-1 text-xs font-medium border rounded-md text-primary-700 bg-primary-50 border-primary-200 hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Create
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {relatedContacts.length === 0 && (
                    <div className="py-4 text-center">
                      <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm text-gray-500">No contacts yet</p>
                      <p className="text-xs text-gray-400">
                        {isNew ? 'Save the account first to add contacts' : 'Add contacts to this account'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Quick Stats */}
                {!isNew && (
                  <div className="p-4 bg-white rounded-lg shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <h2 className="text-base font-medium text-gray-900">Details</h2>
                    </div>
                    <div className="space-y-2 text-sm">
                      {account?.createdAt && (
                        <div>
                          <span className="text-gray-500">Created:</span>
                          <p className="text-gray-900">{(() => {
                            try {
                              const timestamp = account.createdAt;
                              let date: Date;
                              
                              if ((timestamp as any)?.seconds) {
                                // Firestore Timestamp format
                                date = new Date((timestamp as any).seconds * 1000);
                              } else if (timestamp) {
                                // Regular date string or Date object
                                date = new Date(timestamp);
                              } else {
                                return 'N/A';
                              }
                              
                              // Validate the date
                              if (isNaN(date.getTime())) {
                                return 'Invalid Date';
                              }
                              
                              return format(date, 'MMM d, yyyy');
                            } catch (error) {
                              console.error('Date formatting error:', error, account.createdAt);
                              return 'N/A';
                            }
                          })()}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Products:</span>
                        <p className="text-gray-900">{relatedProducts.length} products</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Contacts:</span>
                        <p className="text-gray-900">{relatedContacts.length} contacts</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Opportunities:</span>
                        <p className="text-gray-900">{relatedOpportunities.length} opportunities</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>


          </form>
        </div>
      </div>

      {/* Floating Save Button */}
      <button
        type="submit"
        form="account-form"
        disabled={saving || !formData.name.trim()}
        className="fixed z-50 p-3 text-white transition-all duration-200 rounded-full shadow-lg bottom-4 right-4 bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
        title={saving ? 'Saving...' : 'Save Account'}
      >
        {saving ? (
          <div className="w-5 h-5 border-b-2 border-white rounded-full animate-spin"></div>
        ) : (
          <Save className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}; 