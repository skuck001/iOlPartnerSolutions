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
    region: z.string().min(1, 'Region is required'), // Headoffice Country
    website: commonSchemas.url,
    parentAccountId: z.string().nullish().transform(val => val ?? undefined),
    headquarters: z.string().nullish().transform(val => val ?? undefined),
    description: z.string().nullish().transform(val => val ?? undefined),
    logo: z.string().nullish().transform(val => val ?? undefined),
    primaryContact: z.string().nullish().transform(val => val ?? undefined),
    tags: z.array(z.string()).default([]),
    notes: z.string().nullish().transform(val => val ?? undefined)
  }),
  
  update: z.object({
    accountId: commonSchemas.id,
    name: z.string().min(1).max(100).optional(),
    region: z.string().min(1).optional(),
    website: commonSchemas.url,
    parentAccountId: z.string().nullish().transform(val => val ?? undefined),
    headquarters: z.string().nullish().transform(val => val ?? undefined),
    description: z.string().nullish().transform(val => val ?? undefined),
    logo: z.string().nullish().transform(val => val ?? undefined),
    primaryContact: z.string().nullish().transform(val => val ?? undefined),
    tags: z.array(z.string()).default([]),
    notes: z.string().nullish().transform(val => val ?? undefined)
  }),
  
  query: z.object({
    limit: z.number().min(1).max(100).default(50),
    lastDoc: z.string().nullish().transform(val => val ?? undefined),
    searchTerm: z.string().nullish().transform(val => val ?? undefined),
    region: z.string().nullish().transform(val => val ?? undefined)
  }).optional()
};

// Contact validation schemas
export const contactSchemas = {
  create: z.object({
    name: z.string().min(1, 'Contact name is required').max(100),
    email: z.string().email(),
    phone: z.string().nullish().transform(val => val ?? undefined),
    position: z.string().nullish().transform(val => val ?? undefined),
    department: z.string().nullish().transform(val => val ?? undefined),
    contactType: z.enum(['Primary', 'Secondary', 'Technical', 'Billing', 'Decision Maker', 'Other']).nullish().transform(val => val ?? undefined),
    accountId: commonSchemas.id,
    productIds: z.array(commonSchemas.id).optional(),
    linkedIn: z.string().nullish().transform(val => val ?? undefined),
    timezone: z.string().nullish().transform(val => val ?? undefined),
    preferredContactMethod: z.enum(['Email', 'Phone', 'LinkedIn', 'Teams']).nullish().transform(val => val ?? undefined),
    isDecisionMaker: z.boolean().optional(),
    lastContactDate: z.any().optional(),
    notes: z.string().nullish().transform(val => val ?? undefined)
  }),
  
  update: z.object({
    contactId: commonSchemas.id,
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    phone: z.string().nullish().transform(val => val ?? undefined),
    position: z.string().nullish().transform(val => val ?? undefined),
    department: z.string().nullish().transform(val => val ?? undefined),
    contactType: z.enum(['Primary', 'Secondary', 'Technical', 'Billing', 'Decision Maker', 'Other']).optional(),
    accountId: commonSchemas.id.optional(),
    productIds: z.array(commonSchemas.id).optional(),
    linkedIn: z.string().nullish().transform(val => val ?? undefined),
    timezone: z.string().nullish().transform(val => val ?? undefined),
    preferredContactMethod: z.enum(['Email', 'Phone', 'LinkedIn', 'Teams']).nullish().transform(val => val ?? undefined),
    isDecisionMaker: z.boolean().optional(),
    lastContactDate: z.any().optional(),
    notes: z.string().nullish().transform(val => val ?? undefined)
  })
};

