import { z } from 'zod';

export class ValidationError extends Error {
  constructor(message: string, public errors: any[] = []) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const validateData = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        'Validation failed',
        error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }))
      );
    }
    throw new ValidationError('Unknown validation error');
  }
};

// Common validation schemas
export const commonSchemas = {
  id: z.string().min(1, 'ID is required'),
  email: z.string().email('Invalid email format'),
  url: z.string().url('Invalid URL format').optional(),
  timestamp: z.date().optional(),
  tags: z.array(z.string()).optional(),
  pagination: z.object({
    limit: z.number().min(1).max(100).default(50),
    lastDoc: z.string().optional(),
    searchTerm: z.string().optional()
  })
};

// Account validation schemas
export const accountSchemas = {
  create: z.object({
    name: z.string().min(1, 'Account name is required').max(100),
    description: z.string().max(500).optional(),
    website: commonSchemas.url,
    region: z.string().min(1, 'Region is required'),
    industry: z.string().optional(),
    size: z.enum(['Small', 'Medium', 'Large', 'Enterprise']).optional(),
    status: z.enum(['Active', 'Inactive', 'Prospect']).default('Active'),
    tags: commonSchemas.tags
  }),
  
  update: z.object({
    accountId: commonSchemas.id,
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    website: commonSchemas.url,
    region: z.string().min(1).optional(),
    industry: z.string().optional(),
    size: z.enum(['Small', 'Medium', 'Large', 'Enterprise']).optional(),
    status: z.enum(['Active', 'Inactive', 'Prospect']).optional(),
    tags: commonSchemas.tags
  }),
  
  query: z.object({
    limit: z.number().min(1).max(100).default(50),
    lastDoc: z.string().nullish().transform(val => val ?? undefined),
    searchTerm: z.string().nullish().transform(val => val ?? undefined),
    region: z.string().nullish().transform(val => val ?? undefined),
    status: z.enum(['Active', 'Inactive', 'Prospect']).nullish().transform(val => val ?? undefined),
    industry: z.string().nullish().transform(val => val ?? undefined)
  }).optional()
};

// Contact validation schemas
export const contactSchemas = {
  create: z.object({
    name: z.string().min(1, 'Contact name is required').max(100),
    email: commonSchemas.email.optional(),
    phone: z.string().optional(),
    position: z.string().max(100).optional(),
    accountId: commonSchemas.id,
    productIds: z.array(commonSchemas.id).optional(),
    notes: z.string().max(1000).optional(),
    tags: commonSchemas.tags
  }),
  
  update: z.object({
    contactId: commonSchemas.id,
    name: z.string().min(1).max(100).optional(),
    email: commonSchemas.email.optional(),
    phone: z.string().optional(),
    position: z.string().max(100).optional(),
    accountId: commonSchemas.id.optional(),
    productIds: z.array(commonSchemas.id).optional(),
    notes: z.string().max(1000).optional(),
    tags: commonSchemas.tags
  })
};

// Product validation schemas
export const productSchemas = {
  create: z.object({
    name: z.string().min(1, 'Product name is required').max(100),
    description: z.string().max(500).optional(),
    category: z.string().max(50).optional(),
    price: z.number().min(0).optional(),
    currency: z.string().length(3).default('USD'),
    contactIds: z.array(commonSchemas.id).optional(),
    tags: commonSchemas.tags
  }),
  
  update: z.object({
    productId: commonSchemas.id,
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    category: z.string().max(50).optional(),
    price: z.number().min(0).optional(),
    currency: z.string().length(3).optional(),
    contactIds: z.array(commonSchemas.id).optional(),
    tags: commonSchemas.tags
  })
};

// Opportunity validation schemas
export const opportunitySchemas = {
  create: z.object({
    title: z.string().min(1, 'Opportunity title is required').max(100),
    description: z.string().max(1000).optional(),
    accountId: commonSchemas.id,
    contactIds: z.array(commonSchemas.id).optional(),
    productId: commonSchemas.id.optional(),
    stage: z.enum(['Discovery', 'Proposal', 'Negotiation', 'Closed-Won', 'Closed-Lost']).default('Discovery'),
    estimatedDealValue: z.number().min(0).optional(),
    probability: z.number().min(0).max(100).optional(),
    expectedCloseDate: z.date().optional(),
    notes: z.string().max(2000).optional(),
    tags: commonSchemas.tags
  }),
  
  update: z.object({
    opportunityId: commonSchemas.id,
    title: z.string().min(1).max(100).optional(),
    description: z.string().max(1000).optional(),
    accountId: commonSchemas.id.optional(),
    contactIds: z.array(commonSchemas.id).optional(),
    productId: commonSchemas.id.optional(),
    stage: z.enum(['Discovery', 'Proposal', 'Negotiation', 'Closed-Won', 'Closed-Lost']).optional(),
    estimatedDealValue: z.number().min(0).optional(),
    probability: z.number().min(0).max(100).optional(),
    expectedCloseDate: z.date().optional(),
    notes: z.string().max(2000).optional(),
    tags: commonSchemas.tags
  })
};

// Task validation schemas
export const taskSchemas = {
  create: z.object({
    title: z.string().min(1, 'Task title is required').max(100),
    description: z.string().max(500).optional(),
    opportunityId: commonSchemas.id.optional(),
    assignedTo: commonSchemas.id,
    dueDate: z.date(),
    status: z.enum(['To do', 'In progress', 'Done']).default('To do'),
    priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
    bucket: z.string().max(50).optional(),
    tags: commonSchemas.tags
  }),
  
  update: z.object({
    taskId: commonSchemas.id,
    title: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    opportunityId: commonSchemas.id.optional(),
    assignedTo: commonSchemas.id.optional(),
    dueDate: z.date().optional(),
    status: z.enum(['To do', 'In progress', 'Done']).optional(),
    priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
    bucket: z.string().max(50).optional(),
    tags: commonSchemas.tags
  })
}; 