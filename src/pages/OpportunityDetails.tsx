import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Trash2,
  Target,
  Building2,
  Users,
  Package,
  Plus,
  X,
  Calendar,
  CheckSquare,
  Clock,
  MessageSquare,
  Video,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Globe,
  User,
  Edit3,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  MoreVertical,
  CheckCircle2,
  Circle,
  AlertTriangle,
  UserPlus,
  Activity,
  TrendingUp,
  DollarSign,
  FileText
} from 'lucide-react';
import type { 
  Opportunity, 
  OpportunityStage, 
  OpportunityPriority,
  Account, 
  Contact, 
  Product,
  Activity as ActivityType,
  ActivityStatus,
  ChecklistItem
} from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { OwnerSelect } from '../components/OwnerSelect';
import { ActivityManager } from '../components/ActivityManager';
import { AISummary } from '../components/AISummary';
import { useActivityManager } from '../hooks/useActivityManager';
import { useOpportunitiesApi } from '../hooks/useOpportunitiesApi';
import { useContactsApi } from '../hooks/useContactsApi';
import { useDataContext } from '../context/DataContext';

const OPPORTUNITY_STAGES: OpportunityStage[] = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed-Won', 'Closed-Lost'];
const OPPORTUNITY_PRIORITIES: OpportunityPriority[] = ['Critical', 'High', 'Medium', 'Low'];

const IOL_PRODUCTS = [
  'iOL X Demand',
  'iOL X Supply',
  'iOL X Exchange',
  'iOL Pulse',
  'iOL Pay Issuing',
  'iOL Pay Acquiring',
  'iOL Pay Payment Gateway',
  'iOL Pay Automate'
];

const ACTIVITY_TYPES = ['Meeting', 'Email', 'Call', 'WhatsApp', 'Demo', 'Workshop'];
const ACTIVITY_METHODS = ['In-person', 'Zoom', 'Phone', 'Teams', 'Email'];
const ACTIVITY_PRIORITIES = ['High', 'Medium', 'Low'];

const COMMERCIAL_MODELS = [
  'SaaS - Software as a Service',
  'License - One-time License',
  'Subscription - Monthly/Annual',
  'Revenue Share',
  'Commission Based',
  'Freemium',
  'Custom/Enterprise',
  'Other'
];

