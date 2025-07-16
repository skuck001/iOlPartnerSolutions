import { onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions';
import { authenticateUser } from '../../shared/auth.middleware';
import { validateData, accountSchemas, commonSchemas } from '../../shared/validation.middleware';
import { withErrorHandling } from '../../shared/errors';
import { AccountsService } from './accounts.service';
import { z } from 'zod';

// Set global options for all functions
setGlobalOptions({
  maxInstances: 10,
  region: 'us-central1',
});

/**
 * Get accounts with filtering and pagination
 */
export const getAccounts = onCall(
  { region: 'us-central1' },
  withErrorHandling(async (request) => {
    // Authenticate user
    const user = await authenticateUser(request.auth);
    
    // Validate query parameters
    const queryParams = validateData(accountSchemas.query, request.data || {});
    
    // Call service
    return await AccountsService.getAccounts({
      userId: user.uid,
      ...queryParams
    });
  }, { functionName: 'getAccounts', action: 'ACCOUNT_LIST' })
);

/**
 * Get a single account by ID
 */
export const getAccount = onCall(
  { region: 'us-central1' },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    const { accountId } = validateData(
      z.object({ accountId: commonSchemas.id }),
      request.data
    );
    
    return await AccountsService.getAccount(accountId, user.uid);
  }, { functionName: 'getAccount', action: 'ACCOUNT_VIEW' })
);

/**
 * Create a new account
 */
export const createAccount = onCall(
  { region: 'us-central1' },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    // Validate account data
    const accountData = validateData(accountSchemas.create, request.data);
    
    // Call service with user info
    return await AccountsService.createAccount({
      ...accountData,
      ownerId: user.uid,
      createdBy: user.uid,
      updatedBy: user.uid
    }, user.email);
  }, { functionName: 'createAccount', action: 'ACCOUNT_CREATE' })
);

/**
 * Update an existing account
 */
export const updateAccount = onCall(
  { region: 'us-central1' },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    // Validate update data
    const updateData = validateData(accountSchemas.update, request.data);
    const { accountId, ...dataToUpdate } = updateData;
    
    return await AccountsService.updateAccount(
      accountId, 
      dataToUpdate, 
      user.uid, 
      user.email
    );
  }, { functionName: 'updateAccount', action: 'ACCOUNT_UPDATE' })
);

/**
 * Delete an account
 */
export const deleteAccount = onCall(
  { region: 'us-central1' },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    const { accountId } = validateData(
      z.object({ accountId: commonSchemas.id }),
      request.data
    );
    
    await AccountsService.deleteAccount(accountId, user.uid, user.email);
    
    return { success: true, message: 'Account deleted successfully' };
  }, { functionName: 'deleteAccount', action: 'ACCOUNT_DELETE' })
);

/**
 * Get accounts statistics for dashboard
 */
export const getAccountsStats = onCall(
  { region: 'us-central1' },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    return await AccountsService.getAccountsStats(user.uid);
  }, { functionName: 'getAccountsStats', action: 'ACCOUNT_STATS' })
);

/**
 * Bulk update accounts
 */
export const bulkUpdateAccounts = onCall(
  { region: 'us-central1' },
  withErrorHandling(async (request) => {
    const user = await authenticateUser(request.auth);
    
    const { accountIds, updateData } = validateData(
      z.object({
        accountIds: z.array(commonSchemas.id),
        updateData: accountSchemas.update.omit({ accountId: true }).partial()
      }),
      request.data
    );
    
    return await AccountsService.bulkUpdateAccounts(
      accountIds, 
      updateData, 
      user.uid, 
      user.email
    );
  }, { functionName: 'bulkUpdateAccounts', action: 'ACCOUNT_BULK_UPDATE' })
); 