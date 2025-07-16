import { HttpsError } from 'firebase-functions/v2/https';
import { AuthError } from './auth.middleware';
import { ValidationError } from './validation.middleware';
import { AuditService } from './audit.service';
import * as logger from 'firebase-functions/logger';

export interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      'NOT_FOUND',
      id ? `${resource} with ID ${id} not found` : `${resource} not found`,
      404
    );
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super('CONFLICT', message, 409, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super('RATE_LIMIT_EXCEEDED', message, 429);
  }
}

export class BusinessLogicError extends AppError {
  constructor(message: string, details?: any) {
    super('BUSINESS_LOGIC_ERROR', message, 400, details);
  }
}

export const handleFunctionError = async (
  error: any,
  context: {
    functionName: string;
    userId?: string;
    userEmail?: string;
    action?: string;
    data?: any;
  }
): Promise<never> => {
  // Log the error for debugging
  logger.error('Function error', {
    error: error.message,
    stack: error.stack,
    context
  });

  // Log to audit trail if we have user context
  if (context.userId) {
    await AuditService.logError(
      context.action || context.functionName,
      context.userId,
      error,
      context.data,
      context.userEmail
    );
  }

  // Convert different error types to HttpsError
  if (error instanceof AuthError) {
    throw new HttpsError(
      error.code === 'UNAUTHENTICATED' ? 'unauthenticated' : 'permission-denied',
      error.message,
      { code: error.code }
    );
  }

  if (error instanceof ValidationError) {
    throw new HttpsError('invalid-argument', error.message, {
      code: 'VALIDATION_ERROR',
      errors: error.errors
    });
  }

  if (error instanceof NotFoundError) {
    throw new HttpsError('not-found', error.message, {
      code: error.code
    });
  }

  if (error instanceof ConflictError) {
    throw new HttpsError('already-exists', error.message, {
      code: error.code,
      details: error.details
    });
  }

  if (error instanceof RateLimitError) {
    throw new HttpsError('resource-exhausted', error.message, {
      code: error.code
    });
  }

  if (error instanceof BusinessLogicError) {
    throw new HttpsError('failed-precondition', error.message, {
      code: error.code,
      details: error.details
    });
  }

  if (error instanceof AppError) {
    throw new HttpsError('internal', error.message, {
      code: error.code,
      details: error.details
    });
  }

  // Default error handling for unknown errors
  throw new HttpsError('internal', 'An unexpected error occurred', {
    code: 'INTERNAL_ERROR'
  });
};

export const withErrorHandling = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: {
    functionName: string;
    action?: string;
  }
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      await handleFunctionError(error, {
        ...context,
        // Try to extract user info from function arguments if available
        userId: (args[0] as any)?.auth?.uid,
        userEmail: (args[0] as any)?.auth?.token?.email,
        data: args[0]
      });
      // This will never be reached due to handleFunctionError throwing
      throw error;
    }
  };
};

export const validateResourceExists = async (
  collection: string,
  id: string,
  resourceName: string = collection
): Promise<void> => {
  const { getFirestore } = await import('firebase-admin/firestore');
  const db = getFirestore();
  
  const doc = await db.collection(collection).doc(id).get();
  if (!doc.exists) {
    throw new NotFoundError(resourceName, id);
  }
};

export const validateUniqueField = async (
  collection: string,
  field: string,
  value: any,
  excludeId?: string
): Promise<void> => {
  const { getFirestore } = await import('firebase-admin/firestore');
  const db = getFirestore();
  
  let query = db.collection(collection).where(field, '==', value);
  
  const snapshot = await query.get();
  const existingDocs = snapshot.docs.filter(doc => doc.id !== excludeId);
  
  if (existingDocs.length > 0) {
    throw new ConflictError(`${field} already exists`, { field, value });
  }
};

export const createErrorResponse = (error: any): ErrorResponse => {
  return {
    code: error.code || 'UNKNOWN_ERROR',
    message: error.message || 'An unexpected error occurred',
    details: error.details,
    timestamp: new Date().toISOString()
  };
};

// Utility for retrying operations with exponential backoff
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      if (attempt === maxAttempts) {
        break;
      }
      
      // Only retry on transient errors
      if (
        error?.code === 'unavailable' ||
        error?.code === 'deadline-exceeded' ||
        error?.code === 'internal' ||
        (error?.status >= 500 && error?.status < 600)
      ) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Don't retry on client errors
      break;
    }
  }
  
  throw lastError;
}; 