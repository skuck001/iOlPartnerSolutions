import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { logAuthStatus } from '../utils/authDebug';

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
  authError: string | null;
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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [authError, setAuthError] = useState<string | null>(null);

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
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('Login successful:', result.user.uid);
      
      // Re-enable user document creation now that we have enhanced profile fields
      if (result.user) {
        const user = {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName
        };
        await createOrUpdateUserDocument(user);
      }
    } catch (error: any) {
      console.error('Login failed:', {
        code: error.code,
        message: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      // Clear any previous auth errors
      setAuthError(null);
      
      if (authUser) {
        try {
          // Force token refresh to check validity and handle refresh errors
          // Add retry logic for token refresh
          let tokenRefreshSuccess = false;
          let retryCount = 0;
          const maxRetries = 2;
          
          while (!tokenRefreshSuccess && retryCount < maxRetries) {
            try {
              await authUser.getIdToken(true);
              tokenRefreshSuccess = true;
              // Clear any previous failure count on successful refresh
              sessionStorage.removeItem(`tokenRefreshFailed_${authUser.uid}`);
              logAuthStatus('Token refresh successful', { uid: authUser.uid, retryCount });
            } catch (refreshError: any) {
              retryCount++;
              if (retryCount < maxRetries) {
                console.log(`Token refresh attempt ${retryCount} failed, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
              } else {
                throw refreshError; // Re-throw if all retries failed
              }
            }
          }
          
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
            // Don't clear auth state just because user doc creation failed
          }
        } catch (error: any) {
          logAuthStatus('Token refresh failed', {
            code: error.code,
            message: error.message,
            uid: authUser.uid,
            isOnline
          });
          
          // Handle specific error types
          const is403Error = error.code === 'auth/invalid-user-token' || 
                           error.code === 'auth/user-token-expired' ||
                           error.message?.includes('403') ||
                           error.code === 'auth/network-request-failed';
          
          // Check for API blocking issues (common in development)
          const isApiBlocked = error.code?.includes('securetoken.googleapis.com') && 
                              error.code?.includes('are-blocked');
          
          // Check if this is a persistent token issue (multiple 403s in a row)
          const errorKey = `tokenRefreshFailed_${authUser.uid}`;
          const failureCount = (parseInt(sessionStorage.getItem(errorKey) || '0') + 1);
          sessionStorage.setItem(errorKey, failureCount.toString());
          
          // Only clear auth state for persistent auth failures
          if (isApiBlocked) {
            console.log('Firebase API is blocked - keeping user logged in (development issue)');
            setAuthError('API access restricted - session maintained');
            // Keep user logged in when API is blocked (common in development)
            const user = {
              uid: authUser.uid,
              email: authUser.email,
              displayName: authUser.displayName
            };
            setCurrentUser(user);
          } else if (isOnline && is403Error && failureCount >= 3) {
            console.log('Clearing auth state due to persistent token refresh failures (403 error)');
            setAuthError('Authentication session expired. Please log in again.');
            sessionStorage.removeItem(errorKey); // Clear failure count
            setCurrentUser(null);
          } else if (isOnline && is403Error) {
            console.log(`Token refresh failed (attempt ${failureCount}/3) - keeping auth state for now`);
            setAuthError(`Connection issue (attempt ${failureCount}/3) - maintaining session`);
            // Keep the current user state for initial failures
            const user = {
              uid: authUser.uid,
              email: authUser.email,
              displayName: authUser.displayName
            };
            setCurrentUser(user);
          } else if (isOnline) {
            console.log('Token refresh failed but keeping auth state - may be temporary network issue');
            setAuthError('Connection issue - trying to maintain session');
            // Keep the current user state for non-auth errors
            const user = {
              uid: authUser.uid,
              email: authUser.email,
              displayName: authUser.displayName
            };
            setCurrentUser(user);
          } else {
            console.log('Keeping auth state despite token refresh failure - user is offline');
            setAuthError('Offline - session preserved');
            // Keep the current user state when offline
            const user = {
              uid: authUser.uid,
              email: authUser.email,
              displayName: authUser.displayName
            };
            setCurrentUser(user);
          }
        }
      } else {
        console.log('User signed out or auth state cleared');
        setCurrentUser(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Network state monitoring
  useEffect(() => {
    const handleOnline = () => {
      logAuthStatus('Network reconnected');
      setIsOnline(true);
    };

    const handleOffline = () => {
      logAuthStatus('Network disconnected');
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const value: AuthContextType = {
    currentUser,
    login,
    logout,
    loading,
    authError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 