export const OpportunityDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const isNew = id === 'new' || !id;
  
  // DataContext for cached data
  const { 
    cache,
    loading: dataContextLoading,
    refreshData
  } = useDataContext();
  
  // API hooks for CRUD operations only
  const { 
    getOpportunity, 
    createOpportunity, 
    updateOpportunity, 
    deleteOpportunity,
    loading: opportunitiesLoading 
  } = useOpportunitiesApi();
  
  const { 
    createContact,
    loading: contactsLoading 
  } = useContactsApi();

  // Get cached data
  const accounts = cache?.accounts || [];
  const contacts = cache?.contacts || [];
  const products = cache?.products || [];
  
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    accountId: '',
    productId: '',
    contactIds: [] as string[],
    stage: 'Lead' as OpportunityStage,
    priority: 'Medium' as OpportunityPriority,
    iolProducts: [] as string[],
    notes: '',
    tags: [] as string[],
    activities: [] as ActivityType[],
    checklist: [] as ChecklistItem[],
    blockers: [] as ChecklistItem[],
    commercialModel: '',
    potentialVolume: 0,
    estimatedDealValue: 0,
    expectedCloseDate: null as Date | null,
    ownerId: currentUser?.uid || ''
  });

  // New item forms
  const [newTag, setNewTag] = useState('');
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activitiesDisplayCount, setActivitiesDisplayCount] = useState(5); // For pagination
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [showCompletedChecklist, setShowCompletedChecklist] = useState(false);
  const [newBlockerItem, setNewBlockerItem] = useState('');
  const [showCompletedBlockers, setShowCompletedBlockers] = useState(false);
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

  // AI Summary state
  const [localAiSummary, setLocalAiSummary] = useState<string>('');

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

  // Helper function to get stage color
  const getStageColor = (stage: OpportunityStage) => {
    const colors = {
      'Lead': 'bg-gray-100 text-gray-800 border-gray-200',
      'Qualified': 'bg-blue-100 text-blue-800 border-blue-200',
      'Proposal': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Negotiation': 'bg-orange-100 text-orange-800 border-orange-200',
      'Closed-Won': 'bg-green-100 text-green-800 border-green-200',
      'Closed-Lost': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[stage];
  };

  // Helper function to get priority color
  const getPriorityColor = (priority: OpportunityPriority) => {
    const colors = {
      'Critical': 'bg-red-100 text-red-800 border-red-200',
      'High': 'bg-orange-100 text-orange-800 border-orange-200',
      'Medium': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'Low': 'bg-green-100 text-green-800 border-green-200'
    };
    return colors[priority];
  };

  // Helper function to safely convert various date formats to Date object
  const safeDateConversion = (dateValue: any): Date => {
    try {
      // Handle Firestore Timestamp
      if (dateValue && typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
      }
      
      // Handle Cloud Functions format {_seconds: number, _nanoseconds: number}
      if (dateValue && typeof dateValue._seconds === 'number') {
        return new Date(dateValue._seconds * 1000);
      }
      
      // Handle legacy format {seconds: number, nanoseconds: number}
      if (dateValue && typeof dateValue.seconds === 'number') {
        return new Date(dateValue.seconds * 1000);
      }
      
      // Handle Date objects
      if (dateValue instanceof Date) {
        return dateValue;
      }
      
      // Handle date strings
      if (typeof dateValue === 'string') {
        return new Date(dateValue);
      }
      
      // Fallback to current date
      console.warn('Unable to parse date value:', dateValue);
      return new Date();
    } catch (error) {
      console.error('Date conversion error:', error, dateValue);
      return new Date();
    }
  };

  const handleEditActivity = (activity: ActivityType) => {
    setActivityForm({
      activityType: activity.activityType,
      dateTime: safeDateConversion(activity.dateTime),
      relatedContactIds: activity.relatedContactIds || [],
      method: activity.method,
      subject: activity.subject,
      notes: activity.notes || '',
      assignedTo: activity.assignedTo || 'current-user',
      status: activity.status,
      priority: activity.priority || 'Medium',
    });
    setEditingActivityId(activity.id);
    setShowActivityForm(true);
  };

  const autoSaveActivities = async (activities: ActivityType[]) => {
    if (!isNew && id) {
      // Remove undefined/null activities and undefined properties
      const sanitized = activities
        .filter(a => !!a && typeof a === 'object')
        .map(a => {
          const clean: any = {};
          Object.entries(a).forEach(([k, v]) => {
            if (v !== undefined) clean[k] = v;
          });
          return clean;
        });
      await updateOpportunity(id, { activities: sanitized });
      // Invalidate opportunities cache to ensure fresh data
      await refreshData('opportunities');
      // Don't fetch back from Firestore - trust the local state which is already updated
    }
  };

  const handleSaveActivity = async () => {
    if (!activityForm.subject.trim()) {
      alert('Subject is required');
      return;
    }
    const now = Timestamp.now();
    const userId = currentUser?.uid || 'system';
    const activityId = editingActivityId || Math.random().toString(36).substr(2, 9);
    const newActivity: ActivityType = {
      // First, preserve existing data for optional fields like completedAt, followUpDate, etc.
      ...(editingActivityId ? formData.activities.find(a => a.id === editingActivityId) : {}),
      // Then override with the new form data
      id: activityId,
      activityType: activityForm.activityType,
      dateTime: Timestamp.fromDate(
        activityForm.dateTime instanceof Date ? activityForm.dateTime : new Date(activityForm.dateTime)
      ),
      relatedContactIds: activityForm.relatedContactIds || [],
      method: activityForm.method,
      subject: activityForm.subject,
      notes: activityForm.notes || '',
      assignedTo: activityForm.assignedTo || userId,
      attachments: [],
      followUpNeeded: false,
      status: activityForm.status,
      createdAt: editingActivityId
        ? (formData.activities.find(a => a.id === editingActivityId)?.createdAt || now)
        : now,
      createdBy: editingActivityId
        ? (formData.activities.find(a => a.id === editingActivityId)?.createdBy || userId)
        : userId,
      updatedAt: now,
      updatedBy: userId,
      priority: activityForm.priority || 'Medium',
    };
    
    const updatedActivities = editingActivityId
      ? formData.activities.map(a => a.id === editingActivityId ? newActivity : a)
      : [...formData.activities, newActivity];
    
    setFormData(prev => ({ ...prev, activities: updatedActivities }));
    setEditingActivityId(null);
    setShowActivityForm(false);
    setActivityForm({
      activityType: 'Meeting',
      dateTime: new Date(),
      relatedContactIds: [],
      method: 'In-person',
      subject: '',
      notes: '',
      assignedTo: userId,
      status: 'Scheduled',
      priority: 'Medium',
    });
    await autoSaveActivities(updatedActivities);
  };

  const handleCompleteActivity = (activityId: string) => {
    const activity = formData.activities.find(a => a.id === activityId);
    const account = accounts.find(a => a.id === formData.accountId);
    
    if (activity && account && opportunity) {
      activityManager.openActivityCompletion(
        activity,
        opportunity.id,
        opportunity.title,
        account.name
      );
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    const updatedActivities = formData.activities.filter(a => a.id !== activityId);
    setFormData(prev => ({ ...prev, activities: updatedActivities }));
    await autoSaveActivities(updatedActivities);
  };

  useEffect(() => {
    // Set default owner for new opportunities
    if (isNew && currentUser?.uid && !formData.ownerId) {
      setFormData(prev => ({ ...prev, ownerId: currentUser.uid }));
    }
  }, [isNew, currentUser?.uid, formData.ownerId]);

  // Load data when component mounts
  // DataContext automatically loads data, no need for manual fetching

  // Memoized filtered data to prevent unnecessary re-renders
  const { availableContacts, assignedContacts, suggestedContacts } = useMemo(() => {
    const available = contacts.filter(c => 
      !formData.accountId || c.accountId === formData.accountId
    );
    const assigned = contacts.filter(c => formData.contactIds.includes(c.id || ''));
    const suggested = available.filter(c => 
      !formData.contactIds.includes(c.id || '')
    );
    
    console.log('OpportunityDetails: Contacts filtering', {
      totalContacts: contacts.length,
      accountId: formData.accountId,
      contactIds: formData.contactIds,
      available: available.length,
      assigned: assigned.length,
      suggested: suggested.length
    });
    
    return { availableContacts: available, assignedContacts: assigned, suggestedContacts: suggested };
  }, [contacts, formData.accountId, formData.contactIds]);

  const account = useMemo(() => {
    const foundAccount = accounts.find(a => a.id === formData.accountId);
    console.log('OpportunityDetails: Account lookup', { 
      accountId: formData.accountId, 
      foundAccount: foundAccount?.name, 
      totalAccounts: accounts.length 
    });
    return foundAccount;
  }, [accounts, formData.accountId]);
  
  const product = useMemo(() => {
    const foundProduct = products.find(p => p.id === formData.productId);
    console.log('OpportunityDetails: Product lookup', { 
      productId: formData.productId, 
      foundProduct: foundProduct?.name, 
      totalProducts: products.length 
    });
    return foundProduct;
  }, [products, formData.productId]);

  // Optimized data fetching - fetch opportunity first, then related data
  const fetchOpportunityData = useCallback(async () => {
    if (isNew) {
      setLoading(false);
      return;
    }
    
    try {
      // Fetch opportunity first for immediate content
      if (id && id !== 'new') {
        const opportunityData = await getOpportunity(id);
        if (opportunityData) {
          const opportunityTyped = opportunityData as Opportunity;
          setOpportunity(opportunityTyped);
          setFormData({
            title: opportunityTyped.title,
            summary: opportunityTyped.summary,
            accountId: opportunityTyped.accountId,
            productId: opportunityTyped.productId || '',
            contactIds: opportunityTyped.contactIds || [],
            stage: opportunityTyped.stage,
            priority: opportunityTyped.priority,
            iolProducts: opportunityTyped.iolProducts || [],
            notes: opportunityTyped.notes,
            tags: opportunityTyped.tags || [],
            activities: opportunityTyped.activities || [],
            checklist: opportunityTyped.checklist || [],
            blockers: opportunityTyped.blockers || [],
            commercialModel: opportunityTyped.commercialModel || '',
            potentialVolume: opportunityTyped.potentialVolume || 0,
            estimatedDealValue: opportunityTyped.estimatedDealValue || 0,
            expectedCloseDate: opportunityTyped.expectedCloseDate ? safeDateConversion(opportunityTyped.expectedCloseDate) : null,
            ownerId: opportunityTyped.ownerId || currentUser?.uid || ''
          });
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching opportunity:', error);
      setLoading(false);
    }
  }, [id, isNew, currentUser?.uid]);

  // Update loading state when all data is loaded from DataContext
  useEffect(() => {
    if (!dataContextLoading?.accounts && !dataContextLoading?.contacts && !dataContextLoading?.products && !contactsLoading && 
        accounts.length >= 0 && contacts.length >= 0 && products.length >= 0) {
      setDataLoading(false);
    }
  }, [dataContextLoading, contactsLoading, accounts.length, contacts.length, products.length]);

  // Unified activity management
  const activityManager = useActivityManager({ 
    opportunities: opportunity ? [opportunity] : [], 
    onDataRefresh: async () => {
      await fetchOpportunityData();
      await refreshData('opportunities');
    },
    updateOpportunity
  });

  useEffect(() => {
    fetchOpportunityData();
  }, [fetchOpportunityData]);

  // Sync AI summary local state with opportunity data
  useEffect(() => {
    if (opportunity?.aiSummary) {
      setLocalAiSummary(opportunity.aiSummary);
    }
  }, [opportunity?.aiSummary]);

  // No longer needed as data is auto-loaded by hooks

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // Clean data to remove undefined values
      const cleanData = Object.fromEntries(
        Object.entries(formData).filter(([key, value]) => {
          // Keep empty arrays and zero values, but remove undefined/null
          if (key === 'expectedCloseDate') {
            return value !== null; // Allow null for optional dates
          }
          return value !== undefined && value !== '';
        })
      );

      const submitData = {
        ...cleanData,
        expectedCloseDate: formData.expectedCloseDate ? Timestamp.fromDate(formData.expectedCloseDate) : null,
        lastActivityDate: formData.activities.length > 0 
          ? formData.activities.sort((a, b) => {
            try {
              const timeA = (a.dateTime as any)?.toMillis ? (a.dateTime as any).toMillis() : new Date(a.dateTime).getTime();
              const timeB = (b.dateTime as any)?.toMillis ? (b.dateTime as any).toMillis() : new Date(b.dateTime).getTime();
              return timeB - timeA;
            } catch (error) {
              console.error('Date sorting error:', error);
              return 0;
            }
          })[0].dateTime 
          : null,
        createdAt: isNew ? Timestamp.now() : opportunity?.createdAt,
        updatedAt: Timestamp.now()
      };

      if (isNew || !id) {
        const newOpportunity = await createOpportunity(submitData);
        console.log('Opportunity created:', newOpportunity);
        // Invalidate opportunities cache to ensure fresh data
        await refreshData('opportunities');
        navigate('/opportunities');
      } else {
        const updatedOpportunity = await updateOpportunity(id, submitData);
        console.log('Opportunity updated:', updatedOpportunity);
        setOpportunity(updatedOpportunity);
        // Invalidate opportunities cache to ensure fresh data
        await refreshData('opportunities');
      }
    } catch (error) {
      console.error('Error saving opportunity:', error);
      alert('Error saving opportunity. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (opportunity && id && confirm('Are you sure you want to delete this opportunity?')) {
      try {
        await deleteOpportunity(id);
        // Invalidate opportunities cache to ensure fresh data
        await refreshData('opportunities');
        navigate('/opportunities');
      } catch (error) {
        console.error('Error deleting opportunity:', error);
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
          contactType: 'Primary' as any,
          productIds: [],
          ownerId: currentUser?.uid || '',
          createdAt: Timestamp.now()
        };
        
        const newContactResponse = await createContact(contactData);
        
        // Invalidate contacts cache to ensure fresh data
        await refreshData('contacts');
        
        // Add new contact to opportunity
        handleContactToggle(newContactResponse.id);
        
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

  // Handler for AI summary updates
  const handleAiSummaryUpdate = (summary: string) => {
    setLocalAiSummary(summary);
    // Optionally trigger a refresh of the opportunity data
    if (id) {
      fetchOpportunityData();
    }
  };

  const handleIolProductToggle = (product: string) => {
    const newProducts = formData.iolProducts.includes(product)
      ? formData.iolProducts.filter(p => p !== product)
      : [...formData.iolProducts, product];
    
    setFormData({ ...formData, iolProducts: newProducts });
  };

  const handleAddChecklistItem = () => {
    if (newChecklistItem.trim()) {
      const newItem = {
        id: Date.now().toString(),
        title: newChecklistItem.trim(),
        text: newChecklistItem.trim(),
        completed: false,
        createdAt: Timestamp.now(),
      };
      setFormData({
        ...formData,
        checklist: [...formData.checklist, newItem]
      });
      setNewChecklistItem('');
    }
  };

  const handleToggleChecklistItem = (itemId: string) => {
    setFormData({
      ...formData,
      checklist: formData.checklist.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed, completedAt: !item.completed ? Timestamp.now() : undefined } : item
      )
    });
  };

  const handleRemoveChecklistItem = (itemId: string) => {
    setFormData({
        ...formData,
      checklist: formData.checklist.filter(item => item.id !== itemId)
    });
  };

  const handleAddBlockerItem = () => {
    if (newBlockerItem.trim()) {
      const newItem = {
        id: Date.now().toString(),
        title: newBlockerItem.trim(),
        text: newBlockerItem.trim(),
        completed: false,
        createdAt: Timestamp.now(),
      };
      setFormData({
        ...formData,
        blockers: [...formData.blockers, newItem]
      });
      setNewBlockerItem('');
    }
  };

  const handleToggleBlockerItem = (itemId: string) => {
    setFormData({
      ...formData,
      blockers: formData.blockers.map(item =>
        item.id === itemId ? { ...item, completed: !item.completed, completedAt: !item.completed ? Timestamp.now() : undefined } : item
      )
    });
  };

  const handleRemoveBlockerItem = (itemId: string) => {
    setFormData({
      ...formData,
      blockers: formData.blockers.filter(item => item.id !== itemId)
    });
  };

  // ... Rest of existing functions for activities and checklist

  // Early return with skeleton UI for better LCP
  if (loading) {
    return (
      <div className="h-full overflow-auto bg-gray-50">
        <div className="p-6">
          {/* Header Skeleton */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
              <div className="w-48 h-8 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="w-24 h-10 bg-gray-200 rounded animate-pulse"></div>
          </div>

          {/* Content Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content Skeleton */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="space-y-4">
                  <div className="w-full h-6 bg-gray-200 rounded animate-pulse"></div>
                  <div className="w-3/4 h-6 bg-gray-200 rounded animate-pulse"></div>
                  <div className="w-1/2 h-6 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="space-y-4">
                  <div className="w-full h-6 bg-gray-200 rounded animate-pulse"></div>
                  <div className="w-full h-32 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            </div>

            {/* Sidebar Skeleton */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="space-y-4">
                  <div className="w-32 h-6 bg-gray-200 rounded animate-pulse"></div>
                  <div className="w-full h-8 bg-gray-200 rounded animate-pulse"></div>
                  <div className="w-3/4 h-6 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
              {account && (
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
                    
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">iOL Products</label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 border border-gray-200 rounded-md p-2.5 bg-gray-50">
                        {IOL_PRODUCTS.map((product) => (
                          <label key={product} className="flex items-center text-xs">
                            <input
                              type="checkbox"
                              checked={formData.iolProducts.includes(product)}
                              onChange={() => handleIolProductToggle(product)}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-1.5"
                            />
                            <span className="text-gray-700">
                              {product}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Select the iOL products you plan to offer for this opportunity
                      </p>
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
                        required
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
                        required
                      >
                        {OPPORTUNITY_PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <OwnerSelect
                        value={formData.ownerId}
                        onChange={(ownerId) => setFormData({ ...formData, ownerId })}
                        label="Opportunity Owner"
                        required
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
                        placeholder="Brief summary of the opportunity..."
                        required
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
                          onClick={() => {
                            setShowActivityForm(false);
                            setEditingActivityId(null);
                          }}
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
                            handleSaveActivity();
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
                          <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                          <input
                            type="date"
                            value={activityForm.dateTime.toISOString().split('T')[0]}
                            onChange={(e) => {
                              const currentTime = activityForm.dateTime;
                              const newDate = new Date(e.target.value);
                              newDate.setHours(currentTime.getHours(), currentTime.getMinutes());
                              setActivityForm({ ...activityForm, dateTime: newDate });
                            }}
                            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-iol-red focus:border-transparent bg-white shadow-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                          <input
                            type="time"
                            value={activityForm.dateTime.toTimeString().slice(0, 5)}
                            onChange={(e) => {
                              const currentDate = new Date(activityForm.dateTime);
                              const [hours, minutes] = e.target.value.split(':');
                              currentDate.setHours(parseInt(hours), parseInt(minutes));
                              setActivityForm({ ...activityForm, dateTime: currentDate });
                            }}
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
                            {assignedContacts.map(contact => (
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
                              onClick={() => {
                                setShowActivityForm(false);
                                setEditingActivityId(null);
                              }}
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
                              // Sort by dateTime descending (newest first)
                              try {
                                const dateA = safeDateConversion(a.dateTime);
                                const dateB = safeDateConversion(b.dateTime);
                                return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
                              } catch (error) {
                                console.error('Date sorting error:', error, { 
                                  activityA: a.id, 
                                  activityB: b.id,
                                  dateTimeA: a.dateTime,
                                  dateTimeB: b.dateTime
                                });
                                return 0;
                              }
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

                                                  const isOverdue = activity.status === 'Scheduled' && (() => {
                      try {
                        const date = safeDateConversion(activity.dateTime);
                        return date < new Date();
                      } catch (error) {
                        console.error('Date comparison error:', error, activity.dateTime);
                        return false;
                      }
                    })();
                    const isToday = (() => {
                      try {
                        const date = safeDateConversion(activity.dateTime);
                        return format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                      } catch (error) {
                        console.error('Date formatting error:', error, activity.dateTime);
                        return false;
                      }
                    })();
                              
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
                                            {(() => {
                                try {
                                  const date = safeDateConversion(activity.dateTime);
                                  return format(date, 'MMM d, yyyy • h:mm a');
                                } catch (error) {
                                  console.error('Date formatting error:', error, activity.dateTime);
                                  return 'N/A';
                                }
                              })()}
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
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            <span>
                                              Completed: {(() => {
                                try {
                                  const date = safeDateConversion(activity.completedAt);
                                  return format(date, 'MMM d, yyyy • h:mm a');
                                } catch (error) {
                                  console.error('Date formatting error:', error, activity.completedAt);
                                  return 'N/A';
                                }
                              })()}
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
                                            <CheckCircle2 className="h-3.5 w-3.5" />
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

                  {/* AI Executive Summary */}
                  {!isNew && opportunity && (
                    <AISummary 
                      opportunity={{
                        ...opportunity,
                        aiSummary: localAiSummary || opportunity.aiSummary
                      }}
                      onSummaryUpdate={handleAiSummaryUpdate}
                    />
                  )}

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
                              {opportunity?.createdAt ? (() => {
                        try {
                          const date = safeDateConversion(opportunity.createdAt);
                          return format(date, 'MMM d, yyyy');
                        } catch (error) {
                          console.error('Date formatting error:', error, opportunity.createdAt);
                          return 'N/A';
                        }
                      })() : 'N/A'}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Last Updated</span>
                            <div className="font-medium text-gray-900">
                              {opportunity?.updatedAt ? (() => {
                        try {
                          const date = safeDateConversion(opportunity.updatedAt);
                          return format(date, 'MMM d, yyyy');
                        } catch (error) {
                          console.error('Date formatting error:', error, opportunity.updatedAt);
                          return 'N/A';
                        }
                      })() : 'N/A'}
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
                        Contacts ({assignedContacts.length})
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
                  {assignedContacts.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {assignedContacts.map((contact) => (
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
                  {suggestedContacts.length > 0 && (
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowSuggestedContacts(!showSuggestedContacts)}
                        className="w-full text-xs text-gray-600 hover:text-gray-800 py-2 border-t border-gray-200 transition-colors"
                      >
                        {showSuggestedContacts ? 'Hide' : 'Show'} suggestions ({suggestedContacts.length})
                      </button>
                      
                      {showSuggestedContacts && (
                        <div className="mt-2 space-y-1">
                          {suggestedContacts.map((contact) => {
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
                                  onClick={() => handleContactToggle(contact.id || '')}
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
                  {suggestedContacts.length === 0 && assignedContacts.length === 0 && (
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
                              Added {(() => {
                              try {
                                const date = safeDateConversion(item.createdAt);
                                return format(date, 'MMM d, yyyy');
                              } catch (error) {
                                console.error('Date formatting error:', error, item.createdAt);
                                return 'N/A';
                              }
                            })()}
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
                                  Completed {item.completedAt ? (() => {
                              try {
                                const date = safeDateConversion(item.completedAt);
                                return format(date, 'MMM d, yyyy');
                              } catch (error) {
                                console.error('Date formatting error:', error, item.completedAt);
                                return 'N/A';
                              }
                            })() : 'recently'}
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

                {/* Blockers */}
                <div className="bg-white shadow rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <h2 className="text-base font-medium text-gray-900">
                        Blockers ({formData.blockers.filter(item => !item.completed).length})
                      </h2>
                    </div>
                    {formData.blockers.filter(item => item.completed).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowCompletedBlockers(!showCompletedBlockers)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        {showCompletedBlockers ? 'Hide' : 'Show'} resolved ({formData.blockers.filter(item => item.completed).length})
                      </button>
                    )}
                  </div>

                  {/* Add new blocker item */}
                  <div className="flex gap-1.5 mb-3">
                    <input
                      type="text"
                      value={newBlockerItem}
                      onChange={(e) => setNewBlockerItem(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBlockerItem())}
                      className="flex-1 text-sm border border-red-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="Add blocker or issue..."
                    />
                    <button
                      type="button"
                      onClick={handleAddBlockerItem}
                      className="px-2 py-1.5 text-red-500 hover:text-red-600 border border-red-300 rounded-md hover:bg-red-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Active blockers */}
                  <div className="space-y-2">
                    {formData.blockers
                      .filter(item => !item.completed)
                      .map((item) => (
                        <div key={item.id} className="flex items-start gap-2 p-2 bg-red-50 rounded-lg border border-red-200">
                          <button
                            type="button"
                            onClick={() => handleToggleBlockerItem(item.id)}
                            className="mt-0.5 w-4 h-4 border-2 border-red-400 rounded hover:border-red-500 focus:outline-none focus:border-red-500 transition-colors"
                          >
                            <span className="sr-only">Mark as resolved</span>
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-red-900 break-words font-medium">{item.text}</p>
                            <p className="text-xs text-red-700 mt-1">
                              Added {(() => {
                              try {
                                const date = safeDateConversion(item.createdAt);
                                return format(date, 'MMM d, yyyy');
                              } catch (error) {
                                console.error('Date formatting error:', error, item.createdAt);
                                return 'N/A';
                              }
                            })()}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveBlockerItem(item.id)}
                            className="text-red-400 hover:text-red-600 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                  </div>

                  {/* Resolved blockers (collapsible) */}
                  {showCompletedBlockers && formData.blockers.filter(item => item.completed).length > 0 && (
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      <div className="space-y-2">
                        {formData.blockers
                          .filter(item => item.completed)
                          .map((item) => (
                            <div key={item.id} className="flex items-start gap-2 p-2 bg-green-50 rounded-lg border border-green-200 opacity-75">
                              <button
                                type="button"
                                onClick={() => handleToggleBlockerItem(item.id)}
                                className="mt-0.5 w-4 h-4 bg-green-500 border-2 border-green-500 rounded text-white flex items-center justify-center hover:bg-green-600 focus:outline-none transition-colors"
                              >
                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-700 line-through break-words">{item.text}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                  Resolved {item.completedAt ? (() => {
                              try {
                                const date = safeDateConversion(item.completedAt);
                                return format(date, 'MMM d, yyyy');
                              } catch (error) {
                                console.error('Date formatting error:', error, item.completedAt);
                                return 'N/A';
                              }
                            })() : 'recently'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveBlockerItem(item.id)}
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
                  {formData.blockers.length === 0 && (
                    <div className="text-center py-4">
                      <AlertTriangle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No blockers identified</p>
                      <p className="text-xs text-gray-400">Track issues that may prevent progress</p>
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
      
      {/* Unified Activity Completion Modal */}
      {activityManager.activeActivity && activityManager.activityContext && (
        <ActivityManager
          activity={activityManager.activeActivity}
          opportunityId={activityManager.activityContext.opportunityId}
          opportunityTitle={activityManager.activityContext.opportunityTitle}
          accountName={activityManager.activityContext.accountName}
          onComplete={activityManager.completeActivity}
          onCancel={activityManager.closeActivityCompletion}
          isOpen={activityManager.isModalOpen}
        />
      )}
    </div>
  );
}; 