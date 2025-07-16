import { CallableRequest } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export interface AuthenticatedUser {
  uid: string;
  email: string;
  role: string;
  permissions: string[];
}

export class AuthError extends Error {
  constructor(message: string, public code: string = 'UNAUTHENTICATED') {
    super(message);
    this.name = 'AuthError';
  }
}

export const authenticateUser = async (auth: CallableRequest['auth']): Promise<AuthenticatedUser> => {
  if (!auth?.uid) {
    throw new AuthError('User must be authenticated', 'UNAUTHENTICATED');
  }

  try {
    // Verify the token is still valid
    const userRecord = await getAuth().getUser(auth.uid);
    
    // Get user document from Firestore for role and permissions
    const userDoc = await getFirestore()
      .collection('users')
      .doc(auth.uid)
      .get();

    if (!userDoc.exists) {
      throw new AuthError('User profile not found', 'USER_NOT_FOUND');
    }

    const userData = userDoc.data()!;

    return {
      uid: auth.uid,
      email: userRecord.email || auth.token?.email || '',
      role: userData.role || 'user',
      permissions: userData.permissions || []
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError('Authentication failed', 'AUTH_FAILED');
  }
};

export const requirePermission = (user: AuthenticatedUser, requiredPermission: string): void => {
  if (user.role === 'admin') {
    return; // Admins have all permissions
  }

  if (!user.permissions.includes(requiredPermission)) {
    throw new AuthError(`Permission denied: ${requiredPermission}`, 'PERMISSION_DENIED');
  }
};

export const requireOwnership = async (
  userId: string, 
  collection: string, 
  documentId: string
): Promise<void> => {
  const doc = await getFirestore()
    .collection(collection)
    .doc(documentId)
    .get();

  if (!doc.exists) {
    throw new AuthError('Resource not found', 'NOT_FOUND');
  }

  const data = doc.data()!;
  if (data.ownerId !== userId) {
    throw new AuthError('Access denied: not owner', 'NOT_OWNER');
  }
}; 