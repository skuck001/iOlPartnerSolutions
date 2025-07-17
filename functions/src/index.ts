/**
 * Cloud Functions for iOL Partner Solutions
 * 
 * This file exports all the Cloud Functions for the application.
 * Each module (accounts, contacts, etc.) has its own set of functions.
 */

import { initializeApp } from 'firebase-admin/app';
import { setGlobalOptions } from 'firebase-functions';

// Initialize Firebase Admin SDK
initializeApp();

// Set global options for all functions
setGlobalOptions({ 
  maxInstances: 10,
  region: 'us-central1'
});

// Export account functions
export {
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountsStats,
  bulkUpdateAccounts
} from './modules/accounts/accounts.functions';

// Export contact functions
export {
  getContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  getContactsStats,
  bulkUpdateContacts
} from './modules/contacts/contacts.functions';

// Export product functions
export {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsStats,
  bulkUpdateProducts
} from './modules/products/products.functions';

// Export opportunity functions
export {
  getOpportunities,
  getOpportunity,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  getOpportunitiesStats,
  bulkUpdateOpportunities
} from './modules/opportunities/opportunities.functions';

// Export task functions
export {
  // Standalone tasks
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  // Activities within opportunities
  getActivitiesByOpportunity,
  addActivityToOpportunity,
  updateActivityInOpportunity,
  deleteActivityFromOpportunity,
  // Checklist within opportunities
  getChecklistByOpportunity,
  addChecklistItemToOpportunity,
  updateChecklistItemInOpportunity,
  deleteChecklistItemFromOpportunity
} from './modules/tasks/tasks.functions';

// Export user functions
export {
  getUsers,
  getUser,
  updateUser,
  getUsersStats
} from './modules/users/users.functions';

// Export dashboard batch functions
export {
  batchLoadDashboardData
} from './modules/dashboard/dashboard.functions';