// Product validation schemas
export const productSchemas = {
  create: z.object({
    name: z.string().min(1, 'Product name is required').max(100),
    accountId: commonSchemas.id,
    category: z.enum(['Business Intelligence', 'Revenue Management', 'Distribution', 'Guest Experience', 'Operations', 'Connectivity', 'Booking Engine', 'Channel Management', 'Other']),
    subcategory: z.enum(['Rate Shopping Tools', 'Competitive Intelligence', 'Market Analytics', 'Demand Forecasting', 'Pricing Optimization', 'Reservation Systems', 'Property Management', 'Guest Communication', 'Loyalty Programs', 'API Integration', 'Data Connectivity', 'Other']).nullish().transform(val => val ?? undefined),
    description: z.string().nullish().transform(val => val ?? undefined),
    version: z.string().nullish().transform(val => val ?? undefined),
    status: z.enum(['Active', 'Deprecated', 'Development', 'Beta']).nullish().transform(val => val ?? undefined),
    website: z.string().nullish().transform(val => val ?? undefined),
    contactIds: z.array(commonSchemas.id).optional(),
    tags: z.array(z.string()).optional(),
    targetMarket: z.string().nullish().transform(val => val ?? undefined),
    pricing: z.string().nullish().transform(val => val ?? undefined),
    notes: z.string().nullish().transform(val => val ?? undefined)
  }),
  
  update: z.object({
    productId: commonSchemas.id,
    name: z.string().min(1).max(100).optional(),
    category: z.enum(['Business Intelligence', 'Revenue Management', 'Distribution', 'Guest Experience', 'Operations', 'Connectivity', 'Booking Engine', 'Channel Management', 'Other']).optional(),
    subcategory: z.enum(['Rate Shopping Tools', 'Competitive Intelligence', 'Market Analytics', 'Demand Forecasting', 'Pricing Optimization', 'Reservation Systems', 'Property Management', 'Guest Communication', 'Loyalty Programs', 'API Integration', 'Data Connectivity', 'Other']).optional(),
    description: z.string().nullish().transform(val => val ?? undefined),
    version: z.string().nullish().transform(val => val ?? undefined),
    status: z.enum(['Active', 'Deprecated', 'Development', 'Beta']).nullish().transform(val => val ?? undefined),
    website: z.string().nullish().transform(val => val ?? undefined),
    contactIds: z.array(commonSchemas.id).optional(),
    tags: z.array(z.string()).optional(),
    targetMarket: z.string().nullish().transform(val => val ?? undefined),
    pricing: z.string().nullish().transform(val => val ?? undefined),
    notes: z.string().nullish().transform(val => val ?? undefined)
  })
};

// Opportunity validation schemas
export const opportunitySchemas = {
  create: z.object({
    title: z.string().min(1, 'Opportunity title is required').max(100),
    summary: z.string().nullish().transform(val => val ?? undefined),
    accountId: commonSchemas.id,
    productId: commonSchemas.id.nullish().transform(val => val ?? undefined),
    contactIds: z.array(commonSchemas.id),
    stage: z.enum(['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed-Won', 'Closed-Lost']),
    priority: z.enum(['Critical', 'High', 'Medium', 'Low']).nullish().transform(val => val ?? undefined),
    useCase: z.string().nullish().transform(val => val ?? undefined),
    iolProducts: z.array(z.string()).optional(),
    notes: z.string().nullish().transform(val => val ?? undefined),
    commercialModel: z.string().nullish().transform(val => val ?? undefined),
    potentialVolume: z.number().optional(),
    estimatedDealValue: z.number().optional(),
    expectedCloseDate: z.any().optional(), // Timestamp
    lastActivityDate: z.any().optional(), // Timestamp
    tags: z.array(z.string()).optional()
  }),
  
  update: z.object({
    opportunityId: commonSchemas.id,
    title: z.string().min(1).max(100).optional(),
    summary: z.string().nullish().transform(val => val ?? undefined),
    accountId: commonSchemas.id.optional(),
    productId: commonSchemas.id.nullish().transform(val => val ?? undefined),
    contactIds: z.array(commonSchemas.id).optional(),
    stage: z.enum(['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed-Won', 'Closed-Lost']).optional(),
    priority: z.enum(['Critical', 'High', 'Medium', 'Low']).nullish().transform(val => val ?? undefined),
    useCase: z.string().nullish().transform(val => val ?? undefined),
    iolProducts: z.array(z.string()).optional(),
    notes: z.string().nullish().transform(val => val ?? undefined),
    commercialModel: z.string().nullish().transform(val => val ?? undefined),
    potentialVolume: z.number().optional(),
    estimatedDealValue: z.number().optional(),
    expectedCloseDate: z.any().optional(), // Timestamp
    lastActivityDate: z.any().optional(), // Timestamp
    tags: z.array(z.string()).optional()
  })
};

// Task validation schemas
export const taskSchemas = {
  create: z.object({
    title: z.string().min(1, 'Task title is required').max(100),
    description: z.string().nullish().transform(val => val ?? undefined),
    opportunityId: commonSchemas.id.nullish().transform(val => val ?? undefined),
    assignedTo: commonSchemas.id,
    ownerId: commonSchemas.id,
    dueDate: z.any(), // Timestamp
    status: z.enum(['To do', 'In progress', 'Done']).default('To do'),
    bucket: z.string().nullish().transform(val => val ?? undefined)
  }),
  
  update: z.object({
    taskId: commonSchemas.id,
    title: z.string().min(1).max(100).optional(),
    description: z.string().nullish().transform(val => val ?? undefined),
    opportunityId: commonSchemas.id.nullish().transform(val => val ?? undefined),
    assignedTo: commonSchemas.id.optional(),
    ownerId: commonSchemas.id.optional(),
    dueDate: z.any().optional(), // Timestamp
    status: z.enum(['To do', 'In progress', 'Done']).optional(),
    bucket: z.string().nullish().transform(val => val ?? undefined)
  })
}; 