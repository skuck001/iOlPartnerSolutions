import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { User } from '../types';

// Cache for users to avoid repeated fetches
let usersCache: User[] = [];
let lastFetch: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const getAllUsers = async (): Promise<User[]> => {
  // Return cached users if still fresh
  if (usersCache.length > 0 && Date.now() - lastFetch < CACHE_DURATION) {
    console.log('Returning cached users:', usersCache.length);
    return usersCache;
  }

  try {
    console.log('Fetching users from Firestore...');
    const usersCollection = collection(db, 'users');
    const querySnapshot = await getDocs(usersCollection);
    
    const users: User[] = [];
    querySnapshot.forEach((doc) => {
      console.log('Found user:', doc.id, doc.data());
      users.push({ id: doc.id, ...doc.data() } as User);
    });

    console.log(`Fetched ${users.length} users from database`);

    // Update cache
    usersCache = users;
    lastFetch = Date.now();
    
    return users;
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};

export const getUserById = async (userId: string): Promise<User | null> => {
  // Check cache first
  const cachedUser = usersCache.find(user => user.id === userId);
  if (cachedUser) {
    return cachedUser;
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() } as User;
    }
    return null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};

export const getUserDisplayName = (user: User | null): string => {
  if (!user) return 'Unknown User';
  
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  
  if (user.displayName) {
    return user.displayName;
  }
  
  if (user.email) {
    // Extract name from email (everything before @)
    const emailName = user.email.split('@')[0];
    return emailName.charAt(0).toUpperCase() + emailName.slice(1);
  }
  
  return 'Unknown User';
};

export const getUserInitials = (user: User | null): string => {
  if (!user) return 'UU';
  
  if (user.firstName && user.lastName) {
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  }
  
  if (user.displayName) {
    const parts = user.displayName.split(' ');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return user.displayName.charAt(0).toUpperCase() + (user.displayName.charAt(1) || '').toUpperCase();
  }
  
  if (user.email) {
    return user.email.substring(0, 2).toUpperCase();
  }
  
  return 'UU';
};

// Clear cache when needed (e.g., after user updates)
export const clearUsersCache = () => {
  usersCache = [];
  lastFetch = 0;
};

// Debug function to test user fetching
export const debugUserFetch = async () => {
  console.log('=== DEBUG USER FETCH ===');
  console.log('Current cache:', usersCache);
  console.log('Last fetch time:', lastFetch);
  console.log('Cache age (ms):', Date.now() - lastFetch);
  
  try {
    console.log('Attempting to fetch users...');
    const users = await getAllUsers();
    console.log('Fetched users:', users);
    console.log('Number of users:', users.length);
    
    users.forEach((user, index) => {
      console.log(`User ${index + 1}:`, {
        id: user.id,
        email: user.email,
        displayName: getUserDisplayName(user),
        initials: getUserInitials(user)
      });
    });
    
    return users;
  } catch (error) {
    console.error('Error in debugUserFetch:', error);
    return [];
  }
};

// Make it available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).debugUserFetch = debugUserFetch;
}

// One-time bulk ownership assignment function
export const assignAllEntitiesToUser = async (userId: string) => {
  console.log(`=== BULK OWNERSHIP ASSIGNMENT TO USER: ${userId} ===`);
  
  const collections = ['accounts', 'contacts', 'products', 'opportunities', 'tasks'];
  const results = {
    accounts: 0,
    contacts: 0,
    products: 0,
    opportunities: 0,
    tasks: 0,
    errors: []
  };

  for (const collectionName of collections) {
    try {
      console.log(`\n📁 Processing ${collectionName}...`);
      
      // Import the required functions dynamically
      const { getDocuments, updateDocument } = await import('./firestore');
      
      // Get all documents in the collection
      const documents = await getDocuments(collectionName);
      console.log(`Found ${documents.length} ${collectionName}`);
      
      // Update each document with the ownerId
      for (const doc of documents) {
        try {
          await updateDocument(collectionName, doc.id, {
            ownerId: userId,
            updatedAt: new Date()
          });
          results[collectionName as keyof typeof results]++;
          console.log(`✅ Updated ${collectionName}/${doc.id}`);
        } catch (error) {
          console.error(`❌ Failed to update ${collectionName}/${doc.id}:`, error);
          results.errors.push(`${collectionName}/${doc.id}: ${error}`);
        }
      }
      
      console.log(`✅ Completed ${collectionName}: ${results[collectionName as keyof typeof results]} updated`);
      
    } catch (error) {
      console.error(`❌ Error processing ${collectionName}:`, error);
      results.errors.push(`Collection ${collectionName}: ${error}`);
    }
  }
  
  // Summary
  console.log('\n🎉 BULK ASSIGNMENT COMPLETE!');
  console.log('Summary:');
  console.log(`- Accounts: ${results.accounts} updated`);
  console.log(`- Contacts: ${results.contacts} updated`);
  console.log(`- Products: ${results.products} updated`);
  console.log(`- Opportunities: ${results.opportunities} updated`);
  console.log(`- Tasks: ${results.tasks} updated`);
  console.log(`- Total: ${results.accounts + results.contacts + results.products + results.opportunities + results.tasks} entities assigned`);
  
  if (results.errors.length > 0) {
    console.log(`- Errors: ${results.errors.length}`);
    console.log('Error details:', results.errors);
  }
  
  // Clear users cache to force refresh
  clearUsersCache();
  
  return results;
};

// Make it available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).assignAllEntitiesToUser = assignAllEntitiesToUser;
} 