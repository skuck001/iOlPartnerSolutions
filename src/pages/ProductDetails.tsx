import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Trash2,
  Package,
  Building2,
  Users,
  Plus,
  X,
  Calendar,
  Target,
  CheckCircle2,
  Globe,
  Tag,
  Network,
  Briefcase
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { Product, Account, Contact, ContactType, Opportunity } from '../types';
import { getDocument, getDocuments, createDocument, updateDocument, deleteDocument, updateProductWithSync, deleteProductWithSync } from '../lib/firestore';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { OwnerSelect } from '../components/OwnerSelect';

const PRODUCT_CATEGORIES = [
  'Business Intelligence',
  'Revenue Management', 
  'Distribution',
  'Guest Experience',
  'Operations',
  'Connectivity',
  'Booking Engine',
  'Channel Management',
  'Other'
];

const PRODUCT_SUBCATEGORIES = [
  'Rate Shopping Tools',
  'Competitive Intelligence',
  'Market Analytics',
  'Demand Forecasting',
  'Pricing Optimization',
  'Reservation Systems',
  'Property Management',
  'Guest Communication',
  'Loyalty Programs',
  'API Integration',
  'Data Connectivity',
  'Other'
];

export const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isNew = id === 'new' || !id;
  
  const [product, setProduct] = useState<Product | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [showSuggestedContacts, setShowSuggestedContacts] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    position: '',
    phone: ''
  });
  
  const [formData, setFormData] = useState({
    name: '',
    accountId: '',
    category: 'Business Intelligence' as Product['category'],
    subcategory: 'Rate Shopping Tools' as Product['subcategory'],
    description: '',
    version: '',
    status: 'Active' as Product['status'],
    website: '',
    contactIds: [] as string[],
    tags: [] as string[],
    targetMarket: '',
    pricing: '',
    notes: '',
    ownerId: currentUser?.uid || ''
  });

  useEffect(() => {
    // Set default owner for new products
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
      const [accountsData, contactsData, opportunitiesData] = await Promise.all([
        getDocuments('accounts'),
        getDocuments('contacts'),
        getDocuments('opportunities')
      ]);
      setAccounts(accountsData as Account[]);
      setContacts(contactsData as Contact[]);
      setOpportunities(opportunitiesData as Opportunity[]);

      if (!isNew && id && id !== 'new') {
        const productData = await getDocument('products', id);
        if (productData) {
          const productTyped = productData as Product;
          setProduct(productTyped);
          setFormData({
            name: productTyped.name,
            accountId: productTyped.accountId,
            category: productTyped.category,
            subcategory: productTyped.subcategory,
            description: productTyped.description || '',
            version: productTyped.version || '',
            status: productTyped.status,
            website: productTyped.website || '',
            contactIds: productTyped.contactIds || [],
            tags: productTyped.tags || [],
            targetMarket: productTyped.targetMarket || '',
            pricing: productTyped.pricing || '',
            notes: productTyped.notes || '',
            ownerId: productTyped.ownerId || currentUser?.uid || ''
          });
          
          // Find the account
          const relatedAccount = accountsData.find((acc: any) => acc.id === productTyped.accountId);
          if (relatedAccount) {
            setAccount(relatedAccount as Account);
          }
        }
      }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // Clean data to remove undefined values
      const cleanData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value !== undefined && value !== '')
      );

      const submitData: any = {
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

  const handleCreateContact = async () => {
    if (newContact.name.trim() && newContact.email.trim()) {
      try {
        const contactData = {
          ...newContact,
          accountId: formData.accountId,
          contactType: 'Primary' as ContactType,
          productIds: [],
          ownerId: currentUser?.uid || '',
          createdAt: Timestamp.now()
        };
        
        const docRef = await createDocument('contacts', contactData);
        
        // Refresh contacts and add to product
        await fetchData();
        handleContactToggle(docRef.id);
        
        // Reset form
        setNewContact({ name: '', email: '', position: '', phone: '' });
        setShowCreateContact(false);
      } catch (error) {
        console.error('Error creating contact:', error);
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
  
  // Get opportunities specifically assigned to this product
  const relatedOpportunities = opportunities.filter(o => o.productId === id);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative">
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

      {/* Content */}
      <div className="flex-1 overflow-auto pb-20">
        <div className="max-w-7xl mx-auto p-4">
          <form id="product-form" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* Left Column (2/3) - Core Information */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Product Information */}
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
                      <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value as Product['category'] })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      >
                        {PRODUCT_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Subcategory</label>
                      <select
                        value={formData.subcategory}
                        onChange={(e) => setFormData({ ...formData, subcategory: e.target.value as Product['subcategory'] })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      >
                        {PRODUCT_SUBCATEGORIES.map((subcategory) => (
                          <option key={subcategory} value={subcategory}>
                            {subcategory}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Version</label>
                      <input
                        type="text"
                        value={formData.version}
                        onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="e.g., v2.1.0"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as Product['status'] })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      >
                        <option value="Active">Active</option>
                        <option value="Deprecated">Deprecated</option>
                        <option value="Development">Development</option>
                        <option value="Beta">Beta</option>
                      </select>
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
                      <OwnerSelect
                        value={formData.ownerId}
                        onChange={(ownerId) => setFormData({ ...formData, ownerId })}
                        label="Product Owner"
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={3}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Brief description of the product..."
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

                  </div>
                </div>

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

                {/* Contacts */}
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <h2 className="text-base font-medium text-gray-900">
                        Contacts ({directContacts.length})
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

                  {/* Assigned contacts */}
                  {directContacts.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {directContacts.map((contact) => (
                        <div key={contact.id} className="bg-blue-50 border-blue-200 rounded-lg p-2 border relative">
                          <button
                            type="button"
                            onClick={() => handleContactToggle(contact.id || '')}
                            className="absolute top-1 right-1 text-blue-400 hover:text-blue-600"
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
                            className="px-2 py-1 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-md hover:bg-primary-100"
                          >
                            Create
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Show suggestions button and suggested contacts */}
                  {accountContacts.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowSuggestedContacts(!showSuggestedContacts)}
                        className="w-full text-xs text-gray-600 hover:text-gray-800 py-2 border-t border-gray-200 transition-colors"
                      >
                        {showSuggestedContacts ? 'Hide' : 'Show'} suggestions ({accountContacts.length})
                      </button>
                      
                      {showSuggestedContacts && (
                        <div className="mt-2 space-y-1">
                          {accountContacts.map((contact) => (
                            <div 
                              key={contact.id} 
                              className="bg-gray-50 border-gray-200 rounded-lg p-2 border relative"
                            >
                              <button
                                type="button"
                                onClick={() => handleContactToggle(contact.id || '')}
                                className="absolute top-1 right-1 text-gray-400 hover:text-gray-600"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                              <Link
                                to={`/contacts/${contact.id}`}
                                className="text-xs font-medium text-gray-900 hover:text-primary-600 block truncate pr-4"
                              >
                                {contact.name}
                              </Link>
                              <p className="text-xs text-gray-600 mt-0.5">
                                From Account • {contact.position || 'No title'}
                              </p>
                              {contact.email && (
                                <p className="text-xs text-gray-500 mt-0.5 truncate">{contact.email}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Empty state */}
                  {accountContacts.length === 0 && directContacts.length === 0 && (
                    <p className="text-xs text-gray-500 italic">
                      {formData.accountId 
                        ? 'No contacts found for this account' 
                        : 'Select an account to see related contacts'
                      }
                    </p>
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
                      <div>
                        <span className="text-gray-500">Opportunities:</span>
                        <p className="text-gray-900">{relatedOpportunities.length} related</p>
                      </div>
                    </div>
                  </div>
                )}
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