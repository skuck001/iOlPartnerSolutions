import { useState, useEffect, useCallback } from 'react';
import type { Contact, ContactType } from '../types/Contact';
import { useApi } from './useApi';

export interface ContactFilters {
  accountId?: string;
  contactType?: ContactType;
  search?: string;
  region?: string;
  position?: string;
}

export interface ContactsQueryOptions {
  filters?: ContactFilters;
  sortBy?: 'name' | 'email' | 'position' | 'contactType' | 'lastContactDate' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ContactsResponse {
  contacts: Contact[];
  total: number;
  hasMore: boolean;
}

export interface ContactStats {
  total: number;
  byType: Record<ContactType, number>;
  byRegion: Record<string, number>;
  activeThisMonth: number;
  newThisWeek: number;
}

export const useContactsApi = () => {
  const { callFunction, loading, error } = useApi();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);

  // Get contacts with filtering and pagination
  const getContacts = useCallback(async (options: ContactsQueryOptions = {}) => {
    try {
      const response = await callFunction('getContacts', options);
      return response.data as ContactsResponse;
    } catch (err) {
      console.error('Error getting contacts:', err);
      throw err;
    }
  }, [callFunction]);

  // Get single contact
  const getContact = useCallback(async (contactId: string): Promise<Contact> => {
    try {
      const response = await callFunction('getContact', { contactId });
      return response.data as Contact;
    } catch (err) {
      console.error('Error getting contact:', err);
      throw err;
    }
  }, [callFunction]);

  // Create new contact
  const createContact = useCallback(async (contactData: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contact> => {
    try {
      const response = await callFunction('createContact', contactData);
      const newContact = response.data as Contact;
      
      // Update local state
      setContacts(prev => [newContact, ...prev]);
      
      return newContact;
    } catch (err) {
      console.error('Error creating contact:', err);
      throw err;
    }
  }, [callFunction]);

  // Update contact
  const updateContact = useCallback(async (contactId: string, updates: Partial<Contact>): Promise<Contact> => {
    try {
      const response = await callFunction('updateContact', {
        contactId,
        updates
      });
      const updatedContact = response.data as Contact;
      
      // Update local state
      setContacts(prev => prev.map(contact => 
        contact.id === contactId ? updatedContact : contact
      ));
      
      return updatedContact;
    } catch (err) {
      console.error('Error updating contact:', err);
      throw err;
    }
  }, [callFunction]);

  // Delete contact
  const deleteContact = useCallback(async (contactId: string): Promise<void> => {
    try {
      await callFunction('deleteContact', { contactId });
      
      // Update local state
      setContacts(prev => prev.filter(contact => contact.id !== contactId));
    } catch (err) {
      console.error('Error deleting contact:', err);
      throw err;
    }
  }, [callFunction]);

  // Get contacts statistics
  const getContactsStats = useCallback(async (filters: ContactFilters = {}): Promise<ContactStats> => {
    try {
      const response = await callFunction('getContactsStats', filters);
      const statsData = response.data as ContactStats;
      setStats(statsData);
      return statsData;
    } catch (err) {
      console.error('Error getting contacts stats:', err);
      throw err;
    }
  }, [callFunction]);

  // Bulk update contacts
  const bulkUpdateContacts = useCallback(async (
    updates: Array<{ id: string; data: Partial<Contact> }>
  ): Promise<Contact[]> => {
    try {
      const response = await callFunction('bulkUpdateContacts', { updates });
      const updatedContacts = response.data as Contact[];
      
      // Update local state
      setContacts(prev => prev.map(contact => {
        const update = updatedContacts.find(updated => updated.id === contact.id);
        return update || contact;
      }));
      
      return updatedContacts;
    } catch (err) {
      console.error('Error bulk updating contacts:', err);
      throw err;
    }
  }, [callFunction]);

  // Load initial contacts
  const loadContacts = useCallback(async (options: ContactsQueryOptions = {}) => {
    try {
      const result = await getContacts(options);
      setContacts(result.contacts);
      return result;
    } catch (err) {
      console.error('Error loading contacts:', err);
      throw err;
    }
  }, [getContacts]);

  // Refresh contacts
  const refreshContacts = useCallback(async () => {
    await loadContacts();
  }, [loadContacts]);

  // Auto-load contacts on hook initialization
  useEffect(() => {
    loadContacts().catch(err => {
      console.error('Failed to auto-load contacts:', err);
    });
  }, [loadContacts]);

  return {
    // Data
    contacts,
    stats,
    
    // Loading states
    loading,
    error,
    
    // API methods
    getContacts,
    getContact,
    createContact,
    updateContact,
    deleteContact,
    getContactsStats,
    bulkUpdateContacts,
    
    // Utility methods
    loadContacts,
    refreshContacts,
    
    // State setters (for direct manipulation if needed)
    setContacts,
    setStats
  };
}; 