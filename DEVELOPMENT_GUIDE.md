# iOL Partner Solutions - Development Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Module Structure](#module-structure)
3. [Validation Patterns](#validation-patterns)
4. [Cloud Functions Development](#cloud-functions-development)
5. [Service Layer Patterns](#service-layer-patterns)
6. [Authentication & Security](#authentication--security)
7. [CRUD Operations](#crud-operations)
8. [Error Handling](#error-handling)
9. [Testing & Deployment](#testing--deployment)
10. [Code Examples](#code-examples)

---

## Architecture Overview

### Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Firebase Cloud Functions (Node.js + TypeScript)
- **Database**: Cloud Firestore
- **Authentication**: Firebase Auth
- **Hosting**: Firebase Hosting

### Project Structure
```
iOL_App/
├── src/                          # Frontend React application
│   ├── components/               # Reusable UI components
│   ├── pages/                    # Page components
│   ├── hooks/                    # Custom React hooks
│   ├── context/                  # React context providers
│   ├── types/                    # TypeScript type definitions
│   └── lib/                      # Utility libraries
├── functions/                    # Cloud Functions backend
│   ├── src/
│   │   ├── modules/              # Business logic modules
│   │   ├── shared/               # Shared utilities
│   │   ├── types.ts              # Shared TypeScript types
│   │   └── index.ts              # Function exports
│   └── lib/                      # Compiled JavaScript (auto-generated)
└── firestore.rules              # Firestore security rules
```

---

## Module Structure

### Standard Module Layout
Each business module follows this consistent structure:

```
functions/src/modules/{module}/
├── {module}.functions.ts         # Cloud Functions definitions
├── {module}.service.ts           # Business logic service class
└── README.md                     # Module-specific documentation
```

### Naming Conventions
- **Functions**: Use camelCase with descriptive verbs
  - `createAccount`, `updateProduct`, `deleteTask`
  - `getAccountsByOwner`, `bulkUpdateOpportunities`
- **Services**: Use PascalCase with "Service" suffix
  - `AccountsService`, `ProductsService`, `OpportunitiesService`
- **Types**: Use PascalCase for interfaces and types
  - `Account`, `Product`, `CreateAccountRequest`

---

## Validation Patterns

### Zod Schema Conventions

#### 1. Field Validation Rules
```typescript
import { z } from 'zod';

// Standard field patterns
const emailField = z.string().email().min(1, 'Email is required');
const nameField = z.string().min(1, 'Name is required').max(100);
const optionalTextField = z.string().nullish();
const urlField = z.string().url().or(z.literal('')).nullish();
const ownerIdField = z.string().min(1, 'Owner ID is required');
```

#### 2. Schema Structure
```typescript
// Create schema - all required fields
export const CreateEntitySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email(),
  ownerId: z.string().min(1, 'Owner ID is required'),
  // ... other required fields
}).transform((data) => {
  // Filter out null, undefined, and empty string values
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {} as any);
});

// Update schema - all optional except ID
export const UpdateEntitySchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1).nullish(),
  email: z.string().email().nullish(),
  // ... other optional fields
}).transform((data) => {
  const { id, ...updateData } = data;
  // Filter out null, undefined, and empty string values
  const cleanData = Object.entries(updateData).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {} as any);
  return { id, updateData: cleanData };
});
```

#### 3. Transform Functions
**CRITICAL**: Always use transform functions to clean data for Firestore compatibility:

```typescript
.transform((data) => {
  // Remove null, undefined, and empty string values
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {} as any);
});
```

**Why**: Firestore rejects `undefined` values, causing validation errors.

---

## Cloud Functions Development

### Function Structure Template
```typescript
import { onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions';
import { authenticateUser } from '../../shared/auth.middleware';
import { validateData } from '../../shared/validation.middleware';
import { withErrorHandling } from '../../shared/errors';
import { RateLimiter, RateLimitPresets } from '../../shared/rateLimiter';
import { EntityService } from './entity.service';

// Set global options
setGlobalOptions({
  maxInstances: 10,
  region: 'us-central1',
});

const entityService = new EntityService();

// Create function
export const createEntity = onCall(
  { 
    cors: [
      'http://localhost:5173', 
      'https://localhost:5173', 
      'https://iol-partner-solutions.web.app'
    ], 
    maxInstances: 10 
  },
  async (request) => {
    return withErrorHandling(async () => {
      // 1. Authenticate user
      const user = await authenticateUser(request.auth);
      
      // 2. Apply rate limiting
      await RateLimiter.checkLimit(
        user.uid, 
        RateLimitPresets.write.maxRequests, 
        RateLimitPresets.write.windowMs, 
        'createEntity'
      );
      
      // 3. Validate request data
      const validatedData = await validateData(CreateEntitySchema, request.data);
      
      // 4. Add system fields
      const entityData = {
        ...validatedData,
        ownerId: user.uid, // Set owner to current user
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // 5. Execute business logic
      const result = await entityService.createEntity(entityData);
      
      return result;
    });
  }
);
```

### Standard Function Types

#### 1. Create Functions
- Use `RateLimitPresets.write`
- Add `ownerId`, `createdAt`, `updatedAt`
- Return created entity with generated ID

#### 2. Read Functions
- Use `RateLimitPresets.read`
- Support filtering by owner
- Include pagination for list operations

#### 3. Update Functions
- Use `RateLimitPresets.write`
- Add `updatedAt` timestamp
- Support partial updates

#### 4. Delete Functions
- Use `RateLimitPresets.write`
- Soft delete when possible (add `deletedAt`)
- Hard delete for sensitive data

### CORS Configuration
Always include these origins:
```typescript
cors: [
  'http://localhost:5173',      // Local development HTTP
  'https://localhost:5173',     // Local development HTTPS
  'https://iol-partner-solutions.web.app'  // Production
]
```

---

## Service Layer Patterns

### Service Class Template
```typescript
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { AuditService } from '../shared/audit.service';

export class EntityService {
  private db = getFirestore();
  private collection = this.db.collection('entities');
  private auditService = new AuditService();

  async createEntity(data: any, userId: string): Promise<any> {
    const docRef = this.collection.doc();
    const entityData = {
      id: docRef.id,
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await docRef.set(entityData);

    // Log audit trail
    await this.auditService.logAction(userId, 'create', 'entity', docRef.id, {
      action: 'Entity created',
      entityData: entityData,
    });

    return entityData;
  }

  async getEntity(id: string): Promise<any | null> {
    const doc = await this.collection.doc(id).get();
    return doc.exists ? doc.data() : null;
  }

  async updateEntity(id: string, updateData: any, userId: string): Promise<any> {
    const docRef = this.collection.doc(id);
    const updatedData = {
      ...updateData,
      updatedAt: Timestamp.now(),
    };

    await docRef.update(updatedData);

    // Log audit trail
    await this.auditService.logAction(userId, 'update', 'entity', id, {
      action: 'Entity updated',
      updatedFields: Object.keys(updateData),
    });

    const updated = await docRef.get();
    return updated.data();
  }

  async deleteEntity(id: string, userId: string): Promise<void> {
    await this.collection.doc(id).delete();

    // Log audit trail
    await this.auditService.logAction(userId, 'delete', 'entity', id, {
      action: 'Entity deleted',
    });
  }

  async getEntitiesByOwner(ownerId: string): Promise<any[]> {
    const snapshot = await this.collection
      .where('ownerId', '==', ownerId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => doc.data());
  }
}
```

### Firestore Best Practices
1. **Always use Timestamps**: `Timestamp.now()` for Firestore compatibility
2. **Include audit logging**: Track all create/update/delete operations
3. **Filter by owner**: Ensure data isolation between users
4. **Order results**: Provide consistent ordering (usually by `createdAt`)
5. **Handle errors**: Wrap Firestore operations in try-catch blocks

---

## Authentication & Security

### Authentication Middleware
Every protected function must use:
```typescript
const user = await authenticateUser(request.auth);
```

This validates:
- User is authenticated
- Token is valid and not expired
- User document exists in Firestore
- Returns user with role and permissions

### Rate Limiting
Apply appropriate rate limits:
```typescript
// Read operations (more permissive)
await RateLimiter.checkLimit(
  user.uid, 
  RateLimitPresets.read.maxRequests,    // 200 requests
  RateLimitPresets.read.windowMs,       // per minute
  'functionName'
);

// Write operations (more restrictive)
await RateLimiter.checkLimit(
  user.uid, 
  RateLimitPresets.write.maxRequests,   // 50 requests
  RateLimitPresets.write.windowMs,      // per minute
  'functionName'
);

// Heavy operations (very restrictive)
await RateLimiter.checkLimit(
  user.uid, 
  RateLimitPresets.heavy.maxRequests,   // 10 requests
  RateLimitPresets.heavy.windowMs,      // per minute
  'functionName'
);
```

### Security Rules
Firestore security rules block direct client access:
```javascript
// All business data must go through Cloud Functions
match /entities/{document} {
  allow read, write: if false; // Block all direct access
}

// Users can only access their own profile
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

---

## CRUD Operations

### Create Operation Pattern
```typescript
export const createEntity = onCall({ /* config */ }, async (request) => {
  return withErrorHandling(async () => {
    const user = await authenticateUser(request.auth);
    await RateLimiter.checkLimit(/* write limits */);
    
    const validatedData = await validateData(CreateEntitySchema, request.data);
    
    const entityData = {
      ...validatedData,
      ownerId: user.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    return await entityService.createEntity(entityData, user.uid);
  });
});
```

### Read Operation Pattern
```typescript
export const getEntities = onCall({ /* config */ }, async (request) => {
  return withErrorHandling(async () => {
    const user = await authenticateUser(request.auth);
    await RateLimiter.checkLimit(/* read limits */);
    
    // Optional query validation
    const query = request.data || {};
    
    return await entityService.getEntitiesByOwner(user.uid, query);
  });
});
```

### Update Operation Pattern
```typescript
export const updateEntity = onCall({ /* config */ }, async (request) => {
  return withErrorHandling(async () => {
    const user = await authenticateUser(request.auth);
    await RateLimiter.checkLimit(/* write limits */);
    
    const { id, updateData } = await validateData(UpdateEntitySchema, request.data);
    
    // Verify ownership
    const existing = await entityService.getEntity(id);
    if (!existing || existing.ownerId !== user.uid) {
      throw new HttpsError('permission-denied', 'Access denied');
    }
    
    return await entityService.updateEntity(id, updateData, user.uid);
  });
});
```

### Delete Operation Pattern
```typescript
export const deleteEntity = onCall({ /* config */ }, async (request) => {
  return withErrorHandling(async () => {
    const user = await authenticateUser(request.auth);
    await RateLimiter.checkLimit(/* write limits */);
    
    const { entityId } = await validateData(DeleteEntitySchema, request.data);
    
    // Verify ownership
    const existing = await entityService.getEntity(entityId);
    if (!existing || existing.ownerId !== user.uid) {
      throw new HttpsError('permission-denied', 'Access denied');
    }
    
    await entityService.deleteEntity(entityId, user.uid);
    return { success: true };
  });
});
```

---

## Error Handling

### Standard Error Types
```typescript
import { HttpsError } from 'firebase-functions/v2/https';

// Use these standard error codes:
throw new HttpsError('invalid-argument', 'Invalid input data');
throw new HttpsError('permission-denied', 'Access denied');
throw new HttpsError('not-found', 'Entity not found');
throw new HttpsError('already-exists', 'Entity already exists');
throw new HttpsError('resource-exhausted', 'Rate limit exceeded');
throw new HttpsError('internal', 'Internal server error');
```

### Error Wrapper
Always wrap functions with error handling:
```typescript
export const myFunction = onCall({ /* config */ }, async (request) => {
  return withErrorHandling(async () => {
    // Your function logic here
  });
});
```

### Validation Errors
```typescript
// Zod validation automatically throws descriptive errors
const validatedData = await validateData(MySchema, request.data);
// If validation fails, user gets detailed field-specific error messages
```

---

## Testing & Deployment

### Development Workflow
```bash
# 1. Navigate to functions directory
cd functions

# 2. Install dependencies
npm install

# 3. Build TypeScript
npm run build

# 4. Test locally (optional)
npm run serve

# 5. Deploy single function (preferred)
firebase deploy --only functions:createEntity

# 6. Deploy all functions (when needed)
firebase deploy --only functions
```

### Pre-deployment Checklist
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] Function names follow naming conventions
- [ ] Validation schemas include transform functions
- [ ] Authentication middleware is applied
- [ ] Rate limiting is configured
- [ ] CORS origins are correct
- [ ] Audit logging is implemented
- [ ] Error handling is in place

### Testing Functions
```bash
# Build and test locally
cd functions
npm run build
npm run serve

# Test individual function
firebase functions:shell

# In the shell:
createEntity({name: "test", email: "test@example.com"})
```

---

## Code Examples

### Complete Module Example
See the existing modules for reference:
- `functions/src/modules/products/` - Complete CRUD operations
- `functions/src/modules/accounts/` - Account management
- `functions/src/modules/opportunities/` - Business opportunities with AI features

### Adding a New Module

1. **Create module directory**:
```bash
mkdir functions/src/modules/newmodule
```

2. **Create service file** (`newmodule.service.ts`):
```typescript
// Copy from products.service.ts and modify
```

3. **Create functions file** (`newmodule.functions.ts`):
```typescript
// Copy from products.functions.ts and modify
```

4. **Export functions** in `functions/src/index.ts`:
```typescript
export * from './modules/newmodule/newmodule.functions';
```

5. **Create frontend types** in `src/types/NewModule.ts`

6. **Create API hook** in `src/hooks/useNewModuleApi.ts`

7. **Add to navigation** in `src/components/Layout.tsx`

### Validation Schema Template
```typescript
export const CreateNewModuleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().nullish(),
  ownerId: z.string().min(1, 'Owner ID is required'),
}).transform((data) => {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {} as any);
});

export const UpdateNewModuleSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  name: z.string().min(1).nullish(),
  description: z.string().nullish(),
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
```

---

## Best Practices Summary

### DO's ✅
- Use consistent naming conventions
- Apply authentication to all protected functions
- Include rate limiting on all functions
- Use transform functions in Zod schemas
- Log audit trails for data changes
- Filter data by owner for security
- Use TypeScript for type safety
- Handle errors gracefully
- Deploy individual functions when possible

### DON'Ts ❌
- Don't allow `undefined` values to reach Firestore
- Don't skip authentication on protected functions
- Don't hardcode user IDs or sensitive data
- Don't deploy all functions for small changes
- Don't bypass validation or rate limiting
- Don't allow direct Firestore access from client
- Don't forget to add audit logging
- Don't use `any` types without justification

### Performance Tips 🚀
- Use Cloud Functions 2nd generation
- Set appropriate `maxInstances` limits
- Cache frequently accessed data
- Use batch operations for bulk updates
- Index Firestore queries properly
- Minimize function cold starts
- Use efficient data structures

---

*This guide should be updated as patterns evolve and new best practices are established.* 