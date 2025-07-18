# Module Template

Use this template when creating new modules. Replace `{MODULE}` with your module name (e.g., `invoices`, `customers`, etc.).

## 📁 File Structure

```
functions/src/modules/{module}/
├── {module}.functions.ts
├── {module}.service.ts
└── README.md

src/
├── types/{Module}.ts
├── hooks/use{Module}Api.ts
├── pages/{Module}.tsx
├── pages/{Module}Details.tsx
└── components/ (if needed)
```

---

## 🔧 Backend Template

### `{module}.service.ts`

```typescript
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { AuditService } from '../shared/audit.service';

export class {Module}Service {
  private db = getFirestore();
  private collection = this.db.collection('{modules}'); // plural
  private auditService = new AuditService();

  async create{Module}(data: any, userId: string): Promise<any> {
    const docRef = this.collection.doc();
    const {module}Data = {
      id: docRef.id,
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await docRef.set({module}Data);

    await this.auditService.logAction(userId, 'create', '{module}', docRef.id, {
      action: '{Module} created',
      {module}Data: {module}Data,
    });

    return {module}Data;
  }

  async get{Module}(id: string): Promise<any | null> {
    const doc = await this.collection.doc(id).get();
    return doc.exists ? doc.data() : null;
  }

  async update{Module}(id: string, updateData: any, userId: string): Promise<any> {
    const docRef = this.collection.doc(id);
    const updatedData = {
      ...updateData,
      updatedAt: Timestamp.now(),
    };

    await docRef.update(updatedData);

    await this.auditService.logAction(userId, 'update', '{module}', id, {
      action: '{Module} updated',
      updatedFields: Object.keys(updateData),
    });

    const updated = await docRef.get();
    return updated.data();
  }

  async delete{Module}(id: string, userId: string): Promise<void> {
    await this.collection.doc(id).delete();

    await this.auditService.logAction(userId, 'delete', '{module}', id, {
      action: '{Module} deleted',
    });
  }

  async get{Module}sByOwner(ownerId: string): Promise<any[]> {
    const snapshot = await this.collection
      .where('ownerId', '==', ownerId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  async bulk{Module}Update(updates: any[], userId: string): Promise<any[]> {
    const batch = this.db.batch();
    const results: any[] = [];

    for (const update of updates) {
      const { id, ...updateData } = update;
      const docRef = this.collection.doc(id);
      
      const updatedData = {
        ...updateData,
        updatedAt: Timestamp.now(),
      };

      batch.update(docRef, updatedData);
      results.push({ id, ...updatedData });
    }

    await batch.commit();

    await this.auditService.logAction(userId, 'bulk_update', '{module}', 'multiple', {
      action: 'Bulk {module} update',
      count: updates.length,
    });

    return results;
  }
}
```

### `{module}.functions.ts`

```typescript
import { onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions';
import { authenticateUser } from '../../shared/auth.middleware';
import { validateData } from '../../shared/validation.middleware';
import { withErrorHandling } from '../../shared/errors';
import { RateLimiter, RateLimitPresets } from '../../shared/rateLimiter';
import { {Module}Service } from './{module}.service';
import { z } from 'zod';
import { HttpsError } from 'firebase-functions/v2/https';

setGlobalOptions({
  maxInstances: 10,
  region: 'us-central1',
});

const {module}Service = new {Module}Service();

// Validation Schemas
export const Create{Module}Schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullish(),
  // Add more fields as needed
}).transform((data) => {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {} as any);
});

export const Update{Module}Schema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1).nullish(),
  description: z.string().nullish(),
  // Add more fields as needed
}).transform((data) => {
  const { id, ...updateData } = data;
  const cleanData = Object.entries(updateData).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {} as any);
  return { id, updateData: cleanData };
});

export const Delete{Module}Schema = z.object({
  {module}Id: z.string().min(1, '{Module} ID is required'),
});

// Create {Module}
export const create{Module} = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.write.maxRequests, 
        RateLimitPresets.write.windowMs, 
        'create{Module}'
      );
      
      const validatedData = await validateData(Create{Module}Schema, request.data);
      
      const {module}Data = {
        ...validatedData,
        ownerId: user.uid,
      };
      
      const result = await {module}Service.create{Module}({module}Data, user.uid);
      
      console.log(`✅ {Module} created successfully: ${result.id}`);
      return result;
    });
  }
);

// Get {Module}s
export const get{Module}s = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.read.maxRequests, 
        RateLimitPresets.read.windowMs, 
        'get{Module}s'
      );
      
      const result = await {module}Service.get{Module}sByOwner(user.uid);
      
      console.log(`📋 Retrieved ${result.length} {modules} for user ${user.uid}`);
      return result;
    });
  }
);

// Get Single {Module}
export const get{Module} = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.read.maxRequests, 
        RateLimitPresets.read.windowMs, 
        'get{Module}'
      );
      
      if (!request.data?.{module}Id) {
        throw new HttpsError('invalid-argument', '{Module} ID is required');
      }

      const result = await {module}Service.get{Module}(request.data.{module}Id);
      
      if (!result) {
        throw new HttpsError('not-found', '{Module} not found');
      }

      if (result.ownerId !== user.uid) {
        throw new HttpsError('permission-denied', 'Access denied');
      }
      
      return result;
    });
  }
);

// Update {Module}
export const update{Module} = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.write.maxRequests, 
        RateLimitPresets.write.windowMs, 
        'update{Module}'
      );
      
      const { id, updateData } = await validateData(Update{Module}Schema, request.data);
      
      // Verify ownership
      const existing = await {module}Service.get{Module}(id);
      if (!existing) {
        throw new HttpsError('not-found', '{Module} not found');
      }
      if (existing.ownerId !== user.uid) {
        throw new HttpsError('permission-denied', 'Access denied');
      }
      
      const result = await {module}Service.update{Module}(id, updateData, user.uid);
      
      console.log(`✅ {Module} updated successfully: ${id}`);
      return result;
    });
  }
);

// Delete {Module}
export const delete{Module} = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.write.maxRequests, 
        RateLimitPresets.write.windowMs, 
        'delete{Module}'
      );
      
      const { {module}Id } = await validateData(Delete{Module}Schema, request.data);
      
      // Verify ownership
      const existing = await {module}Service.get{Module}({module}Id);
      if (!existing) {
        throw new HttpsError('not-found', '{Module} not found');
      }
      if (existing.ownerId !== user.uid) {
        throw new HttpsError('permission-denied', 'Access denied');
      }
      
      await {module}Service.delete{Module}({module}Id, user.uid);
      
      console.log(`✅ {Module} deleted successfully: ${module}Id`);
      return { success: true };
    });
  }
);
```

