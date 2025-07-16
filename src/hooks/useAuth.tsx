import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

// Simple type for Firebase user
type FirebaseUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

interface AuthContextType {
  currentUser: FirebaseUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const createOrUpdateUserDocument = async (user: FirebaseUser) => {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      const userData = {
        id: user.uid,
        email: user.email!,
        displayName: user.displayName || null,
        lastLoginAt: Timestamp.now()
      };

      if (!userDoc.exists()) {
        // Create new user document with enhanced profile fields
        await setDoc(userDocRef, {
          ...userData,
          firstName: '',
          lastName: '',
          phone: '',
          jobTitle: '',
          department: '',
          location: '',
          bio: '',
          avatar: '',
          role: 'user', // Default role
          permissions: [],
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          notifications: {
            email: true,
            push: true,
            weekly: true,
          },
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        console.log('Created new user document for:', user.email);
      } else {
        // Update last login time
        await setDoc(userDocRef, {
          ...userData,
          updatedAt: Timestamp.now()
        }, { merge: true });
        console.log('Updated user document for:', user.email);
      }
    } catch (error) {
      console.error('Error creating/updating user document:', error);
      // Don't throw the error - allow login to proceed even if user doc creation fails
    }
  };

  const login = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    // Re-enable user document creation now that we have enhanced profile fields
    if (result.user) {
      const user = {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName
      };
      await createOrUpdateUserDocument(user);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        const user = {
          uid: authUser.uid,
          email: authUser.email,
          displayName: authUser.displayName
        };
        setCurrentUser(user);
        
        try {
          await createOrUpdateUserDocument(user);
        } catch (error) {
          console.error('Error creating/updating user document:', error);
        }
      } else {
        setCurrentUser(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}; 