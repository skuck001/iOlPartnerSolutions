import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Trash2,
  Building2,
  DollarSign,
  MapPin,
  Target,
  Calendar,
  Users,
  TrendingUp,
  Package,
  MessageSquare,
  CheckCircle,
  Activity,
  Plus,
  X,
  User,
  AlertCircle,
  Clock,
  CheckSquare,
  FileText,
  Phone,
  Video,
  Mail
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import type { 
  Opportunity, 
  OpportunityStage, 
  OpportunityPriority,
  Activity as ActivityType,
  ActivityStatus,
  ChecklistItem,
  Account, 
  Contact, 
  Product,
  Task
} from '../types';
import { getDocument, getDocuments, createDocument, updateDocument, deleteDocument } from '../lib/firestore';
import { format } from 'date-fns';

const OPPORTUNITY_STAGES: OpportunityStage[] = [
  'Discovery',
  'Proposal',
  'Negotiation',
  'Closed-Won',
  'Closed-Lost'
];

const PRIORITIES: OpportunityPriority[] = ['Critical', 'High', 'Medium', 'Low'];

const ACTIVITY_TYPES = ['Meeting', 'Email', 'Call', 'WhatsApp', 'Demo', 'Workshop'];
const ACTIVITY_METHODS = ['In-person', 'Zoom', 'Phone', 'Teams', 'Email'];

const COMMERCIAL_MODELS = [
  '1% issuing fee',
  '2% issuing fee', 
  '3% issuing fee',
  'Revenue share 10%',
  'Revenue share 15%',
  'Revenue share 20%',
  'Fixed monthly fee',
  'Per transaction fee',
  'Custom model'
];

const IOL_PRODUCTS = [
  'iOL Pay Issuing',
  'iOL Pay Acquiring',
  'iOL Pay Automate',
  'iOL Pay Payment Gateway',
  'iOL Pay Payment Link',
  'iOL X Exchange',
  'iOL X Supply',
  'iOL X Demand',
  'iOL Pulse'
];

