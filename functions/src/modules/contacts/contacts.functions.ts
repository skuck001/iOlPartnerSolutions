import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { validateData, ValidationError } from '../../shared/validation.middleware';
import { authenticateUser } from '../../shared/auth.middleware';
import { RateLimiter, RateLimitPresets } from '../../shared/rateLimiter';
import { ContactsService, ContactFilters, ContactsQueryOptions } from './contacts.service';
import { z } from 'zod';

const db = getFirestore();
const contactsService = new ContactsService(db);

// Validation schemas
const ContactFiltersSchema = z.object({
  ownerId: z.string().optional(),
  accountId: z.string().optional(),
  contactType: z.enum(['Primary', 'Secondary', 'Technical', 'Billing', 'Decision Maker', 'Other']).optional(),
  search: z.string().optional(),
  region: z.string().optional(),
  position: z.string().optional()
});

const ContactsQuerySchema = z.object({
  filters: ContactFiltersSchema.optional(),
  sortBy: z.enum(['name', 'email', 'position', 'contactType', 'lastContactDate', 'createdAt', 'updatedAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional()
});

const CreateContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  accountId: z.string().min(1),
  contactType: z.enum(['Primary', 'Secondary', 'Technical', 'Billing', 'Decision Maker', 'Other']).nullish().transform(val => val ?? undefined),
  position: z.string().nullish().transform(val => val ?? undefined),
  phone: z.string().nullish().transform(val => val ?? undefined),
  department: z.string().nullish().transform(val => val ?? undefined),
  linkedIn: z.string().nullish().transform(val => val ?? undefined),
  timezone: z.string().nullish().transform(val => val ?? undefined),
  preferredContactMethod: z.enum(['Email', 'Phone', 'LinkedIn', 'Teams']).nullish().transform(val => val ?? undefined),
  isDecisionMaker: z.boolean().optional(),
  lastContactDate: z.any().optional(), // Timestamp
  notes: z.string().nullish().transform(val => val ?? undefined),
  productIds: z.array(z.string()).optional()
});

const UpdateContactSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  contactType: z.enum(['Primary', 'Secondary', 'Technical', 'Billing', 'Decision Maker', 'Other']).optional(),
  position: z.string().nullish().transform(val => val ?? undefined),
  phone: z.string().nullish().transform(val => val ?? undefined),
  department: z.string().nullish().transform(val => val ?? undefined),
  linkedIn: z.string().nullish().transform(val => val ?? undefined),
  timezone: z.string().nullish().transform(val => val ?? undefined),
  preferredContactMethod: z.enum(['Email', 'Phone', 'LinkedIn', 'Teams']).nullish().transform(val => val ?? undefined),
  isDecisionMaker: z.boolean().optional(),
  lastContactDate: z.any().optional(), // Timestamp
  notes: z.string().nullish().transform(val => val ?? undefined),
  productIds: z.array(z.string()).optional(),
  ownerId: z.string().optional()
});

const BulkUpdateContactsSchema = z.object({
  updates: z.array(z.object({
    id: z.string().min(1),
    data: UpdateContactSchema
  })).min(1).max(50)
});

// Get contacts with filtering and pagination
export const getContacts = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for read operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.read.maxRequests, RateLimitPresets.read.windowMs, 'getContacts');
      
      const validatedData = validateData(ContactsQuerySchema, request.data);

      const options: ContactsQueryOptions = {
        ...validatedData,
        filters: {
          ...validatedData.filters
          // Removed ownerId filter - allow access to all contacts
        }
      };

      const result = await contactsService.getContacts(options);
      
      return {
        success: true,
        data: result,
        resultCount: result.contacts.length
      };
    } catch (error) {
      console.error('Error in getContacts:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to get contacts');
    }
  }
);

// Get single contact
export const getContact = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for read operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.read.maxRequests, RateLimitPresets.read.windowMs, 'getContact');
      
      if (!request.data?.contactId) {
        throw new HttpsError('invalid-argument', 'Contact ID is required');
      }

      const contact = await contactsService.getContact(request.data.contactId);
      
      if (!contact) {
        throw new HttpsError('not-found', 'Contact not found');
      }

      // Removed ownership check - allow access to all contacts

      return {
        success: true,
        data: contact
      };
    } catch (error) {
      console.error('Error in getContact:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to get contact');
    }
  }
);