---

## 🎨 Frontend Template

### `src/types/{Module}.ts`

```typescript
import { Timestamp } from 'firebase/firestore';

export interface {Module} {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Add more fields as needed
}

export interface Create{Module}Request {
  name: string;
  description?: string;
  // Add more fields as needed
}

export interface Update{Module}Request {
  id: string;
  name?: string;
  description?: string;
  // Add more fields as needed
}
```

### `src/hooks/use{Module}Api.ts`

```typescript
import { useState, useCallback } from 'react';
import { useApi } from './useApi';
import type { {Module}, Create{Module}Request, Update{Module}Request } from '../types';

export const use{Module}Api = () => {
  const { callFunction, loading, error, clearError } = useApi();
  const [{modules}, set{Module}s] = useState<{Module}[]>([]);

  const create{Module} = useCallback(async (data: Create{Module}Request): Promise<{Module}> => {
    const result = await callFunction('create{Module}', data);
    return result;
  }, [callFunction]);

  const get{Module}s = useCallback(async (): Promise<{Module}[]> => {
    const result = await callFunction('get{Module}s');
    set{Module}s(result || []);
    return result || [];
  }, [callFunction]);

  const get{Module} = useCallback(async ({module}Id: string): Promise<{Module}> => {
    const result = await callFunction('get{Module}', { {module}Id });
    return result;
  }, [callFunction]);

  const update{Module} = useCallback(async (data: Update{Module}Request): Promise<{Module}> => {
    const result = await callFunction('update{Module}', data);
    return result;
  }, [callFunction]);

  const delete{Module} = useCallback(async ({module}Id: string): Promise<void> => {
    await callFunction('delete{Module}', { {module}Id });
  }, [callFunction]);

  return {
    {modules},
    create{Module},
    get{Module}s,
    get{Module},
    update{Module},
    delete{Module},
    loading,
    error,
    clearError,
  };
};
```

---

## 📋 Setup Checklist

### Backend Setup
- [ ] Copy and modify `{module}.service.ts`
- [ ] Copy and modify `{module}.functions.ts`
- [ ] Update collection name and schema fields
- [ ] Export functions in `functions/src/index.ts`
- [ ] Run `npm run build` to check for errors

### Frontend Setup
- [ ] Create types in `src/types/{Module}.ts`
- [ ] Create API hook in `src/hooks/use{Module}Api.ts`
- [ ] Add navigation item to `src/components/Layout.tsx`
- [ ] Create pages: `{Module}.tsx` and `{Module}Details.tsx`
- [ ] Add routes to `src/App.tsx`

### Testing
- [ ] Deploy functions: `firebase deploy --only functions:create{Module},get{Module}s,update{Module},delete{Module}`
- [ ] Test CRUD operations through the UI
- [ ] Verify authentication and permissions
- [ ] Check audit logs in Firestore

---

## 🔄 Replace These Placeholders

When using this template, replace:
- `{MODULE}` → `INVOICE` (uppercase)
- `{Module}` → `Invoice` (PascalCase)
- `{module}` → `invoice` (lowercase)
- `{modules}` → `invoices` (plural lowercase)

---

*This template provides a complete foundation for new modules following iOL Partner Solutions conventions.* 