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
import { Timestamp } from 'firebase/firestore';
import type { Account, Product, Contact, ContactType, Opportunity } from '../types';
import { getDocument, getDocuments, createDocument, updateDocument, deleteDocument } from '../lib/firestore';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { OwnerSelect } from '../components/OwnerSelect';

const INDUSTRIES = [
  { value: 'PMS', label: 'PMS: Property Management System' },
  { value: 'GDS', label: 'GDS: Global Distribution System' },
  { value: 'CRS', label: 'CRS: Central Reservation System' },
  { value: 'CM', label: 'CM: Channel Manager' },
  { value: 'PAY', label: 'PAY: Payment Solutions' },
  { value: 'BE', label: 'BE: Booking Engine' },
  { value: 'RMS', label: 'RMS: Revenue Management System' }
];

export const AccountDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isNew = id === 'new' || !id;
  
  const [account, setAccount] = useState<Account | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
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
    industry: 'PMS' as Account['industry'],
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

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsData, contactsData, opportunitiesData, accountsData] = await Promise.all([
        getDocuments('products'),
        getDocuments('contacts'),
        getDocuments('opportunities'),
        getDocuments('accounts')
      ]);
      setProducts(productsData as Product[]);
      setContacts(contactsData as Contact[]);
      setOpportunities(opportunitiesData as Opportunity[]);
      setAccounts(accountsData as Account[]);

      if (!isNew && id && id !== 'new') {
        const accountData = await getDocument('accounts', id);
        if (accountData) {
          const accountTyped = accountData as Account;
          setAccount(accountTyped);
          setFormData({
            name: accountTyped.name,
            industry: accountTyped.industry,
            region: accountTyped.region,
            website: accountTyped.website || '',
            parentAccountId: accountTyped.parentAccountId || '',
            tags: accountTyped.tags || [],
            notes: accountTyped.notes || '',
            ownerId: accountTyped.ownerId || currentUser?.uid || ''
          });
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

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

      const submitData = {
        ...cleanData,
        createdAt: isNew ? Timestamp.now() : account?.createdAt,
        updatedAt: Timestamp.now()
      };

      console.log('Saving account:', { isNew, id, submitData });

      if (isNew || !id) {
        const docId = await createDocument('accounts', submitData);
        console.log('Account created with ID:', docId);
        navigate('/accounts');
      } else {
        await updateDocument('accounts', id, submitData);
        console.log('Account updated successfully');
        await fetchData();
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
        await deleteDocument('accounts', id);
        navigate('/accounts');
      } catch (error) {
        console.error('Error deleting account:', error);
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
          ownerId: currentUser?.uid || '',
          createdAt: Timestamp.now()
        };
        
        const docRef = await createDocument('contacts', contactData);
        
        // Refresh data to show new contact
        await fetchData();
        
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
        await deleteDocument('contacts', contactId);
        await fetchData(); // Refresh data
      } catch (error) {
        console.error('Error removing contact:', error);
        alert('Error removing contact. Please try again.');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Compact Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/accounts"
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
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
      <div className="flex-1 overflow-auto pb-20">
        <div className="max-w-7xl mx-auto p-4">
          <form id="account-form" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* Left Column (2/3) - Core Information */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Basic Information */}
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Account Information</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Account Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Industry</label>
                      <select
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value as Account['industry'] })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      >
                        {INDUSTRIES.map((industry) => (
                          <option key={industry.value} value={industry.value}>
                            {industry.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Region</label>
                      <input
                        type="text"
                        value={formData.region}
                        onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="e.g., North America, EMEA, APAC"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Website</label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="https://..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Parent Account (Optional)</label>
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
                  <div className="bg-white shadow rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-gray-500" />
                        <h2 className="text-base font-medium text-gray-900">Products ({relatedProducts.length})</h2>
                      </div>
                      <Link
                        to="/products"
                        className="text-xs text-primary-600 hover:text-primary-700"
                      >
                        View all
                      </Link>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {relatedProducts.slice(0, 4).map((product) => (
                        <div key={product.id} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                          <Link
                            to={`/products/${product.id}`}
                            className="text-sm font-medium text-gray-900 hover:text-primary-600 block truncate"
                          >
                            {product.name}
                          </Link>
                          {product.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{product.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {relatedProducts.length > 4 && (
                      <p className="text-xs text-gray-500 mt-2">
                        +{relatedProducts.length - 4} more products
                      </p>
                    )}
                  </div>
                )}

                {/* Opportunities */}
                {relatedOpportunities.length > 0 && (
                  <div className="bg-white shadow rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-gray-500" />
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
                        <div key={opportunity.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <Link
                                to={`/opportunities/${opportunity.id}`}
                                className="text-sm font-medium text-gray-900 hover:text-primary-600 block"
                              >
                                {opportunity.title}
                              </Link>
                              {opportunity.summary && (
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{opportunity.summary}</p>
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
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <X className="h-4 w-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Tags</h2>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {formData.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1.5 text-blue-600 hover:text-blue-800"
                          >
                            <X className="h-3 w-3" />
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
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <h2 className="text-base font-medium text-gray-900">
                        Contacts ({relatedContacts.length})
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCreateContact(!showCreateContact)}
                      className="px-2 py-1 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-md hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50"
                    >
                      <Plus className="h-3 w-3 mr-1 inline" />
                      Add
                    </button>
                  </div>

                  {/* Account contacts */}
                  {relatedContacts.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {relatedContacts.map((contact) => (
                        <div key={contact.id} className="bg-blue-50 border-blue-200 rounded-lg p-2 border relative">
                          <button
                            type="button"
                            onClick={() => handleRemoveContact(contact.id || '')}
                            className="absolute top-1 right-1 text-blue-400 hover:text-red-600"
                            title="Remove contact"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          <Link
                            to={`/contacts/${contact.id}`}
                            className="text-xs font-medium text-blue-900 hover:text-blue-700 block truncate pr-4"
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
                    <div className="border border-gray-200 rounded-lg p-3 mb-3 bg-gray-50">
                      <h3 className="text-sm font-medium text-gray-900 mb-2">Create New Contact</h3>
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
                            className="px-2 py-1 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-md hover:bg-primary-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Create
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {relatedContacts.length === 0 && (
                    <div className="text-center py-4">
                      <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No contacts yet</p>
                      <p className="text-xs text-gray-400">
                        {isNew ? 'Save the account first to add contacts' : 'Add contacts to this account'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Quick Stats */}
                {!isNew && (
                  <div className="bg-white shadow rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <h2 className="text-base font-medium text-gray-900">Details</h2>
                    </div>
                    <div className="space-y-2 text-sm">
                      {account?.createdAt && (
                        <div>
                          <span className="text-gray-500">Created:</span>
                          <p className="text-gray-900">{format(account.createdAt.toDate(), 'MMM d, yyyy')}</p>
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
        className="fixed bottom-4 right-4 bg-primary-600 text-white p-3 rounded-full shadow-lg hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-500 focus:ring-opacity-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed z-50"
        title={saving ? 'Saving...' : 'Save Account'}
      >
        {saving ? (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
        ) : (
          <Save className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}; 