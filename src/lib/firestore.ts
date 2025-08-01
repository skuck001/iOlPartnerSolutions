import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint
} from 'firebase/firestore';
import { db } from './firebase';
import type { Contact } from '../types/Contact';
import type { Product } from '../types/Product';

// Generic collection reference
export const getCollection = (collectionName: string) => collection(db, collectionName);

// Generic CRUD operations
export const createDocument = async (collectionName: string, data: any, customId?: string) => {
  const documentData = {
    ...data,
    // Only add createdAt if not already provided
    createdAt: data.createdAt || Timestamp.now()
  };

  if (customId) {
    // Use setDoc for custom IDs
    const docRef = doc(db, collectionName, customId);
    await setDoc(docRef, documentData);
    return docRef;
  } else {
    // Use addDoc for auto-generated IDs
    const docRef = await addDoc(getCollection(collectionName), documentData);
    return docRef;
  }
};

export const getDocument = async <T = any>(collectionName: string, id: string): Promise<T | null> => {
  const docRef = doc(db, collectionName, id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as T : null;
};

export const updateDocument = async (collectionName: string, id: string, data: any) => {
  const docRef = doc(db, collectionName, id);
  await updateDoc(docRef, data);
};

export const deleteDocument = async (collectionName: string, id: string) => {
  const docRef = doc(db, collectionName, id);
  await deleteDoc(docRef);
};

export const getDocuments = async (collectionName: string, constraints: QueryConstraint[] = []) => {
  const q = query(getCollection(collectionName), ...constraints);
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Specific collection functions
export const accountsCollection = () => getCollection('accounts');
export const contactsCollection = () => getCollection('contacts');
export const productsCollection = () => getCollection('products');
export const opportunitiesCollection = () => getCollection('opportunities');
export const tasksCollection = () => getCollection('tasks');
export const usersCollection = () => getCollection('users');

// Helper functions for common queries
// getAccountsByIndustry removed as industry field no longer exists

export const getContactsByAccount = (accountId: string) =>
  getDocuments('contacts', [where('accountId', '==', accountId)]);

export const getOpportunitiesByStage = (stage: string) =>
  getDocuments('opportunities', [where('stage', '==', stage)]);

export const getTasksByStatus = (status: string) =>
  getDocuments('tasks', [where('status', '==', status)]);

export const getTasksByOpportunity = (opportunityId: string) =>
  getDocuments('tasks', [where('opportunityId', '==', opportunityId)]);

export const getUserByEmail = (email: string) =>
  getDocuments('users', [where('email', '==', email)]);

// Relationship management functions
export const syncProductContactRelationship = async (
  productId: string, 
  contactIds: string[], 
  previousContactIds: string[] = []
) => {
  // Get contacts to add and remove
  const contactsToAdd = contactIds.filter(id => !previousContactIds.includes(id));
  const contactsToRemove = previousContactIds.filter(id => !contactIds.includes(id));

  // Add product to new contacts
  for (const contactId of contactsToAdd) {
    const contact = await getDocument<Contact>('contacts', contactId);
    if (contact) {
      const updatedProductIds = [...(contact.productIds || [])];
      if (!updatedProductIds.includes(productId)) {
        updatedProductIds.push(productId);
        await updateDocument('contacts', contactId, { productIds: updatedProductIds });
      }
    }
  }

  // Remove product from removed contacts
  for (const contactId of contactsToRemove) {
    const contact = await getDocument<Contact>('contacts', contactId);
    if (contact) {
      const updatedProductIds = (contact.productIds || []).filter(id => id !== productId);
      await updateDocument('contacts', contactId, { productIds: updatedProductIds });
    }
  }
};

export const syncContactProductRelationship = async (
  contactId: string, 
  productIds: string[], 
  previousProductIds: string[] = []
) => {
  // Get products to add and remove
  const productsToAdd = productIds.filter(id => !previousProductIds.includes(id));
  const productsToRemove = previousProductIds.filter(id => !productIds.includes(id));

  // Add contact to new products
  for (const productId of productsToAdd) {
    const product = await getDocument<Product>('products', productId);
    if (product) {
      const updatedContactIds = [...(product.contactIds || [])];
      if (!updatedContactIds.includes(contactId)) {
        updatedContactIds.push(contactId);
        await updateDocument('products', productId, { contactIds: updatedContactIds });
      }
    }
  }

  // Remove contact from removed products
  for (const productId of productsToRemove) {
    const product = await getDocument<Product>('products', productId);
    if (product) {
      const updatedContactIds = (product.contactIds || []).filter(id => id !== contactId);
      await updateDocument('products', productId, { contactIds: updatedContactIds });
    }
  }
};

// Enhanced update functions that maintain relationships
export const updateProductWithSync = async (productId: string, data: any, previousContactIds: string[] = []) => {
  // Update the product first
  await updateDocument('products', productId, data);
  
  // Sync the contact relationships if contactIds changed
  if (data.contactIds) {
    await syncProductContactRelationship(productId, data.contactIds, previousContactIds);
  }
};

export const updateContactWithSync = async (contactId: string, data: any, previousProductIds: string[] = []) => {
  // Update the contact first
  await updateDocument('contacts', contactId, data);
  
  // Sync the product relationships if productIds changed
  if (data.productIds) {
    await syncContactProductRelationship(contactId, data.productIds, previousProductIds);
  }
};

// Clean up relationships when deleting
export const deleteProductWithSync = async (productId: string) => {
  // Get the product first to see its contacts
  const product = await getDocument<Product>('products', productId);
  if (product?.contactIds) {
    // Remove this product from all associated contacts
    await syncProductContactRelationship(productId, [], product.contactIds);
  }
  
  // Delete the product
  await deleteDocument('products', productId);
};

export const deleteContactWithSync = async (contactId: string) => {
  // Get the contact first to see its products
  const contact = await getDocument<Contact>('contacts', contactId);
  if (contact?.productIds) {
    // Remove this contact from all associated products
    await syncContactProductRelationship(contactId, [], contact.productIds);
  }
  
  // Delete the contact
  await deleteDocument('contacts', contactId);
};

// Helper function to update contact's lastContactDate when activities are completed
export const updateContactsLastActivity = async (contactIds: string[], activityDate: Date) => {
  for (const contactId of contactIds) {
    try {
      const contact = await getDocument<Contact>('contacts', contactId);
      if (contact) {
        const currentLastContact = contact.lastContactDate?.toDate();
        
        // Only update if this activity is more recent than the current lastContactDate
        if (!currentLastContact || activityDate > currentLastContact) {
          await updateDocument('contacts', contactId, {
            lastContactDate: Timestamp.fromDate(activityDate),
            updatedAt: Timestamp.now()
          });
        }
      }
    } catch (error) {
      console.error(`Error updating lastContactDate for contact ${contactId}:`, error);
    }
  }
};

// Quick Access function to get recently updated items across all collections
export interface RecentlyUpdatedItem {
  id: string;
  title: string;
  type: 'account' | 'contact' | 'opportunity' | 'product';
  updatedAt: Timestamp;
  subtitle?: string;
  href: string;
}

export const getRecentlyUpdatedItems = async (limitCount: number = 5): Promise<RecentlyUpdatedItem[]> => {
  try {
    const collections = [
      { name: 'accounts', type: 'account' as const },
      { name: 'contacts', type: 'contact' as const },
      { name: 'opportunities', type: 'opportunity' as const },
      { name: 'products', type: 'product' as const },
    ];

    const allItems: RecentlyUpdatedItem[] = [];

    // Query each collection for recently updated items
    for (const { name, type } of collections) {
      try {
        const items = await getDocuments(name, [
          orderBy('updatedAt', 'desc'),
          limit(limitCount)
        ]);

        // Transform items to RecentlyUpdatedItem format
        const transformedItems: RecentlyUpdatedItem[] = items
          .filter((item: any) => item.updatedAt) // Only include items with updatedAt
          .map((item: any) => {
            let title = '';
            let subtitle = '';
            let href = '';

            switch (type) {
              case 'account':
                title = item.name;
                subtitle = item.region || '';
                href = `/accounts/${item.id}`;
                break;
              case 'contact':
                title = item.name;
                subtitle = item.position || item.email || '';
                href = `/contacts/${item.id}`;
                break;
              case 'opportunity':
                title = item.title;
                subtitle = item.stage || '';
                href = `/opportunities/${item.id}`;
                break;
              case 'product':
                title = item.name;
                subtitle = item.category || '';
                href = `/products/${item.id}`;
                break;
            }

            return {
              id: item.id,
              title,
              type,
              updatedAt: item.updatedAt,
              subtitle,
              href,
            };
          });

        allItems.push(...transformedItems);
      } catch (error) {
        console.error(`Error fetching recently updated ${name}:`, error);
      }
    }

    // Sort all items by updatedAt and return top limitCount
    return allItems
      .sort((a, b) => b.updatedAt.toMillis() - a.updatedAt.toMillis())
      .slice(0, limitCount);
  } catch (error) {
    console.error('Error getting recently updated items:', error);
    return [];
  }
}; 