export const OpportunityDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new' || !id;
  
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    accountId: '',
    productId: '',
    contactIds: [] as string[],
    stage: 'Discovery' as OpportunityStage,
    priority: 'Medium' as OpportunityPriority,
    region: '',
    iolProducts: [] as string[],
    notes: '',
    tags: [] as string[],
    activities: [] as ActivityType[],
    checklist: [] as ChecklistItem[],
    commercialModel: '',
    potentialVolume: 0,
    estimatedDealValue: 0,
    expectedCloseDate: null as Date | null
  });

  // New item forms
  const [newTag, setNewTag] = useState('');
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activitiesDisplayCount, setActivitiesDisplayCount] = useState(5); // For pagination
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [showCompletedChecklist, setShowCompletedChecklist] = useState(false);
  const [showSuggestedContacts, setShowSuggestedContacts] = useState(false);
  const [activityForm, setActivityForm] = useState({
    activityType: 'Meeting' as 'Meeting' | 'Email' | 'Call' | 'WhatsApp' | 'Demo' | 'Workshop',
    dateTime: new Date(),
    relatedContactIds: [] as string[],
    method: 'In-person' as 'In-person' | 'Zoom' | 'Phone' | 'Teams' | 'Email',
    subject: '',
    notes: '',
    assignedTo: 'current-user', // This should be the current user ID
    status: 'Scheduled' as ActivityStatus,
    priority: 'Medium' as 'High' | 'Medium' | 'Low'
  });

  // Contact creation form
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    position: '',
    phone: ''
  });

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accountsData, contactsData, productsData, tasksData] = await Promise.all([
        getDocuments('accounts'),
        getDocuments('contacts'),
        getDocuments('products'),
        getDocuments('tasks')
      ]);
      
      setAccounts(accountsData as Account[]);
      setContacts(contactsData as Contact[]);
      setProducts(productsData as Product[]);
      setTasks((tasksData as Task[]).filter(t => t.opportunityId === id));

      if (!isNew && id) {
        const opportunityData = await getDocument('opportunities', id);
        if (opportunityData) {
          const oppTyped = opportunityData as Opportunity;
          setOpportunity(oppTyped);
          // Handle backward compatibility for activities
          const enhancedActivities = (oppTyped.activities || []).map(activity => ({
            ...activity,
            status: activity.status || 'Completed' as ActivityStatus, // Default old activities to completed
            priority: activity.priority || 'Medium' as 'High' | 'Medium' | 'Low',
            followUpNeeded: false, // Remove follow-up functionality
            completedAt: activity.completedAt || (activity.status === 'Completed' ? activity.createdAt : undefined),
            updatedAt: activity.updatedAt || undefined,
            updatedBy: activity.updatedBy || undefined
          }));

          setFormData({
            title: oppTyped.title,
            summary: oppTyped.summary,
            accountId: oppTyped.accountId,
            productId: oppTyped.productId || '',
            contactIds: oppTyped.contactIds || oppTyped.contactsInvolved || [],
            stage: oppTyped.stage,
            priority: oppTyped.priority || 'Medium',
            region: oppTyped.region,
            iolProducts: (oppTyped as any).iolProducts || [], // New field, default to empty array
            notes: oppTyped.notes || '',
            tags: oppTyped.tags || [],
            activities: enhancedActivities,
            checklist: oppTyped.checklist || [], // New field, default to empty array
            commercialModel: oppTyped.commercialModel || '',
            potentialVolume: oppTyped.potentialVolume || 0,
            estimatedDealValue: oppTyped.estimatedDealValue || 0,
            expectedCloseDate: oppTyped.expectedCloseDate?.toDate() || null
          });
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Derived data
  const selectedAccount = accounts.find(a => a.id === formData.accountId);
  const selectedProduct = products.find(p => p.id === formData.productId);
  
  // Contact suggestions: direct contacts + account contacts + product contacts
  const directContacts = contacts.filter(c => formData.contactIds.includes(c.id || ''));
  const accountContacts = contacts.filter(c => 
    formData.accountId && 
    c.accountId === formData.accountId && 
    !formData.contactIds.includes(c.id || '')
  );
  const productContacts = contacts.filter(c => 
    formData.productId && 
    selectedProduct?.contactIds.includes(c.id || '') &&
    !formData.contactIds.includes(c.id || '') &&
    c.accountId !== formData.accountId
  );
  const allSuggestedContacts = [...accountContacts, ...productContacts];

  const getStageColor = (stage: OpportunityStage) => {
    const colors = {
      'Discovery': 'bg-blue-100 text-blue-800',
      'Proposal': 'bg-yellow-100 text-yellow-800',
      'Negotiation': 'bg-orange-100 text-orange-800',
      'Closed-Won': 'bg-green-100 text-green-800',
      'Closed-Lost': 'bg-red-100 text-red-800'
    };
    return colors[stage];
  };

  const getPriorityColor = (priority: OpportunityPriority) => {
    const colors = {
      'Critical': 'bg-red-100 text-red-800',
      'High': 'bg-orange-100 text-orange-800',
      'Medium': 'bg-yellow-100 text-yellow-800',
      'Low': 'bg-green-100 text-green-800'
    };
    return colors[priority];
  };

  const getActivityIcon = (type: string) => {
    const icons = {
      'Meeting': Calendar,
      'Email': Mail,
      'Call': Phone,
      'WhatsApp': MessageSquare,
      'Demo': Video,
      'Workshop': Users
    };
    return icons[type as keyof typeof icons] || Activity;
  };

  // Event handlers
  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(tag => tag !== tagToRemove) });
  };

  // Checklist handlers
  const handleAddChecklistItem = () => {
    if (newChecklistItem.trim()) {
      const newItem: ChecklistItem = {
        id: Date.now().toString(),
        text: newChecklistItem.trim(),
        completed: false,
        createdAt: Timestamp.now()
      };
      setFormData({ 
        ...formData, 
        checklist: [...formData.checklist, newItem] 
      });
      setNewChecklistItem('');
    }
  };

  const handleToggleChecklistItem = (itemId: string) => {
    const updatedChecklist = formData.checklist.map(item => 
      item.id === itemId 
        ? { 
            ...item, 
            completed: !item.completed,
            completedAt: !item.completed ? Timestamp.now() : undefined
          }
        : item
    );
    setFormData({ ...formData, checklist: updatedChecklist });
  };

  const handleRemoveChecklistItem = (itemId: string) => {
    setFormData({ 
      ...formData, 
      checklist: formData.checklist.filter(item => item.id !== itemId) 
    });
  };

  const handleAddContact = (contactId: string) => {
    if (!formData.contactIds.includes(contactId)) {
      setFormData({ ...formData, contactIds: [...formData.contactIds, contactId] });
    }
  };

  const handleRemoveContact = (contactId: string) => {
    setFormData({ ...formData, contactIds: formData.contactIds.filter(id => id !== contactId) });
  };

  const handleCreateContact = async () => {
    if (newContact.name.trim() && newContact.email.trim()) {
      try {
        const contactData = {
          ...newContact,
          accountId: formData.accountId,
          contactType: 'Primary',
          tags: [],
          createdAt: Timestamp.now()
        };
        
        const docRef = await createDocument('contacts', contactData);
        
        // Refresh contacts and add to opportunity
        await fetchData();
        handleAddContact(docRef.id);
        
        // Reset form
        setNewContact({ name: '', email: '', position: '', phone: '' });
        setShowCreateContact(false);
      } catch (error) {
        console.error('Error creating contact:', error);
      }
    }
  };

  const resetActivityForm = () => {
    setActivityForm({
      activityType: 'Meeting',
      dateTime: new Date(),
      relatedContactIds: [],
      method: 'In-person',
      subject: '',
      notes: '',
      assignedTo: 'current-user',
      status: 'Scheduled',
      priority: 'Medium'
    });
    setEditingActivityId(null);
    setShowActivityForm(false);
  };

  const handleSaveActivity = async () => {
    if (!activityForm.subject.trim()) return;

    // If this is a completely new opportunity that hasn't been saved yet, show an alert
    if (isNew || !id || id === 'new') {
      alert('Please save the opportunity first before adding activities.');
      return;
    }

    setSaving(true);

    try {
      const now = new Date();
      const activityDateTime = activityForm.dateTime;
      
      // Determine status based on date/time
      let status = activityForm.status;
      if (status === 'Scheduled' && activityDateTime <= now) {
        status = 'Completed';
      }

      const activityData: ActivityType = {
        id: editingActivityId || Date.now().toString(),
        activityType: activityForm.activityType,
        dateTime: Timestamp.fromDate(activityForm.dateTime),
        relatedContactIds: activityForm.relatedContactIds,
        method: activityForm.method,
        subject: activityForm.subject,
        notes: activityForm.notes,
        assignedTo: activityForm.assignedTo,
        status: status,
        priority: activityForm.priority,
        followUpNeeded: false, // Always false now
        completedAt: status === 'Completed' ? Timestamp.now() : undefined,
        createdAt: editingActivityId ? 
          formData.activities.find(a => a.id === editingActivityId)?.createdAt || Timestamp.now() : 
          Timestamp.now(),
        createdBy: editingActivityId ? 
          formData.activities.find(a => a.id === editingActivityId)?.createdBy || 'current-user' : 
          'current-user',
        updatedAt: editingActivityId ? Timestamp.now() : undefined,
        updatedBy: editingActivityId ? 'current-user' : undefined
      };

      let updatedActivities;
      if (editingActivityId) {
        // Update existing activity
        updatedActivities = formData.activities.map(a => 
          a.id === editingActivityId ? activityData : a
        );
      } else {
        // Add new activity
        updatedActivities = [...formData.activities, activityData];
      }

      // Update local state first
      const updatedFormData = { ...formData, activities: updatedActivities };
      setFormData(updatedFormData);

      // Helper function to recursively remove undefined values
      const removeUndefinedValues = (obj: any): any => {
        if (obj === null || obj === undefined) {
          return null;
        }
        
        if (Array.isArray(obj)) {
          return obj.map(removeUndefinedValues).filter(item => item !== undefined);
        }
        
        if (typeof obj === 'object' && obj.constructor === Object) {
          const cleaned: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
              const cleanedValue = removeUndefinedValues(value);
              if (cleanedValue !== undefined) {
                cleaned[key] = cleanedValue;
              }
            }
          }
          return cleaned;
        }
        
        return obj;
      };

      // Get the last activity date
      const getLastActivityDate = () => {
        if (updatedActivities.length === 0) {
          return Timestamp.now();
        }
        
        const lastActivity = updatedActivities[updatedActivities.length - 1];
        return lastActivity?.dateTime || Timestamp.now();
      };

      // Prepare data for database update
      const cleanedData = {
        ...updatedFormData,
        contactsInvolved: updatedFormData.contactIds, // For backward compatibility
        meetingHistory: [], // For backward compatibility
        useCase: '', // For backward compatibility - keep empty since replaced by iolProducts
        tasks: tasks.map(t => t.id),
        createdAt: opportunity?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastActivityDate: getLastActivityDate()
      };

      // Only add expectedCloseDate if it exists
      if (updatedFormData.expectedCloseDate) {
        (cleanedData as any).expectedCloseDate = Timestamp.fromDate(updatedFormData.expectedCloseDate);
      }

      // Remove any undefined values recursively
      const submitData = removeUndefinedValues(cleanedData);

      // Save to database
      await updateDocument('opportunities', id, submitData);
      
      console.log('✅ Activity saved successfully');
      resetActivityForm();
      
      // Refresh data to ensure consistency
      await fetchData();
      
    } catch (error) {
      console.error('❌ Error saving activity:', error);
      alert('Failed to save activity: ' + (error as Error).message);
      // Revert local state on error
      setFormData(formData);
    } finally {
      setSaving(false);
    }
  };

  const handleEditActivity = (activity: ActivityType) => {
    setActivityForm({
      activityType: activity.activityType,
      dateTime: activity.dateTime.toDate(),
      relatedContactIds: activity.relatedContactIds,
      method: activity.method,
      subject: activity.subject,
      notes: activity.notes,
      assignedTo: activity.assignedTo,
      status: activity.status,
      priority: activity.priority || 'Medium'
    });
    setEditingActivityId(activity.id);
    setShowActivityForm(true);
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm('Are you sure you want to delete this activity?')) return;
    
    // If this is a completely new opportunity that hasn't been saved yet, just update local state
    if (isNew || !id || id === 'new') {
      const updatedActivities = formData.activities.filter(a => a.id !== activityId);
      setFormData({ ...formData, activities: updatedActivities });
      return;
    }

    setSaving(true);

    try {
      const updatedActivities = formData.activities.filter(a => a.id !== activityId);
      const updatedFormData = { ...formData, activities: updatedActivities };
      
      // Update local state first
      setFormData(updatedFormData);

      // Prepare data for database update (same logic as handleSaveActivity)
      const removeUndefinedValues = (obj: any): any => {
        if (obj === null || obj === undefined) return null;
        if (Array.isArray(obj)) return obj.map(removeUndefinedValues).filter(item => item !== undefined);
        if (typeof obj === 'object' && obj.constructor === Object) {
          const cleaned: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
              const cleanedValue = removeUndefinedValues(value);
              if (cleanedValue !== undefined) cleaned[key] = cleanedValue;
            }
          }
          return cleaned;
        }
        return obj;
      };

      const getLastActivityDate = () => {
        if (updatedActivities.length === 0) return Timestamp.now();
        const lastActivity = updatedActivities[updatedActivities.length - 1];
        return lastActivity?.dateTime || Timestamp.now();
      };

      const cleanedData = {
        ...updatedFormData,
        contactsInvolved: updatedFormData.contactIds,
        meetingHistory: [],
        useCase: '',
        tasks: tasks.map(t => t.id),
        createdAt: opportunity?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastActivityDate: getLastActivityDate()
      };

      if (updatedFormData.expectedCloseDate) {
        (cleanedData as any).expectedCloseDate = Timestamp.fromDate(updatedFormData.expectedCloseDate);
      }

      const submitData = removeUndefinedValues(cleanedData);
      await updateDocument('opportunities', id, submitData);
      
      console.log('✅ Activity deleted successfully');
      await fetchData(); // Refresh data
      
    } catch (error) {
      console.error('❌ Error deleting activity:', error);
      alert('Failed to delete activity: ' + (error as Error).message);
      setFormData(formData); // Revert on error
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteActivity = async (activityId: string) => {
    // If this is a completely new opportunity that hasn't been saved yet, just update local state
    if (isNew || !id || id === 'new') {
      const updatedActivities = formData.activities.map(a => 
        a.id === activityId ? {
          ...a,
          status: 'Completed' as ActivityStatus,
          completedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          updatedBy: 'current-user'
        } : a
      );
      setFormData({ ...formData, activities: updatedActivities });
      return;
    }

    setSaving(true);

    try {
      const updatedActivities = formData.activities.map(a => 
        a.id === activityId ? {
          ...a,
          status: 'Completed' as ActivityStatus,
          completedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          updatedBy: 'current-user'
        } : a
      );
      const updatedFormData = { ...formData, activities: updatedActivities };
      
      // Update local state first
      setFormData(updatedFormData);

      // Prepare data for database update (same logic as handleSaveActivity)
      const removeUndefinedValues = (obj: any): any => {
        if (obj === null || obj === undefined) return null;
        if (Array.isArray(obj)) return obj.map(removeUndefinedValues).filter(item => item !== undefined);
        if (typeof obj === 'object' && obj.constructor === Object) {
          const cleaned: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
              const cleanedValue = removeUndefinedValues(value);
              if (cleanedValue !== undefined) cleaned[key] = cleanedValue;
            }
          }
          return cleaned;
        }
        return obj;
      };

      const getLastActivityDate = () => {
        if (updatedActivities.length === 0) return Timestamp.now();
        const lastActivity = updatedActivities[updatedActivities.length - 1];
        return lastActivity?.dateTime || Timestamp.now();
      };

      const cleanedData = {
        ...updatedFormData,
        contactsInvolved: updatedFormData.contactIds,
        meetingHistory: [],
        useCase: '',
        tasks: tasks.map(t => t.id),
        createdAt: opportunity?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastActivityDate: getLastActivityDate()
      };

      if (updatedFormData.expectedCloseDate) {
        (cleanedData as any).expectedCloseDate = Timestamp.fromDate(updatedFormData.expectedCloseDate);
      }

      const submitData = removeUndefinedValues(cleanedData);
      await updateDocument('opportunities', id, submitData);
      
      console.log('✅ Activity completed successfully');
      await fetchData(); // Refresh data
      
    } catch (error) {
      console.error('❌ Error completing activity:', error);
      alert('Failed to complete activity: ' + (error as Error).message);
      setFormData(formData); // Revert on error
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔥 Form submitted!', { isNew, id, currentUrl: window.location.pathname });
    console.log('📊 Form data:', formData);
    
    setSaving(true);
    
    try {
      // Helper function to recursively remove undefined values
      const removeUndefinedValues = (obj: any): any => {
        if (obj === null || obj === undefined) {
          return null;
        }
        
        if (Array.isArray(obj)) {
          return obj.map(removeUndefinedValues).filter(item => item !== undefined);
        }
        
        if (typeof obj === 'object' && obj.constructor === Object) {
          const cleaned: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
              const cleanedValue = removeUndefinedValues(value);
              if (cleanedValue !== undefined) {
                cleaned[key] = cleanedValue;
              }
            }
          }
          return cleaned;
        }
        
        return obj;
      };

      // Get the last activity date more safely
      const getLastActivityDate = () => {
        if (formData.activities.length === 0) {
          return Timestamp.now();
        }
        
        const lastActivity = formData.activities[formData.activities.length - 1];
        return lastActivity?.dateTime || Timestamp.now();
      };

      // Clean up the data - remove undefined values and convert properly
      const cleanedData = {
        ...formData,
        contactsInvolved: formData.contactIds, // For backward compatibility
        meetingHistory: [], // For backward compatibility
        useCase: '', // For backward compatibility - keep empty since replaced by iolProducts
        tasks: tasks.map(t => t.id),
        createdAt: isNew ? Timestamp.now() : opportunity?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
        lastActivityDate: getLastActivityDate()
      };

      // Only add expectedCloseDate if it exists
      if (formData.expectedCloseDate) {
        (cleanedData as any).expectedCloseDate = Timestamp.fromDate(formData.expectedCloseDate);
      }

      // Remove any undefined values recursively
      const submitData = removeUndefinedValues(cleanedData);

      console.log('💾 Submitting data:', submitData);

      if (isNew || !id) {
        console.log('✨ Creating new opportunity...');
        const docRef = await createDocument('opportunities', submitData);
        console.log('✅ Created with ID:', docRef.id);
        navigate('/opportunities');
      } else if (id && id !== 'new') {
        console.log('📝 Updating existing opportunity:', id);
        await updateDocument('opportunities', id, submitData);
        console.log('✅ Updated successfully');
        await fetchData();
      } else {
        console.log('⚠️ Unexpected state:', { isNew, id });
      }
    } catch (error) {
      console.error('❌ Error saving opportunity:', error);
      alert('Failed to save opportunity: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (opportunity && id && confirm('Are you sure you want to delete this opportunity?')) {
      try {
        await deleteDocument('opportunities', id);
        navigate('/opportunities');
      } catch (error) {
        console.error('Error deleting opportunity:', error);
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
              to="/opportunities"
              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {isNew ? 'New Opportunity' : formData.title || 'Edit Opportunity'}
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
                className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1 inline" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content - Three Column Layout */}
      <div className="flex-1 overflow-auto pb-20">
        <div className="max-w-7xl mx-auto p-4">
          <form id="opportunity-form" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              
              {/* Left Column (2/3) - Core Information */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Primary Information */}
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Opportunity Information</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Account</label>
                      <select
                        value={formData.accountId}
                        onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
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
                      <label className="block text-xs font-medium text-gray-700 mb-1">Product (Optional)</label>
                      <select
                        value={formData.productId}
                        onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">Select Product</option>
                        {products
                          .filter(p => !formData.accountId || p.accountId === formData.accountId)
                          .map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Stage</label>
                      <select
                        value={formData.stage}
                        onChange={(e) => setFormData({ ...formData, stage: e.target.value as OpportunityStage })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        {OPPORTUNITY_STAGES.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Priority</label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as OpportunityPriority })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        {PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
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
                        placeholder="North America, EMEA, APAC..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Expected Close Date</label>
                      <input
                        type="date"
                        value={formData.expectedCloseDate ? formData.expectedCloseDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          expectedCloseDate: e.target.value ? new Date(e.target.value) : null 
                        })}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Summary</label>
                      <textarea
                        value={formData.summary}
                        onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                        rows={2}
                        className="w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Brief opportunity summary..."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-2">iOL Products & Solutions</label>
                      
                      {/* Selected Products Tags */}
                      {formData.iolProducts.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {formData.iolProducts.map((product) => (
                            <span key={product} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {product}
                              <button
                                type="button"
                                onClick={() => setFormData({ 
                                  ...formData, 
                                  iolProducts: formData.iolProducts.filter(p => p !== product) 
                                })}
                                className="ml-2 hover:text-blue-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Product Selection Grid */}
                      <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {IOL_PRODUCTS.map((product) => {
                            const isSelected = formData.iolProducts.includes(product);
                            return (
                              <label
                                key={product}
                                className={`flex items-center p-2 rounded-md cursor-pointer transition-colors ${
                                  isSelected 
                                    ? 'bg-blue-100 border-blue-300 text-blue-900' 
                                    : 'bg-white border-gray-200 hover:bg-gray-50'
                                } border`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setFormData({ 
                                        ...formData, 
                                        iolProducts: [...formData.iolProducts, product] 
                                      });
                                    } else {
                                      setFormData({ 
                                        ...formData, 
                                        iolProducts: formData.iolProducts.filter(p => p !== product) 
                                      });
                                    }
                                  }}
                                  className="mr-2 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs font-medium">{product}</span>
                              </label>
                            );
                          })}
                        </div>
                        {formData.iolProducts.length === 0 && (
                          <p className="text-xs text-gray-500 mt-2 text-center">
                            Select the iOL products and solutions offered for this opportunity
                          </p>
                        )}
                      </div>
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



                {/* Activity Log */}
                <div className="bg-white shadow rounded-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-iol-red bg-opacity-10 rounded-lg">
                        <Activity className="h-5 w-5 text-iol-red" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">Activity Timeline</h2>
                        <p className="text-sm text-gray-500">Track all interactions and meetings</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {editingActivityId && (
                        <button
                          type="button"
                          onClick={resetActivityForm}
                          className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          Cancel Edit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (!showActivityForm) {
                            setShowActivityForm(true);
                          } else {
                            resetActivityForm();
                          }
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-iol-red hover:bg-iol-red-dark rounded-lg transition-colors shadow-sm"
                      >
                        {showActivityForm ? (
                          <>
                            <X className="h-4 w-4" />
                            Cancel
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4" />
                            {editingActivityId ? 'Edit Activity' : 'Add Activity'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Activity form - Collapsible */}
                  {showActivityForm && (
                    <div className="border border-gray-200 rounded-lg p-5 mb-6 bg-gradient-to-r from-gray-50 to-white shadow-sm">
                      <div className="mb-4">
                        <h3 className="text-lg font-medium text-gray-900 mb-1">
                          {editingActivityId ? 'Edit Activity' : 'New Activity'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {editingActivityId ? 'Update the activity details below' : 'Add a new activity to track interactions'}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Activity Type</label>
                          <select
                            value={activityForm.activityType}
                            onChange={(e) => setActivityForm({ ...activityForm, activityType: e.target.value as any })}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-iol-red focus:border-transparent bg-white shadow-sm"
                          >
                            {ACTIVITY_TYPES.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Method</label>
                          <select
                            value={activityForm.method}
                            onChange={(e) => setActivityForm({ ...activityForm, method: e.target.value as any })}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-iol-red focus:border-transparent bg-white shadow-sm"
                          >
                            {ACTIVITY_METHODS.map(method => (
                              <option key={method} value={method}>{method}</option>
                            ))}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Date & Time</label>
                          <input
                            type="datetime-local"
                            value={activityForm.dateTime.toISOString().slice(0, 16)}
                            onChange={(e) => setActivityForm({ ...activityForm, dateTime: new Date(e.target.value) })}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-iol-red focus:border-transparent bg-white shadow-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                          <select
                            value={activityForm.status}
                            onChange={(e) => setActivityForm({ ...activityForm, status: e.target.value as ActivityStatus })}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-iol-red focus:border-transparent bg-white shadow-sm"
                          >
                            <option value="Scheduled">Scheduled</option>
                            <option value="Completed">Completed</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                          <select
                            value={activityForm.priority}
                            onChange={(e) => setActivityForm({ ...activityForm, priority: e.target.value as any })}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-iol-red focus:border-transparent bg-white shadow-sm"
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Related Contacts</label>
                          <select
                            multiple
                            value={activityForm.relatedContactIds}
                            onChange={(e) => setActivityForm({ 
                              ...activityForm, 
                              relatedContactIds: Array.from(e.target.selectedOptions, option => option.value)
                            })}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-iol-red focus:border-transparent bg-white shadow-sm"
                            size={3}
                          >
                            {directContacts.map(contact => (
                              <option key={contact.id} value={contact.id}>{contact.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Subject / Title</label>
                          <input
                            type="text"
                            placeholder="Activity subject..."
                            value={activityForm.subject}
                            onChange={(e) => setActivityForm({ ...activityForm, subject: e.target.value })}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-iol-red focus:border-transparent bg-white shadow-sm"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Notes / Summary</label>
                          <textarea
                            placeholder="Discussion points, outcomes, follow-ups..."
                            value={activityForm.notes}
                            onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
                            rows={3}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-iol-red focus:border-transparent bg-white shadow-sm"
                          />
                        </div>

                        <div className="flex justify-end gap-2 md:col-span-2">
                          {editingActivityId && (
                            <button
                              type="button"
                              onClick={resetActivityForm}
                              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200"
                            >
                              Cancel
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleSaveActivity}
                            className="px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50"
                          >
                            {editingActivityId ? (
                              <>
                                <Save className="h-3.5 w-3.5 mr-1 inline" />
                                Update Activity
                              </>
                            ) : (
                              <>
                                <Plus className="h-3.5 w-3.5 mr-1 inline" />
                                Add Activity
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Activities list - Vertical Timeline */}
                  <div className="relative">
                    {formData.activities.length > 0 ? (
                      <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                        
                        <div className="space-y-6">
                          {formData.activities
                            .sort((a, b) => {
                              // Sort by status (Scheduled first), then by dateTime
                              if (a.status !== b.status) {
                                const statusOrder = { 'Scheduled': 0, 'Completed': 1, 'Cancelled': 2 };
                                return statusOrder[a.status] - statusOrder[b.status];
                              }
                              return b.dateTime.toMillis() - a.dateTime.toMillis();
                            })
                            .slice(0, activitiesDisplayCount) // Show only limited number
                            .map((activity, index) => {
                              const ActivityIcon = getActivityIcon(activity.activityType);
                              const relatedContacts = contacts.filter(c => activity.relatedContactIds.includes(c.id || ''));
                              
                              const getStatusColor = (status: ActivityStatus) => {
                                const colors = {
                                  'Scheduled': 'bg-blue-500 text-white border-blue-500',
                                  'Completed': 'bg-green-500 text-white border-green-500',
                                  'Cancelled': 'bg-red-500 text-white border-red-500'
                                };
                                return colors[status];
                              };

                              const getStatusBadgeColor = (status: ActivityStatus) => {
                                const colors = {
                                  'Scheduled': 'bg-blue-100 text-blue-800 border-blue-200',
                                  'Completed': 'bg-green-100 text-green-800 border-green-200',
                                  'Cancelled': 'bg-red-100 text-red-800 border-red-200'
                                };
                                return colors[status];
                              };

                              const getPriorityColor = (priority?: string) => {
                                const colors: Record<string, string> = {
                                  'High': 'bg-red-100 text-red-800 border-red-200',
                                  'Medium': 'bg-yellow-100 text-yellow-800 border-yellow-200',
                                  'Low': 'bg-green-100 text-green-800 border-green-200'
                                };
                                return colors[priority || 'Medium'];
                              };

                              const isOverdue = activity.status === 'Scheduled' && activity.dateTime.toDate() < new Date();
                              const isToday = format(activity.dateTime.toDate(), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                              
                              return (
                                <div key={activity.id} className="relative flex items-start">
                                  {/* Timeline node */}
                                  <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-4 bg-white ${getStatusColor(activity.status)}`}>
                                    <ActivityIcon className="h-5 w-5" />
                                  </div>
                                  
                                  {/* Activity card */}
                                  <div className="ml-6 flex-1">
                                    <div className={`bg-white rounded-lg shadow-sm border-2 p-5 transition-all duration-200 hover:shadow-md ${
                                      isOverdue ? 'border-red-300 bg-red-50' : 
                                      isToday ? 'border-blue-300 bg-blue-50' :
                                      activity.status === 'Completed' ? 'border-green-200' :
                                      'border-gray-200 hover:border-gray-300'
                                    }`}>
                                      {/* Card header */}
                                      <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                          <h4 className="text-lg font-semibold text-gray-900 mb-1">{activity.subject}</h4>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${getStatusBadgeColor(activity.status)}`}>
                                              {activity.status}
                                            </span>
                                            <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 rounded-full border border-gray-200">
                                              {activity.activityType}
                                            </span>
                                            <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 rounded-full border border-gray-200">
                                              {activity.method}
                                            </span>
                                            {activity.priority && (
                                              <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${getPriorityColor(activity.priority)}`}>
                                                {activity.priority} Priority
                                              </span>
                                            )}
                                            {isOverdue && (
                                              <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold bg-red-100 text-red-800 rounded-full border border-red-200 animate-pulse">
                                                ⚠️ Overdue
                                              </span>
                                            )}
                                            {isToday && activity.status === 'Scheduled' && (
                                              <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-bold bg-blue-100 text-blue-800 rounded-full border border-blue-200">
                                                📅 Today
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      
                                                            {/* Activity notes */}
                      {activity.notes && (
                        <div className="mb-4">
                          {/* whitespace-pre-wrap preserves line breaks and formatting from user input */}
                          <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 border whitespace-pre-wrap">
                            {activity.notes}
                          </p>
                        </div>
                      )}
                                      
                                      {/* Activity details */}
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-600">
                                          <Calendar className="h-4 w-4 text-gray-400" />
                                          <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                            {format(activity.dateTime.toDate(), 'MMM d, yyyy • h:mm a')}
                                          </span>
                                        </div>
                                        
                                        {relatedContacts.length > 0 && (
                                          <div className="flex items-center gap-2 text-sm text-gray-600">
                                            <Users className="h-4 w-4 text-gray-400" />
                                            <span>With: {relatedContacts.map(c => c.name).join(', ')}</span>
                                          </div>
                                        )}
                                        
                                        {activity.completedAt && (
                                          <div className="flex items-center gap-2 text-sm text-green-700 md:col-span-2">
                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                            <span>
                                              Completed: {format(activity.completedAt.toDate(), 'MMM d, yyyy • h:mm a')}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {/* Action buttons */}
                                      <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                                        <button
                                          type="button"
                                          onClick={() => handleEditActivity(activity)}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                        >
                                          <FileText className="h-3.5 w-3.5" />
                                          Edit
                                        </button>
                                        {activity.status === 'Scheduled' && (
                                          <button
                                            type="button"
                                            onClick={() => handleCompleteActivity(activity.id)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-md transition-colors"
                                          >
                                            <CheckCircle className="h-3.5 w-3.5" />
                                            Mark Complete
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteActivity(activity.id)}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                        
                        {/* Show More button */}
                        {formData.activities.length > activitiesDisplayCount && (
                          <div className="mt-8 text-center">
                            <button
                              type="button"
                              onClick={() => setActivitiesDisplayCount(prev => prev + 5)}
                              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm"
                            >
                              <Plus className="h-4 w-4" />
                              Show More Activities
                              <span className="ml-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                                {Math.min(5, formData.activities.length - activitiesDisplayCount)} more
                              </span>
                            </button>
                          </div>
                        )}
                        
                        {/* Show Less button when showing more than 5 */}
                        {activitiesDisplayCount > 5 && (
                          <div className="mt-4 text-center">
                            <button
                              type="button"
                              onClick={() => setActivitiesDisplayCount(5)}
                              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                            >
                              Show Less
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No activities recorded</h3>
                        <p className="text-sm text-gray-500 mb-4">Start tracking your interactions and meetings for this opportunity</p>
                        <button
                          type="button"
                          onClick={() => setShowActivityForm(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-iol-red hover:bg-iol-red-dark rounded-lg transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                          Add First Activity
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column (1/3) - Metadata & Quick Info */}
              <div className="space-y-4">
                
                {/* Opportunity Overview - Combined Stats & Status */}
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-iol-red bg-opacity-10 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-iol-red" />
                    </div>
                    <h2 className="text-base font-medium text-gray-900">Opportunity Overview</h2>
                  </div>
                  
                  {/* Top Section - Key Metrics */}
                  <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        ${formData.estimatedDealValue.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">Deal Value</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {formData.activities.length}
                      </div>
                      <div className="text-xs text-gray-500">Total Activities</div>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${getStageColor(formData.stage)}`}>
                      {formData.stage}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${getPriorityColor(formData.priority)}`}>
                      {formData.priority} Priority
                    </span>
                  </div>

                  {/* Detailed Stats Grid */}
                  <div className="space-y-3 text-sm">
                    {/* Activity Breakdown */}
                    <div className="flex items-center justify-between py-1 border-b border-gray-100">
                      <span className="text-gray-600">Activities</span>
                      <div className="flex items-center gap-3">
                        <span className="text-blue-600 font-medium">
                          {formData.activities.filter(a => a.status === 'Scheduled').length} scheduled
                        </span>
                        <span className="text-green-600 font-medium">
                          {formData.activities.filter(a => a.status === 'Completed').length} completed
                        </span>
                      </div>
                    </div>

                    {/* Expected Close Date */}
                    {formData.expectedCloseDate && (
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Expected Close</span>
                        <span className="font-medium text-gray-900">
                          {format(formData.expectedCloseDate, 'MMM d, yyyy')}
                        </span>
                      </div>
                    )}

                    {/* Commercial Model */}
                    {formData.commercialModel && (
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Commercial Model</span>
                        <span className="font-medium text-gray-900 text-right text-xs max-w-32 truncate" title={formData.commercialModel}>
                          {formData.commercialModel}
                        </span>
                      </div>
                    )}

                    {/* Potential Volume */}
                    {formData.potentialVolume > 0 && (
                      <div className="flex items-center justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Potential Volume</span>
                        <span className="font-medium text-gray-900">
                          {formData.potentialVolume.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* iOL Products */}
                    {formData.iolProducts.length > 0 && (
                      <div className="py-1 border-b border-gray-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-600">iOL Products</span>
                          <span className="text-xs text-gray-500">
                            {formData.iolProducts.length} selected
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {formData.iolProducts.slice(0, 3).map(product => (
                            <span key={product} className="inline-block px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                              {product.replace('iOL ', '')}
                            </span>
                          ))}
                          {formData.iolProducts.length > 3 && (
                            <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                              +{formData.iolProducts.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    {!isNew && (
                      <div className="pt-2">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-gray-500">Created</span>
                            <div className="font-medium text-gray-900">
                              {opportunity?.createdAt ? format(opportunity.createdAt.toDate(), 'MMM d, yyyy') : 'N/A'}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Last Updated</span>
                            <div className="font-medium text-gray-900">
                              {opportunity?.updatedAt ? format(opportunity.updatedAt.toDate(), 'MMM d, yyyy') : 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Commercial Information - Editable Section */}
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="h-4 w-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Commercial Details</h2>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Commercial Model</label>
                      <select
                        value={formData.commercialModel}
                        onChange={(e) => setFormData({ ...formData, commercialModel: e.target.value })}
                        className="w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      >
                        <option value="">Select Model</option>
                        {COMMERCIAL_MODELS.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Potential Volume</label>
                      <input
                        type="number"
                        min="0"
                        value={formData.potentialVolume}
                        onChange={(e) => setFormData({ ...formData, potentialVolume: parseInt(e.target.value) || 0 })}
                        className="w-full text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="# of hotels, bookings/month..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Deal Value</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                          <DollarSign className="h-3 w-3 text-gray-400" />
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={formData.estimatedDealValue}
                          onChange={(e) => setFormData({ ...formData, estimatedDealValue: parseFloat(e.target.value) || 0 })}
                          className="w-full text-xs pl-6 border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          placeholder="Annual contract value..."
                        />
                      </div>
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
                            onClick={() => handleRemoveContact(contact.id || '')}
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
                  {allSuggestedContacts.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowSuggestedContacts(!showSuggestedContacts)}
                        className="w-full text-xs text-gray-600 hover:text-gray-800 py-2 border-t border-gray-200 transition-colors"
                      >
                        {showSuggestedContacts ? 'Hide' : 'Show'} suggestions ({allSuggestedContacts.length})
                      </button>
                      
                      {showSuggestedContacts && (
                        <div className="mt-2 space-y-1">
                          {allSuggestedContacts.map((contact) => {
                            const isFromAccount = contact.accountId === formData.accountId;
                            return (
                              <div 
                                key={contact.id} 
                                className={`rounded-lg p-2 border relative ${
                                  isFromAccount ? 'bg-gray-50 border-gray-200' : 'bg-green-50 border-green-200'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleAddContact(contact.id || '')}
                                  className={`absolute top-1 right-1 ${
                                    isFromAccount ? 'text-gray-400 hover:text-gray-600' : 'text-green-400 hover:text-green-600'
                                  }`}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                                <Link
                                  to={`/contacts/${contact.id}`}
                                  className={`text-xs font-medium block truncate pr-4 ${
                                    isFromAccount 
                                      ? 'text-gray-900 hover:text-primary-600' 
                                      : 'text-green-900 hover:text-green-700'
                                  }`}
                                >
                                  {contact.name}
                                </Link>
                                <p className={`text-xs mt-0.5 ${
                                  isFromAccount ? 'text-gray-600' : 'text-green-700'
                                }`}>
                                  {isFromAccount ? 'From Account' : 'From Product'} • {contact.position || 'No title'}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Empty state */}
                  {allSuggestedContacts.length === 0 && directContacts.length === 0 && (
                    <p className="text-xs text-gray-500 italic">
                      Select an account to see contacts
                    </p>
                  )}
                </div>

                {/* Tags */}
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-gray-500" />
                    <h2 className="text-base font-medium text-gray-900">Tags</h2>
                  </div>
                  
                  {/* Display tags */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {formData.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-blue-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Add new tag */}
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
                      className="px-2 py-1.5 text-gray-400 hover:text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Checklist */}
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-gray-500" />
                      <h2 className="text-base font-medium text-gray-900">
                        Checklist ({formData.checklist.filter(item => !item.completed).length})
                      </h2>
                    </div>
                    {formData.checklist.filter(item => item.completed).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowCompletedChecklist(!showCompletedChecklist)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        {showCompletedChecklist ? 'Hide' : 'Show'} completed ({formData.checklist.filter(item => item.completed).length})
                      </button>
                    )}
                  </div>

                  {/* Add new checklist item */}
                  <div className="flex gap-1.5 mb-3">
                    <input
                      type="text"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddChecklistItem())}
                      className="flex-1 text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Add checklist item..."
                    />
                    <button
                      type="button"
                      onClick={handleAddChecklistItem}
                      className="px-2 py-1.5 text-gray-400 hover:text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Pending checklist items */}
                  <div className="space-y-2">
                    {formData.checklist
                      .filter(item => !item.completed)
                      .map((item) => (
                        <div key={item.id} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                          <button
                            type="button"
                            onClick={() => handleToggleChecklistItem(item.id)}
                            className="mt-0.5 w-4 h-4 border-2 border-gray-300 rounded hover:border-green-500 focus:outline-none focus:border-green-500 transition-colors"
                          >
                            <span className="sr-only">Mark as complete</span>
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 break-words">{item.text}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Added {format(item.createdAt.toDate(), 'MMM d, yyyy')}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveChecklistItem(item.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                  </div>

                  {/* Completed checklist items (collapsible) */}
                  {showCompletedChecklist && formData.checklist.filter(item => item.completed).length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <div className="space-y-2">
                        {formData.checklist
                          .filter(item => item.completed)
                          .map((item) => (
                            <div key={item.id} className="flex items-start gap-2 p-2 bg-green-50 rounded-lg border border-green-200 opacity-75">
                              <button
                                type="button"
                                onClick={() => handleToggleChecklistItem(item.id)}
                                className="mt-0.5 w-4 h-4 bg-green-500 border-2 border-green-500 rounded text-white flex items-center justify-center hover:bg-green-600 focus:outline-none transition-colors"
                              >
                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-700 line-through break-words">{item.text}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                  Completed {item.completedAt ? format(item.completedAt.toDate(), 'MMM d, yyyy') : 'recently'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveChecklistItem(item.id)}
                                className="text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {formData.checklist.length === 0 && (
                    <div className="text-center py-4">
                      <CheckSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No checklist items yet</p>
                      <p className="text-xs text-gray-400">Add items to track progress</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </form>
        </div>
      </div>

      {/* Floating Save Button */}
      <button
        type="submit"
        form="opportunity-form"
        disabled={saving || !formData.title.trim() || !formData.accountId}
        onClick={() => {
          console.log('🔥 Save button clicked!');
          console.log('💾 Button disabled?', saving || !formData.title.trim() || !formData.accountId);
          console.log('📊 Validation:', { 
            saving, 
            hasTitle: !!formData.title.trim(), 
            hasAccount: !!formData.accountId 
          });
        }}
        className="fixed bottom-4 right-4 bg-primary-600 text-white p-3 rounded-full shadow-lg hover:bg-primary-700 focus:outline-none focus:ring-4 focus:ring-primary-500 focus:ring-opacity-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed z-50"
        title={saving ? 'Saving...' : 'Save Opportunity'}
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