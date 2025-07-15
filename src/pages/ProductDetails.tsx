import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Trash2,
  Package,
  Building2,
  Users,
  Tag,
  Plus,
  X,
  Globe,
  Network,
  Mail,
  Phone,
  Calendar
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { Product, Account, Contact } from '../types';
import { getDocument, getDocuments, createDocument, updateDocument, deleteDocument, updateProductWithSync, deleteProductWithSync } from '../lib/firestore';
import { format } from 'date-fns';

const BUSINESS_TYPES = [
  { value: 'PMS', label: 'PMS: Property Management System' },
  { value: 'GDS', label: 'GDS: Global Distribution System' },
  { value: 'CRS', label: 'CRS: Central Reservation System' },
  { value: 'CM', label: 'CM: Channel Manager' },
  { value: 'PAY', label: 'PAY: Payment Solutions' },
  { value: 'BE', label: 'BE: Booking Engine' },
  { value: 'RMS', label: 'RMS: Revenue Management System' }
];

export const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new' || !id;
  
  const [product, setProduct] = useState<Product | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTag, setNewTag] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    accountId: '',
    description: '',
    tags: [] as string[],
    businessType: '',
    website: '',
    numberOfIntegrations: 0,
    numberOfHotelsConnected: 0,
    contactIds: [] as string[]
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accountsData, contactsData] = await Promise.all([
        getDocuments('accounts'),
        getDocuments('contacts')
      ]);
      setAccounts(accountsData as Account[]);
      setContacts(contactsData as Contact[]);

      if (!isNew && id && id !== 'new') {
        const productData = await getDocument('products', id);
        if (productData) {
          const productTyped = productData as Product & {
            businessType?: string;
            website?: string;
            numberOfIntegrations?: number;
            numberOfHotelsConnected?: number;
          };
          setProduct(productTyped);
          setFormData({
            name: productTyped.name,
            accountId: productTyped.accountId,
            description: productTyped.description || '',
            tags: productTyped.tags || [],
            businessType: productTyped.businessType || '',
            website: productTyped.website || '',
            numberOfIntegrations: productTyped.numberOfIntegrations || 0,
            numberOfHotelsConnected: productTyped.numberOfHotelsConnected || 0,
            contactIds: productTyped.contactIds || []
          });

          // Get account details
          if (productTyped.accountId) {
            const accountData = await getDocument('accounts', productTyped.accountId);
            setAccount(accountData as Account);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getContactName = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    return contact?.name || 'Unknown';
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.name || 'Unknown';
  };

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
        createdAt: isNew ? Timestamp.now() : product?.createdAt,
        updatedAt: Timestamp.now()
      };

      console.log('Saving product:', { isNew, id, submitData });

      if (isNew || !id) {
        const docId = await createDocument('products', submitData);
        console.log('Product created with ID:', docId);
        
        // For new products, sync the contact relationships
        if (submitData.contactIds && submitData.contactIds.length > 0) {
          const newDocRef = await getDocument('products', docId.id);
          if (newDocRef) {
            await updateProductWithSync(docId.id, { contactIds: submitData.contactIds }, []);
          }
        }
        
        navigate('/products');
      } else {
        // For existing products, use synchronized update
        const previousContactIds = product?.contactIds || [];
        await updateProductWithSync(id, submitData, previousContactIds);
        console.log('Product updated successfully with synced relationships');
        await fetchData();
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error saving product. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (product && id && confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProductWithSync(id);
        navigate('/products');
      } catch (error) {
        console.error('Error deleting product:', error);
      }
    }
  };

  const handleContactToggle = (contactId: string) => {
    const newContactIds = formData.contactIds.includes(contactId)
      ? formData.contactIds.filter(id => id !== contactId)
      : [...formData.contactIds, contactId];
    
    setFormData({ ...formData, contactIds: newContactIds });
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

  // Filter contacts for the selected account
  const availableContacts = contacts.filter(c => 
    !formData.accountId || c.accountId === formData.accountId
  );

  // Get directly associated contacts and account contacts
  const directContacts = contacts.filter(c => formData.contactIds.includes(c.id || ''));
  const accountContacts = contacts.filter(c => 
    formData.accountId && c.accountId === formData.accountId && !formData.contactIds.includes(c.id || '')
  );
  const allRelatedContacts = [...directContacts, ...accountContacts];

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
              to="/products"
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {isNew ? 'New Product' : formData.name || 'Edit Product'}
              </h1>
              {!isNew && account && (
                <p className="text-sm text-gray-500">{account.name}</p>
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
          <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
            
            {/* Main Information Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* Left Column - Core Product Info */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Basic Info */}
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="h-4 w-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Product Information</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Product Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Account</label>
                      <select
                        value={formData.accountId}
                        onChange={(e) => setFormData({ ...formData, accountId: e.target.value, contactIds: [] })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select Account</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Business Type</label>
                      <select
                        value={formData.businessType}
                        onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">Select Type</option>
                        {BUSINESS_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.value} - {type.label.split(': ')[1]}
                          </option>
                        ))}
                      </select>
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
                      <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={2}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Brief product description..."
                      />
                    </div>
                  </div>
                </div>

                {/* Connectivity Stats */}
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Network className="h-4 w-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Connectivity & Integrations</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Integrations</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.numberOfIntegrations}
                        onChange={(e) => setFormData({ ...formData, numberOfIntegrations: parseInt(e.target.value) || 0 })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Hotels Connected</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.numberOfHotelsConnected}
                        onChange={(e) => setFormData({ ...formData, numberOfHotelsConnected: parseInt(e.target.value) || 0 })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                    <Tag className="h-4 w-4 text-gray-500" />
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
                      {product?.createdAt && (
                        <div>
                          <span className="text-gray-500">Created:</span>
                          <p className="text-gray-900">{format(product.createdAt.toDate(), 'MMM d, yyyy')}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Contacts:</span>
                        <p className="text-gray-900">{allRelatedContacts.length} associated</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Contacts Section - Full Width */}
            <div className="bg-white shadow rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  <h2 className="text-base font-medium text-gray-900">
                    Related Contacts ({allRelatedContacts.length})
                  </h2>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-600">Direct Contact</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span className="text-gray-600">Account Contact</span>
                  </div>
                </div>
              </div>
              
              {/* Contact Selection - Hidden but maintained for form functionality */}
              <div className="hidden">
                {availableContacts.map((contact) => (
                  <input
                    key={contact.id}
                    type="checkbox"
                    checked={formData.contactIds.includes(contact.id)}
                    onChange={() => handleContactToggle(contact.id)}
                  />
                ))}
              </div>

              {/* All Related Contacts Display */}
              {allRelatedContacts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {allRelatedContacts.map((contact) => {
                    const isDirect = formData.contactIds.includes(contact.id || '');
                    return (
                      <div 
                        key={contact.id} 
                        className={`rounded-lg p-3 border relative ${
                          isDirect 
                            ? 'bg-blue-50 border-blue-200' 
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        {/* Contact Type Indicator */}
                        <div className="absolute top-2 right-2">
                          <div 
                            className={`w-2 h-2 rounded-full ${
                              isDirect ? 'bg-blue-500' : 'bg-gray-400'
                            }`}
                            title={isDirect ? 'Direct Product Contact' : 'Account Contact'}
                          ></div>
                        </div>
                        
                        {/* Toggle Direct Association Button */}
                        <button
                          type="button"
                          onClick={() => handleContactToggle(contact.id)}
                          className={`absolute top-1 left-1 w-4 h-4 rounded-full border text-xs font-bold transition-all ${
                            isDirect
                              ? 'bg-blue-500 border-blue-600 text-white hover:bg-blue-600'
                              : 'bg-white border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500'
                          }`}
                          title={isDirect ? 'Remove from product' : 'Add to product'}
                        >
                          {isDirect ? '−' : '+'}
                        </button>

                        <div className="pt-2">
                          <Link
                            to={`/contacts/${contact.id}`}
                            className={`text-sm font-medium hover:text-primary-600 block truncate ${
                              isDirect ? 'text-blue-900' : 'text-gray-900'
                            }`}
                          >
                            {contact.name}
                          </Link>
                          {contact.position && (
                            <p className={`text-xs mt-0.5 truncate ${
                              isDirect ? 'text-blue-700' : 'text-gray-500'
                            }`}>
                              {contact.position}
                            </p>
                          )}
                          <div className="mt-1.5 space-y-0.5">
                            {contact.email && (
                              <div className={`flex items-center text-xs ${
                                isDirect ? 'text-blue-600' : 'text-gray-600'
                              }`}>
                                <Mail className="h-3 w-3 mr-1 flex-shrink-0" />
                                <a 
                                  href={`mailto:${contact.email}`} 
                                  className="hover:text-primary-600 truncate"
                                >
                                  {contact.email}
                                </a>
                              </div>
                            )}
                            {contact.phone && (
                              <div className={`flex items-center text-xs ${
                                isDirect ? 'text-blue-600' : 'text-gray-600'
                              }`}>
                                <Phone className="h-3 w-3 mr-1 flex-shrink-0" />
                                <a 
                                  href={`tel:${contact.phone}`} 
                                  className="hover:text-primary-600"
                                >
                                  {contact.phone}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">
                    {formData.accountId 
                      ? 'No contacts found for this account' 
                      : 'Select an account to see related contacts'
                    }
                  </p>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Floating Save Button */}
      <button
        type="submit"
        form="product-form"
        disabled={saving || !formData.name.trim() || !formData.accountId}
        className="fixed bottom-4 right-4 bg-primary-600 text-white p-3 rounded-full shadow-lg hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-500 focus:ring-opacity-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed z-50"
        title={saving ? 'Saving...' : 'Save Product'}
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