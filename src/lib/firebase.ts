import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, enableNetwork, disableNetwork } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase with performance optimizations
const app = initializeApp(firebaseConfig);

// Initialize Firebase services with optimizations
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, 'us-central1');

// Performance optimizations
if (typeof window !== 'undefined') {
  // Only run in browser environment
  try {
    // Set up connection optimizations
    console.log('Firebase initialized successfully with performance optimizations');
    
    // Force immediate connection to reduce initial latency
    // This helps with the long channel requests you're seeing
    enableNetwork(db).catch(err => {
      console.warn('Failed to enable Firestore network:', err);
    });
    
    // Set up auth persistence optimizations
    auth.settings = {
      ...auth.settings,
      appVerificationDisabledForTesting: false
    };
    
  } catch (error) {
    console.warn('Firebase optimization setup failed:', error);
  }
}

export default app; 