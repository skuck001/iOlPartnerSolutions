import { 
  Firestore, 
  Query,
  Timestamp 
} from 'firebase-admin/firestore';
import { Contact, ContactType } from '../../types';
import { AuditService } from '../../shared/audit.service';

export interface ContactFilters {
  ownerId?: string;
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

export class ContactsService {
  private db: Firestore;

  constructor(db: Firestore) {
    this.db = db;
  }

  async getContacts(options: ContactsQueryOptions = {}): Promise<ContactsResponse> {
    const {
      filters = {},
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      limit = 50,
      offset = 0
    } = options;

    let query: Query = this.db.collection('contacts');

    // Apply filters
    if (filters.ownerId) {
      query = query.where('ownerId', '==', filters.ownerId);
    }

    if (filters.accountId) {
      query = query.where('accountId', '==', filters.accountId);
    }

    if (filters.contactType) {
      query = query.where('contactType', '==', filters.contactType);
    }

    if (filters.region) {
      query = query.where('region', '==', filters.region);
    }

    if (filters.position) {
      query = query.where('position', '==', filters.position);
    }

    // Apply sorting
    query = query.orderBy(sortBy, sortOrder);

    // Apply pagination
    if (offset > 0) {
      const offsetSnapshot = await query.limit(offset).get();
      if (!offsetSnapshot.empty) {
        const lastDoc = offsetSnapshot.docs[offsetSnapshot.docs.length - 1];
        query = query.startAfter(lastDoc);
      }
    }

    query = query.limit(limit + 1); // Get one extra to check if there are more

    const snapshot = await query.get();
    const contacts = snapshot.docs.slice(0, limit).map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Contact[];

    // Apply client-side search filter if needed
    let filteredContacts = contacts;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredContacts = contacts.filter(contact =>
        contact.name?.toLowerCase().includes(searchLower) ||
        contact.email?.toLowerCase().includes(searchLower) ||
        contact.position?.toLowerCase().includes(searchLower) ||
        contact.department?.toLowerCase().includes(searchLower)
      );
    }

    // Get total count for pagination
    const totalQuery = this.buildFilterQuery(filters);
    const totalSnapshot = await totalQuery.count().get();
    const total = totalSnapshot.data().count;

    return {
      contacts: filteredContacts,
      total,
      hasMore: snapshot.docs.length > limit
    };
  }

