import { useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const callFunction = useCallback(async <T = any>(
    functionName: string, 
    data?: any
  ): Promise<T> => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`Calling Cloud Function: ${functionName}`, data);
      console.log('Firebase Functions instance:', functions);
      console.log('Firebase Functions region:', functions.region || 'default');
      
      const callable = httpsCallable(functions, functionName);
      console.log('Callable created:', callable);
      
      const result = await callable(data);
      console.log(`Cloud Function ${functionName} response:`, result);
      return result.data as T;
    } catch (err: any) {
      console.error(`Cloud Function ${functionName} error:`, err);
      console.error('Error details:', {
        code: err.code,
        message: err.message,
        details: err.details,
        stack: err.stack
      });
      const apiError: ApiError = {
        code: err.code || 'UNKNOWN_ERROR',
        message: err.message || 'An unexpected error occurred',
        details: err.details
      };
      setError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return { 
    callFunction, 
    loading, 
    error, 
    clearError 
  };
}; 