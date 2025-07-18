# iOL Partner Solutions - Quick Reference

## 🚀 New Module Checklist

### 1. Backend Setup
```bash
# Create module structure
mkdir functions/src/modules/newmodule
touch functions/src/modules/newmodule/newmodule.service.ts
touch functions/src/modules/newmodule/newmodule.functions.ts
```

### 2. Copy Template Files
- Copy `products.service.ts` → `newmodule.service.ts`
- Copy `products.functions.ts` → `newmodule.functions.ts`
- Update class names, collection names, and schemas

### 3. Export Functions
```typescript
// functions/src/index.ts
export * from './modules/newmodule/newmodule.functions';
```

### 4. Frontend Setup
```bash
# Create types and hooks
touch src/types/NewModule.ts
touch src/hooks/useNewModuleApi.ts
```

### 5. Add Navigation
```typescript
// src/components/Layout.tsx - Add to navigationItems array
{ name: 'New Module', href: '/newmodule', icon: YourIcon }
```

---

## 📝 Validation Schema Template

```typescript
import { z } from 'zod';

export const CreateEntitySchema = z.object({
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

export const UpdateEntitySchema = z.object({
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

## ⚡ Cloud Function Template

```typescript
export const createEntity = onCall(
  { 
    cors: ['http://localhost:5173', 'https://localhost:5173', 'https://iol-partner-solutions.web.app'], 
    maxInstances: 10 
  },
  async (request) => {
    return withErrorHandling(async () => {
      const user = await authenticateUser(request.auth);
      await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'createEntity');
      
      const validatedData = await validateData(CreateEntitySchema, request.data);
      
      const entityData = {
        ...validatedData,
        ownerId: user.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      return await entityService.createEntity(entityData, user.uid);
    });
  }
);
```

---

## 🛠️ Common Commands

### Development
```bash
# Build and deploy single function
cd functions
npm run build
firebase deploy --only functions:createEntity

# Deploy all functions
firebase deploy --only functions

# Test locally
npm run serve

# Interactive testing
firebase functions:shell
```

### Git Workflow
```bash
# Standard workflow
git add .
git commit -m "feat: add new module functionality"
git push origin main
```

---

## 🔐 Rate Limiting Presets

```typescript
// Read operations (200/min)
await RateLimiter.checkLimit(user.uid, RateLimitPresets.read.maxRequests, RateLimitPresets.read.windowMs, 'functionName');

// Write operations (50/min)
await RateLimiter.checkLimit(user.uid, RateLimitPresets.write.maxRequests, RateLimitPresets.write.windowMs, 'functionName');

// Heavy operations (10/min)
await RateLimiter.checkLimit(user.uid, RateLimitPresets.heavy.maxRequests, RateLimitPresets.heavy.windowMs, 'functionName');
```

---

## 🎯 Standard Field Patterns

```typescript
// Common field validations
const emailField = z.string().email().min(1, 'Email is required');
const nameField = z.string().min(1, 'Name is required').max(100);
const optionalTextField = z.string().nullish();
const urlField = z.string().url().or(z.literal('')).nullish();
const ownerIdField = z.string().min(1, 'Owner ID is required');
const phoneField = z.string().nullish();
const dateField = z.string().datetime().nullish();
```

---

## 🚨 Common Errors

### Firestore `undefined` Error
```
Cannot use 'undefined' as a Firestore value
```
**Fix**: Add transform function to schema:
```typescript
.transform((data) => {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      acc[key] = value;
    }
    return acc;
  }, {} as any);
});
```

### TypeScript Compilation Error
```bash
npm run build
# Fix TypeScript errors before deploying
```

### CORS Error
```typescript
// Always include these origins
cors: [
  'http://localhost:5173',
  'https://localhost:5173', 
  'https://iol-partner-solutions.web.app'
]
```

---

## 📋 Pre-deployment Checklist

- [ ] `npm run build` passes without errors
- [ ] Function uses `authenticateUser()`
- [ ] Rate limiting is applied
- [ ] Validation schema has transform function
- [ ] CORS origins are correct
- [ ] Audit logging is included
- [ ] Error handling with `withErrorHandling()`

---

## 🔍 Debugging Tips

### Check Function Logs
```bash
firebase functions:log
firebase functions:log --only createEntity
```

### Test Function Locally
```bash
cd functions
npm run serve
# Then use Firebase Functions shell or Postman
```

### Check Firestore Data
```bash
# Use Firebase Console -> Firestore Database
# Verify data structure and permissions
```

---

## 📁 File Locations Reference

### Backend
- Functions: `functions/src/modules/{module}/{module}.functions.ts`
- Services: `functions/src/modules/{module}/{module}.service.ts`
- Types: `functions/src/types.ts`
- Middleware: `functions/src/shared/`

### Frontend
- Types: `src/types/{Module}.ts`
- Hooks: `src/hooks/use{Module}Api.ts`
- Components: `src/components/`
- Pages: `src/pages/{Module}.tsx`

### Config
- Firebase: `firebase.json`
- Firestore Rules: `firestore.rules`
- TypeScript: `tsconfig.json` (root and functions)

---

*Keep this guide handy for quick reference during development!* 