  async getContact(contactId: string): Promise<Contact | null> {
    const doc = await this.db.collection('contacts').doc(contactId).get();
    
    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data()
    } as Contact;
  }

  async createContact(contactData: Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>, userId: string): Promise<Contact> {
    // Validate required fields
    if (!contactData.name) {
      throw new Error('Contact name is required');
    }

    if (!contactData.email) {
      throw new Error('Contact email is required');
    }

    if (!contactData.accountId) {
      throw new Error('Account ID is required');
    }

    // Check for duplicate email
    const existingContacts = await this.db.collection('contacts')
      .where('email', '==', contactData.email)
      .get();

    if (!existingContacts.empty) {
      throw new Error('A contact with this email already exists');
    }

    const now = Timestamp.now();
    const contact: Omit<Contact, 'id'> = {
      ...contactData,
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
      lastContactDate: contactData.lastContactDate || null,
      // tags field removed from Contact interface
      productIds: contactData.productIds || []
    };

    const docRef = await this.db.collection('contacts').add(contact);
    const newContact = { id: docRef.id, ...contact } as Contact;

    // Audit log
    await AuditService.log({
      userId,
      action: 'create',
      resourceType: 'contact',
      resourceId: docRef.id,
      data: { contactName: contact.name, accountId: contact.accountId }
    });

    return newContact;
  }

  async updateContact(contactId: string, updates: Partial<Contact>, userId: string): Promise<Contact> {
    const contactRef = this.db.collection('contacts').doc(contactId);
    const doc = await contactRef.get();

    if (!doc.exists) {
      throw new Error('Contact not found');
    }

    const existingContact = doc.data() as Contact;

    // Check for email conflicts if email is being updated
    if (updates.email && updates.email !== existingContact.email) {
      const emailCheck = await this.db.collection('contacts')
        .where('email', '==', updates.email)
        .get();

      if (!emailCheck.empty && emailCheck.docs[0].id !== contactId) {
        throw new Error('A contact with this email already exists');
      }
    }

    const updateData = {
      ...updates,
      updatedAt: Timestamp.now()
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    await contactRef.update(updateData);

    const updatedContact = {
      ...existingContact,
      ...updateData,
      id: contactId
    } as Contact;

    // Audit log
    await AuditService.log({
      userId,
      action: 'update',
      resourceType: 'contact',
      resourceId: contactId,
      data: { 
        contactName: updatedContact.name,
        updatedFields: Object.keys(updates)
      }
    });

    return updatedContact;
  }

  async deleteContact(contactId: string, userId: string): Promise<void> {
    const contactRef = this.db.collection('contacts').doc(contactId);
    const doc = await contactRef.get();

    if (!doc.exists) {
      throw new Error('Contact not found');
    }

    const contact = doc.data() as Contact;

    // Check for dependencies (opportunities, etc.)
    const opportunitiesQuery = await this.db.collection('opportunities')
      .where('contactIds', 'array-contains', contactId)
      .get();

    if (!opportunitiesQuery.empty) {
      throw new Error('Cannot delete contact: contact is referenced by opportunities');
    }

    await contactRef.delete();

    // Audit log
    await AuditService.log({
      userId,
      action: 'delete',
      resourceType: 'contact',
      resourceId: contactId,
      data: { contactName: contact.name, accountId: contact.accountId }
    });
  }

  async getContactsStats(filters: ContactFilters = {}): Promise<ContactStats> {
    const query = this.buildFilterQuery(filters);
    const snapshot = await query.get();
    const contacts = snapshot.docs.map(doc => doc.data()) as Contact[];

    const stats: ContactStats = {
      total: contacts.length,
      byType: {
                  'Primary': 0,
          'Secondary': 0,
          'Technical': 0,
          'Billing': 0,
          'Decision Maker': 0,
          'Other': 0
      },
      byRegion: {},
      activeThisMonth: 0,
      newThisWeek: 0
    };

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    contacts.forEach(contact => {
      // Count by type
      if (contact.contactType) {
        stats.byType[contact.contactType]++;
      }

      // Count by region
      // Region field removed from Contact interface

      // Count active this month (had contact)
      if (contact.lastContactDate && contact.lastContactDate.toDate() > oneMonthAgo) {
        stats.activeThisMonth++;
      }

      // Count new this week
      if (contact.createdAt && contact.createdAt.toDate() > oneWeekAgo) {
        stats.newThisWeek++;
      }
    });

    return stats;
  }

  async bulkUpdateContacts(updates: Array<{ id: string; data: Partial<Contact> }>, userId: string): Promise<Contact[]> {
    const batch = this.db.batch();
    const updatedContacts: Contact[] = [];

    for (const update of updates) {
      const contactRef = this.db.collection('contacts').doc(update.id);
      const doc = await contactRef.get();

      if (!doc.exists) {
        continue;
      }

      const existingContact = doc.data() as Contact;
      const updateData = {
        ...update.data,
        updatedAt: Timestamp.now()
      };

      batch.update(contactRef, updateData);

      updatedContacts.push({
        ...existingContact,
        ...updateData,
        id: update.id
      } as Contact);
    }

    await batch.commit();

    // Audit log
    await AuditService.log({
      userId,
      action: 'bulk_update',
      resourceType: 'contact',
      resourceId: 'multiple',
      data: { count: updates.length }
    });

    return updatedContacts;
  }

  private buildFilterQuery(filters: ContactFilters): Query {
    let query: Query = this.db.collection('contacts');

    if (filters.ownerId) {
      query = query.where('ownerId', '==', filters.ownerId);
    }

    if (filters.accountId) {
      query = query.where('accountId', '==', filters.accountId);
    }

    if (filters.contactType) {
      query = query.where('contactType', '==', filters.contactType);
    }

    if (filters.region) {
      query = query.where('region', '==', filters.region);
    }

    if (filters.position) {
      query = query.where('position', '==', filters.position);
    }

    return query;
  }
} 