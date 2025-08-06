/**
 * Utility functions for debugging authentication issues
 */

export const logAuthStatus = (event: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const isOnline = navigator.onLine;
  
  console.log(`[AUTH DEBUG ${timestamp}] ${event}`, {
    isOnline,
    userAgent: navigator.userAgent,
    localStorage: !!window.localStorage,
    sessionStorage: !!window.sessionStorage,
    ...details
  });
};

export const checkAuthEnvironment = () => {
  logAuthStatus('Environment Check', {
    localStorage: {
      available: !!window.localStorage,
      firebaseKeys: Object.keys(localStorage).filter(key => key.startsWith('firebase'))
    },
    sessionStorage: {
      available: !!window.sessionStorage,
      firebaseKeys: Object.keys(sessionStorage).filter(key => key.startsWith('firebase'))
    },
    indexedDB: !!window.indexedDB,
    cookies: document.cookie ? 'enabled' : 'disabled'
  });
};

// Call on app initialization
if (typeof window !== 'undefined') {
  checkAuthEnvironment();
}