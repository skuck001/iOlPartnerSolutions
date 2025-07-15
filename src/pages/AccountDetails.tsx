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
import type { Account, Product, Contact } from '../types';
import { getDocument, getDocuments, createDocument, updateDocument, deleteDocument } from '../lib/firestore';
import { format } from 'date-fns';

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
  const isNew = id === 'new' || !id;
  
  const [account, setAccount] = useState<Account | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTag, setNewTag] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    industry: 'PMS' as Account['industry'],
    region: '',
    website: '',
    parentAccountId: '',
    tags: [] as string[],
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [productsData, contactsData, accountsData] = await Promise.all([
        getDocuments('products'),
        getDocuments('contacts'),
        getDocuments('accounts')
      ]);
      setProducts(productsData as Product[]);
      setContacts(contactsData as Contact[]);
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
            notes: accountTyped.notes || ''
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
              {!isNew && parentAccount && (
                <p className="text-sm text-gray-500">{parentAccount.name}</p>
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

      {/* Content - Compact Layout */}
      <div className="flex-1 overflow-auto pb-20">
        <div className="max-w-6xl mx-auto p-4">
          <form id="account-form" onSubmit={handleSubmit} className="space-y-4">
            
            {/* Main Information Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* Left Column - Core Account Info */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Basic Info */}
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
                      >
                        {INDUSTRIES.map((industry) => (
                          <option key={industry.value} value={industry.value}>
                            {industry.value} - {industry.label.split(': ')[1]}
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
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Website</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                          <Globe className="h-3.5 w-3.5 text-gray-400" />
                        </div>
                        <input
                          type="url"
                          value={formData.website}
                          onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                          className="w-full text-sm pl-8 border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="https://example.com"
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Parent Account</label>
                      <select
                        value={formData.parentAccountId}
                        onChange={(e) => setFormData({ ...formData, parentAccountId: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">No Parent Account</option>
                        {accounts.filter(a => a.id !== id).map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={2}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Additional notes..."
                      />
                    </div>
                  </div>
                </div>
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
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Related Entities Section - Full Width */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Products */}
              {relatedProducts.length > 0 && (
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="h-4 w-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Products ({relatedProducts.length})</h2>
                  </div>
                  <div className="space-y-2">
                    {relatedProducts.map((product) => (
                      <div key={product.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <Link
                          to={`/products/${product.id}`}
                          className="text-sm font-medium text-gray-900 hover:text-primary-600 block"
                        >
                          {product.name}
                        </Link>
                        {product.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contacts */}
              {relatedContacts.length > 0 && (
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Contacts ({relatedContacts.length})</h2>
                  </div>
                  <div className="space-y-2">
                    {relatedContacts.map((contact) => (
                      <div key={contact.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <Link
                          to={`/contacts/${contact.id}`}
                          className="text-sm font-medium text-gray-900 hover:text-primary-600 block"
                        >
                          {contact.name}
                        </Link>
                        {contact.position && (
                          <p className="text-xs text-gray-500 mt-1">{contact.position}</p>
                        )}
                        {contact.email && (
                          <p className="text-xs text-gray-500">{contact.email}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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