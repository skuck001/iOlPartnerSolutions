import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Trash2,
  Mail,
  Phone,
  User,
  Building2,
  Briefcase,
  Clock,
  Calendar,
  Package,
  Globe,
  Activity,
  MessageSquare,
  Video,
  Users,
  ExternalLink,
  Plus,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import type { Contact, Account, Product, ContactType, Opportunity, Activity as ActivityType, ActivityStatus } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { OwnerSelect } from '../components/OwnerSelect';
import { useContactsApi } from '../hooks/useContactsApi';
import { useAccountsApi } from '../hooks/useAccountsApi';
import { useProductsApi } from '../hooks/useProductsApi';
import { useOpportunitiesApi } from '../hooks/useOpportunitiesApi';

const contactTypes: ContactType[] = [
  'Primary',
  'Secondary', 
  'Technical',
  'Billing',
  'Decision Maker',
  'Other'
];

const CONTACT_METHODS = ['Email', 'Phone', 'LinkedIn', 'Teams'] as const;

export const ContactDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isNew = id === 'new' || !id;
  
  // API hooks
  const { 
    getContact, 
    createContact, 
    updateContact, 
    deleteContact,
    loading: contactsLoading 
  } = useContactsApi();
  
  const { 
    accounts,
    fetchAccounts,
    loading: accountsLoading 
  } = useAccountsApi();
  
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
  
  const [contact, setContact] = useState<Contact | null>(null);
  const [contactActivities, setContactActivities] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Contact>>({
    name: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    contactType: 'Primary',
    accountId: '',
    productIds: [],
    linkedIn: '',
    timezone: '',
    preferredContactMethod: 'Email',
    isDecisionMaker: false,
    notes: '',
    ownerId: currentUser?.uid || ''
  });

  useEffect(() => {
    // Set default owner for new contacts
    if (isNew && currentUser?.uid && !formData.ownerId) {
      setFormData(prev => ({ ...prev, ownerId: currentUser.uid }));
    }
  }, [isNew, currentUser?.uid, formData.ownerId]);

  // Load data when component mounts
  useEffect(() => {
    console.log('ContactDetails: Loading initial data...');
    
    const loadInitialData = async () => {
      try {
        await Promise.all([
          fetchAccounts(),
          loadProducts(),
          loadOpportunities()
        ]);
        console.log('ContactDetails: Initial data loaded successfully');
      } catch (error) {
        console.error('ContactDetails: Error loading initial data:', error);
      }
    };

    loadInitialData();
  }, [fetchAccounts, loadProducts, loadOpportunities]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!isNew && id && id !== 'new') {
        const contactData = await getContact(id);
        if (contactData) {
          setContact(contactData);
          setFormData({
            name: contactData.name,
            email: contactData.email,
            phone: contactData.phone || '',
            position: contactData.position || '',
            department: contactData.department || '',
            contactType: contactData.contactType,
            accountId: contactData.accountId,
            productIds: contactData.productIds || [],
            linkedIn: contactData.linkedIn || '',
            timezone: contactData.timezone || '',
            preferredContactMethod: contactData.preferredContactMethod || 'Email',
            isDecisionMaker: contactData.isDecisionMaker || false,
            notes: contactData.notes || '',
            ownerId: contactData.ownerId || currentUser?.uid || ''
          });
        }
      }
    } catch (error) {
      console.error('Error fetching contact data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Update loading state when all data is loaded
  useEffect(() => {
    if (!contactsLoading && !accountsLoading && !productsLoading && !opportunitiesLoading) {
      setLoading(false);
    }
  }, [contactsLoading, accountsLoading, productsLoading, opportunitiesLoading]);

  // Extract activities related to this contact from opportunities
  useEffect(() => {
    if (!isNew && id && opportunities.length > 0) {
      const relatedActivities = extractContactActivities(opportunities, id);
      setContactActivities(relatedActivities);
    }
  }, [opportunities, id, isNew]);

  // Helper function to extract activities related to a specific contact
  const extractContactActivities = (opportunities: Opportunity[], contactId: string): ActivityType[] => {
    const activities: ActivityType[] = [];
    
    opportunities.forEach(opportunity => {
      if (opportunity.activities) {
        opportunity.activities.forEach(activity => {
          if (activity.relatedContactIds.includes(contactId)) {
            activities.push({
              ...activity,
              opportunityTitle: opportunity.title,
              opportunityId: opportunity.id
            } as any);
          }
        });
      }
    });
    
    // Sort activities by date (newest first)
    return activities.sort((a, b) => {
      try {
        const timeA = (a.dateTime as any)?.toMillis ? (a.dateTime as any).toMillis() : new Date(a.dateTime).getTime();
        const timeB = (b.dateTime as any)?.toMillis ? (b.dateTime as any).toMillis() : new Date(b.dateTime).getTime();
        return timeB - timeA;
      } catch (error) {
        console.error('Date sorting error:', error);
        return 0;
      }
    });
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.name || 'Unknown';
  };

  const selectedAccount = accounts.find(a => a.id === formData.accountId);
  const availableProducts = products.filter(p => p.accountId === formData.accountId);
  const selectedProducts = products.filter(p => formData.productIds?.includes(p.id || ''));

  // Helper function to get activity type icon
  const getActivityIcon = (activityType: string) => {
    const iconMap = {
      'Meeting': Video,
      'Email': Mail,
      'Call': Phone,
      'WhatsApp': MessageSquare,
      'Demo': Video,
      'Workshop': Users
    };
    return iconMap[activityType as keyof typeof iconMap] || Activity;
  };

  // Helper function to get status color
  const getStatusColor = (status: ActivityStatus) => {
    const colors = {
      'Scheduled': 'bg-blue-100 text-blue-800 border-blue-200',
      'Completed': 'bg-green-100 text-green-800 border-green-200',
      'Cancelled': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // Clean data to remove undefined values
      const cleanData = Object.fromEntries(
        Object.entries(formData).filter(([_, value]) => value !== undefined && value !== '')
      );

      console.log('Saving contact:', { isNew, id, formData: cleanData });

      if (isNew || !id) {
        const newContact = await createContact({
          name: cleanData.name as string,
          email: cleanData.email as string,
          phone: cleanData.phone,
          position: cleanData.position,
          department: cleanData.department,
          contactType: cleanData.contactType as ContactType,
          accountId: cleanData.accountId as string,
          productIds: cleanData.productIds || [],
          linkedIn: cleanData.linkedIn,
          timezone: cleanData.timezone,
          preferredContactMethod: cleanData.preferredContactMethod as any,
          isDecisionMaker: cleanData.isDecisionMaker,
          notes: cleanData.notes,
          ownerId: cleanData.ownerId as string
        });
        console.log('Contact created:', newContact);
        navigate('/contacts');
      } else {
        const updatedContact = await updateContact(id, cleanData);
        console.log('Contact updated:', updatedContact);
        setContact(updatedContact);
      }
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Error saving contact. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (contact && id && confirm('Are you sure you want to delete this contact?')) {
      try {
        await deleteContact(id);
        navigate('/contacts');
      } catch (error) {
        console.error('Error deleting contact:', error);
        alert('Error deleting contact. Please try again.');
      }
    }
  };

  const handleProductToggle = (productId: string) => {
    const newProductIds = formData.productIds?.includes(productId)
      ? formData.productIds.filter(id => id !== productId)
      : [...(formData.productIds || []), productId];
    
    setFormData({ ...formData, productIds: newProductIds });
  };

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
              to="/contacts"
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {isNew ? 'New Contact' : formData.name || 'Edit Contact'}
              </h1>
              {!isNew && selectedAccount && (
                <p className="text-sm text-gray-500">{selectedAccount.name}</p>
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
          <form id="contact-form" onSubmit={handleSubmit} className="space-y-4">
            
            {/* Main Information Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* Left Column - Core Contact Info */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Personal Info */}
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Personal Information</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                          <Mail className="h-3.5 w-3.5 text-gray-400" />
                        </div>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full text-sm pl-8 border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                          <Phone className="h-3.5 w-3.5 text-gray-400" />
                        </div>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full text-sm pl-8 border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Position</label>
                      <input
                        type="text"
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                      <input
                        type="text"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">LinkedIn</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                          <Globe className="h-3.5 w-3.5 text-gray-400" />
                        </div>
                        <input
                          type="url"
                          value={formData.linkedIn}
                          onChange={(e) => setFormData({ ...formData, linkedIn: e.target.value })}
                          className="w-full text-sm pl-8 border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="https://linkedin.com/in/..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Business Info */}
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Briefcase className="h-4 w-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Business Information</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Account</label>
                      <select
                        value={formData.accountId}
                        onChange={(e) => setFormData({ ...formData, accountId: e.target.value, productIds: [] })}
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
                      <label className="block text-xs font-medium text-gray-700 mb-1">Contact Type</label>
                      <select
                        value={formData.contactType}
                        onChange={(e) => setFormData({ ...formData, contactType: e.target.value as ContactType })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        {contactTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Timezone</label>
                      <input
                        type="text"
                        value={formData.timezone}
                        onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="EST, PST, GMT..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Preferred Contact</label>
                      <select
                        value={formData.preferredContactMethod}
                        onChange={(e) => setFormData({ ...formData, preferredContactMethod: e.target.value as typeof CONTACT_METHODS[number] })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        {CONTACT_METHODS.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.isDecisionMaker}
                          onChange={(e) => setFormData({ ...formData, isDecisionMaker: e.target.checked })}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-2"
                        />
                        <span className="text-sm text-gray-700">Decision Maker</span>
                      </label>
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

              {/* Right Column - Quick Info */}
              <div className="space-y-4">
                
                {/* Quick Contact */}
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Quick Contact</h2>
                  </div>
                  <div className="space-y-2">
                    {formData.email && (
                      <a
                        href={`mailto:${formData.email}`}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {formData.email}
                      </a>
                    )}
                    {formData.phone && (
                      <a
                        href={`tel:${formData.phone}`}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {formData.phone}
                      </a>
                    )}
                    {formData.linkedIn && (
                      <a
                        href={formData.linkedIn}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        LinkedIn
                      </a>
                    )}
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
                      {contact?.createdAt && (
                        <div>
                          <span className="text-gray-500">Created:</span>
                          <p className="text-gray-900">{(() => {
                            try {
                              const timestamp = contact.createdAt;
                              let date: Date;
                              
                              if ((timestamp as any)?.toDate) {
                                // Firestore Timestamp
                                date = (timestamp as any).toDate();
                              } else if ((timestamp as any)?._seconds) {
                                // Cloud Functions timestamp format {_seconds: number, _nanoseconds: number}
                                date = new Date((timestamp as any)._seconds * 1000);
                              } else if ((timestamp as any)?.seconds) {
                                // Legacy Firestore format {seconds: number}
                                date = new Date((timestamp as any).seconds * 1000);
                              } else if (timestamp) {
                                // Regular date string or Date object
                                date = new Date(timestamp);
                              } else {
                                return 'N/A';
                              }
                              
                              if (isNaN(date.getTime())) {
                                return 'Invalid Date';
                              }
                              
                              return format(date, 'MMM d, yyyy');
                            } catch (error) {
                              console.error('Date formatting error:', error, contact.createdAt);
                              return 'N/A';
                            }
                          })()}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Type:</span>
                        <p className="text-gray-900">{formData.contactType}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Products:</span>
                        <p className="text-gray-900">{selectedProducts.length} associated</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Activities:</span>
                        <p className="text-gray-900">{contactActivities.length} recorded</p>
                      </div>
                      {contact?.lastContactDate && (
                        <div>
                          <span className="text-gray-500">Last Contact:</span>
                          <p className="text-gray-900">{(() => {
                            try {
                              const timestamp = contact.lastContactDate;
                              let date: Date;
                              
                              if ((timestamp as any)?.toDate) {
                                // Firestore Timestamp
                                date = (timestamp as any).toDate();
                              } else if ((timestamp as any)?._seconds) {
                                // Cloud Functions timestamp format {_seconds: number, _nanoseconds: number}
                                date = new Date((timestamp as any)._seconds * 1000);
                              } else if ((timestamp as any)?.seconds) {
                                // Legacy Firestore format {seconds: number}
                                date = new Date((timestamp as any).seconds * 1000);
                              } else if (timestamp) {
                                // Regular date string or Date object
                                date = new Date(timestamp);
                              } else {
                                return 'N/A';
                              }
                              
                              if (isNaN(date.getTime())) {
                                return 'Invalid Date';
                              }
                              
                              return format(date, 'MMM d, yyyy');
                            } catch (error) {
                              console.error('Date formatting error:', error, contact.lastContactDate);
                              return 'N/A';
                            }
                          })()}</p>
                          <p className="text-xs text-gray-500">
                            {(() => {
                              try {
                                const timestamp = contact.lastContactDate;
                                let date: Date;
                                
                                if ((timestamp as any)?.seconds) {
                                  date = new Date((timestamp as any).seconds * 1000);
                                } else if (timestamp) {
                                  date = new Date(timestamp);
                                } else {
                                  return 'N/A';
                                }
                                
                                if (isNaN(date.getTime())) {
                                  return 'Invalid Date';
                                }
                                
                                return formatDistanceToNow(date, { addSuffix: true });
                              } catch (error) {
                                console.error('Date formatting error:', error, contact.lastContactDate);
                                return 'N/A';
                              }
                            })()}
                          </p>
                        </div>
                      )}
                      {(() => {
                        // Find the most recent completed activity
                        const completedActivities = contactActivities.filter(a => a.status === 'Completed');
                        if (completedActivities.length > 0) {
                          const latestCompleted = completedActivities[0];
                          return (
                            <div>
                              <span className="text-gray-500">Latest Activity:</span>
                              <p className="text-gray-900">{latestCompleted.subject}</p>
                              <p className="text-xs text-gray-500">
                                {(() => {
                        try {
                          let date: Date;
                          if (latestCompleted.completedAt) {
                            const completedAt = latestCompleted.completedAt;
                            if ((completedAt as any)?.toDate) {
                              date = (completedAt as any).toDate();
                            } else if ((completedAt as any)?._seconds) {
                              date = new Date((completedAt as any)._seconds * 1000);
                            } else {
                              date = new Date(completedAt);
                            }
                          } else {
                            const dateTime = latestCompleted.dateTime;
                            if ((dateTime as any)?.toDate) {
                              date = (dateTime as any).toDate();
                            } else if ((dateTime as any)?._seconds) {
                              date = new Date((dateTime as any)._seconds * 1000);
                            } else {
                              date = new Date(dateTime);
                            }
                          }
                          return formatDistanceToNow(date, { addSuffix: true });
                        } catch (error) {
                          console.error('Date formatting error:', error, latestCompleted);
                          return 'N/A';
                        }
                      })()}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Products Section */}
            {formData.accountId && (
              <div className="bg-white shadow rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-gray-500" />
                  <h2 className="text-base font-medium text-gray-900">Associated Products ({selectedProducts.length})</h2>
                </div>
                
                {/* Product Selection */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 mb-2">Select Products</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2.5 bg-gray-50">
                    {availableProducts.map((product) => (
                      <label key={product.id} className="flex items-center text-xs">
                        <input
                          type="checkbox"
                          checked={formData.productIds?.includes(product.id || '') || false}
                          onChange={() => handleProductToggle(product.id || '')}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-1.5"
                        />
                        <span className="text-gray-700 truncate">
                          {product.name}
                        </span>
                      </label>
                    ))}
                    {availableProducts.length === 0 && (
                      <p className="text-xs text-gray-500 italic col-span-full">
                        No products available for this account
                      </p>
                    )}
                  </div>
                </div>

                {/* Selected Products */}
                {selectedProducts.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedProducts.map((product) => (
                      <div key={product.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <Link
                          to={`/products/${product.id}`}
                          className="text-sm font-medium text-gray-900 hover:text-primary-600 block truncate"
                        >
                          {product.name}
                        </Link>
                        {product.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Activity Timeline Section */}
            {!isNew && contactActivities.length > 0 && (
              <div className="bg-white shadow rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Activity Timeline ({contactActivities.length})</h2>
                  </div>
                </div>
                
                <div className="space-y-4">
                  {contactActivities.map((activity, index) => {
                    const ActivityIcon = getActivityIcon(activity.activityType);
                    const isOverdue = activity.status === 'Scheduled' && (() => {
                      try {
                        const dateTime = activity.dateTime;
                        let date: Date;
                        
                        if ((dateTime as any)?.toDate) {
                          date = (dateTime as any).toDate();
                        } else if ((dateTime as any)?._seconds) {
                          date = new Date((dateTime as any)._seconds * 1000);
                        } else {
                          date = new Date(dateTime);
                        }
                        
                        return date < new Date();
                      } catch (error) {
                        console.error('Date comparison error:', error, activity.dateTime);
                        return false;
                      }
                    })();
                    
                    return (
                      <div key={`${activity.id}-${index}`} className="relative flex items-start space-x-3 pb-4 border-b border-gray-100 last:border-b-0 last:pb-0">
                        {/* Timeline line */}
                        {index < contactActivities.length - 1 && (
                          <div className="absolute left-4 top-8 bottom-0 w-px bg-gray-200" />
                        )}
                        
                        {/* Activity icon */}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white ${
                          activity.status === 'Completed' ? 'border-green-500' : 
                          activity.status === 'Cancelled' ? 'border-red-500' : 
                          isOverdue ? 'border-red-500' : 'border-blue-500'
                        }`}>
                          <ActivityIcon className={`h-4 w-4 ${
                            activity.status === 'Completed' ? 'text-green-500' : 
                            activity.status === 'Cancelled' ? 'text-red-500' : 
                            isOverdue ? 'text-red-500' : 'text-blue-500'
                          }`} />
                        </div>
                        
                        {/* Activity content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-medium text-gray-900">
                                {activity.subject}
                              </h3>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(activity.status)}`}>
                                {activity.status}
                              </span>
                              {isOverdue && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                  <AlertTriangle className="h-3 w-3" />
                                  Overdue
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">
                                {(() => {
                              try {
                                const dateTime = activity.dateTime;
                                let date: Date;
                                
                                if ((dateTime as any)?.toDate) {
                                  // Firestore Timestamp
                                  date = (dateTime as any).toDate();
                                } else if ((dateTime as any)?._seconds) {
                                  // Cloud Functions timestamp format {_seconds: number, _nanoseconds: number}
                                  date = new Date((dateTime as any)._seconds * 1000);
                                } else {
                                  // Regular date string or Date object
                                  date = new Date(dateTime);
                                }
                                
                                if (isNaN(date.getTime())) {
                                  return 'Invalid Date';
                                }
                                
                                return formatDistanceToNow(date, { addSuffix: true });
                              } catch (error) {
                                console.error('Date formatting error:', error, activity.dateTime);
                                return 'N/A';
                              }
                            })()}
                              </span>
                              <Link
                                to={`/opportunities/${(activity as any).opportunityId}`}
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View Opportunity
                              </Link>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {(() => {
                              try {
                                const dateTime = activity.dateTime;
                                let date: Date;
                                
                                if ((dateTime as any)?.toDate) {
                                  // Firestore Timestamp
                                  date = (dateTime as any).toDate();
                                } else if ((dateTime as any)?._seconds) {
                                  // Cloud Functions timestamp format {_seconds: number, _nanoseconds: number}
                                  date = new Date((dateTime as any)._seconds * 1000);
                                } else {
                                  // Regular date string or Date object
                                  date = new Date(dateTime);
                                }
                                
                                if (isNaN(date.getTime())) {
                                  return 'Invalid Date';
                                }
                                
                                return format(date, 'MMM d, yyyy • h:mm a');
                              } catch (error) {
                                console.error('Date formatting error:', error, activity.dateTime);
                                return 'N/A';
                              }
                            })()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {(activity as any).opportunityTitle}
                            </span>
                            <span className="capitalize">
                              {activity.method}
                            </span>
                          </div>
                          
                          {activity.notes && (
                            <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded p-2">
                              {activity.notes}
                            </p>
                          )}
                          
                          {activity.completedAt && (
                            <div className="flex items-center gap-2 text-xs text-green-700 mt-2">
                              <CheckCircle className="h-3 w-3" />
                              Completed: {(() => {
                                try {
                                  const completedAt = activity.completedAt;
                                  let date: Date;
                            if ((completedAt as any)?.toDate) {
                              date = (completedAt as any).toDate();
                            } else if ((completedAt as any)?._seconds) {
                              date = new Date((completedAt as any)._seconds * 1000);
                            } else {
                              date = new Date(completedAt);
                            }
                                  return format(date, 'MMM d, yyyy • h:mm a');
                                } catch (error) {
                                  console.error('Date formatting error:', error, activity.completedAt);
                                  return 'N/A';
                                }
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No activities message */}
            {!isNew && contactActivities.length === 0 && (
              <div className="bg-white shadow rounded-lg p-6">
                <div className="text-center">
                  <Activity className="mx-auto h-12 w-12 text-gray-300" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No activities found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No interactions have been recorded for this contact yet.
                  </p>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Floating Save Button */}
      <button
        type="submit"
        form="contact-form"
        disabled={saving || !formData.name?.trim() || !formData.accountId}
        className="fixed bottom-4 right-4 bg-primary-600 text-white p-3 rounded-full shadow-lg hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-500 focus:ring-opacity-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed z-50"
        title={saving ? 'Saving...' : 'Save Contact'}
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