// Create new contact
export const createContact = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'createContact');
      const validatedData = validateData(CreateContactSchema, request.data);

      const newContact = await contactsService.createContact(validatedData, user.uid);

      return {
        success: true,
        data: newContact
      };
    } catch (error) {
      console.error('Error in createContact:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof ValidationError) {
        console.error('Validation errors:', error.errors);
        throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
      }
      if (error instanceof Error) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError('internal', 'Failed to create contact');
    }
  }
);

// Update contact
export const updateContact = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'updateContact');
      
      if (!request.data?.contactId) {
        throw new HttpsError('invalid-argument', 'Contact ID is required');
      }

      const validatedData = validateData(UpdateContactSchema, request.data.updates);

      // Check if contact exists - removed ownership check
      const existingContact = await contactsService.getContact(request.data.contactId);
      if (!existingContact) {
        throw new HttpsError('not-found', 'Contact not found');
      }
      // Removed ownership check - allow updates to all contacts

      const updatedContact = await contactsService.updateContact(
        request.data.contactId,
        validatedData,
        user.uid
      );

      return {
        success: true,
        data: updatedContact
      };
    } catch (error) {
      console.error('Error in updateContact:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof ValidationError) {
        console.error('Validation errors:', error.errors);
        throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
      }
      if (error instanceof Error) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError('internal', 'Failed to update contact');
    }
  }
);

// Delete contact
export const deleteContact = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for write operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'deleteContact');
      
      if (!request.data?.contactId) {
        throw new HttpsError('invalid-argument', 'Contact ID is required');
      }

      // Check if contact exists - removed ownership check
      const existingContact = await contactsService.getContact(request.data.contactId);
      if (!existingContact) {
        throw new HttpsError('not-found', 'Contact not found');
      }
      // Removed ownership check - allow deletion of all contacts

      await contactsService.deleteContact(request.data.contactId, user.uid);

      return {
        success: true,
        message: 'Contact deleted successfully'
      };
    } catch (error) {
      console.error('Error in deleteContact:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof ValidationError) {
        console.error('Validation errors:', error.errors);
        throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
      }
      if (error instanceof Error) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError('internal', 'Failed to delete contact');
    }
  }
);

// Get contacts statistics
export const getContactsStats = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for stats operations
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.stats.maxRequests, RateLimitPresets.stats.windowMs, 'getContactsStats');
      const validatedData = validateData(ContactFiltersSchema, request.data || {});

      const filters: ContactFilters = {
        ...validatedData
        // Removed ownerId filter - allow stats for all contacts
      };

      const stats = await contactsService.getContactsStats(filters);

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Error in getContactsStats:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to get contacts statistics');
    }
  }
);

// Bulk update contacts
export const bulkUpdateContacts = onCall(
  { cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], maxInstances: 10 },
  async (request) => {
    try {
      const user = await authenticateUser(request.auth);
      
      // Apply rate limiting for heavy operations (bulk updates)
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.heavy.maxRequests, RateLimitPresets.heavy.windowMs, 'bulkUpdateContacts');
      
      const validatedData = validateData(BulkUpdateContactsSchema, request.data);

      // Verify all contacts exist - removed ownership verification
      for (const update of validatedData.updates) {
        const contact = await contactsService.getContact(update.id);
        if (!contact) {
          throw new HttpsError('not-found', `Contact not found: ${update.id}`);
        }
      }
      // Removed ownership checks - allow bulk updates to all contacts

      const updatedContacts = await contactsService.bulkUpdateContacts(
        validatedData.updates,
        user.uid
      );

      return {
        success: true,
        data: updatedContacts
      };
    } catch (error) {
      console.error('Error in bulkUpdateContacts:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      if (error instanceof ValidationError) {
        console.error('Validation errors:', error.errors);
        throw new HttpsError('invalid-argument', `Validation failed: ${error.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`);
      }
      if (error instanceof Error) {
        throw new HttpsError('invalid-argument', error.message);
      }
      throw new HttpsError('internal', 'Failed to bulk update contacts');
    }
  }
); 