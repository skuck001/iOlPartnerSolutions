import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';

const db = getFirestore();

export interface AuditLog {
  action: string;
  userId: string;
  userEmail?: string;
  resourceType: string;
  resourceId: string;
  data?: any;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    timestamp: Timestamp;
    functionName?: string;
  };
  result: 'SUCCESS' | 'FAILURE';
  error?: string;
}

export class AuditService {
  static async log(params: {
    action: string;
    userId: string;
    userEmail?: string;
    resourceType?: string;
    resourceId?: string;
    data?: any;
    metadata?: any;
    result?: 'SUCCESS' | 'FAILURE';
    error?: string;
  }): Promise<void> {
    try {
      const auditLog: AuditLog = {
        action: params.action,
        userId: params.userId,
        userEmail: params.userEmail,
        resourceType: params.resourceType || 'unknown',
        resourceId: params.resourceId || 'unknown',
        data: params.data ? this.sanitizeData(params.data) : null,
        metadata: {
          ...params.metadata,
          timestamp: Timestamp.now(),
          functionName: process.env.FUNCTION_NAME
        },
        result: params.result || 'SUCCESS',
        error: params.error
      };

      // Store in Firestore for persistence and querying
      await db.collection('audit_logs').add(auditLog);

      // Also log to Cloud Logging for immediate monitoring
      logger.info('Audit Log', auditLog);
    } catch (error) {
      // Don't let audit failures break the main operation
      logger.error('Failed to write audit log', { error, params });
    }
  }

  static async logAccountAction(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW',
    userId: string,
    accountId: string,
    data?: any,
    userEmail?: string
  ): Promise<void> {
    await this.log({
      action: `ACCOUNT_${action}`,
      userId,
      userEmail,
      resourceType: 'account',
      resourceId: accountId,
      data
    });
  }

  static async logContactAction(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW',
    userId: string,
    contactId: string,
    data?: any,
    userEmail?: string
  ): Promise<void> {
    await this.log({
      action: `CONTACT_${action}`,
      userId,
      userEmail,
      resourceType: 'contact',
      resourceId: contactId,
      data
    });
  }

  static async logOpportunityAction(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'STAGE_CHANGE',
    userId: string,
    opportunityId: string,
    data?: any,
    userEmail?: string
  ): Promise<void> {
    await this.log({
      action: `OPPORTUNITY_${action}`,
      userId,
      userEmail,
      resourceType: 'opportunity',
      resourceId: opportunityId,
      data
    });
  }

  static async logProductAction(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW',
    userId: string,
    productId: string,
    data?: any,
    userEmail?: string
  ): Promise<void> {
    await this.log({
      action: `PRODUCT_${action}`,
      userId,
      userEmail,
      resourceType: 'product',
      resourceId: productId,
      data
    });
  }

  static async logTaskAction(
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'COMPLETE',
    userId: string,
    taskId: string,
    data?: any,
    userEmail?: string
  ): Promise<void> {
    await this.log({
      action: `TASK_${action}`,
      userId,
      userEmail,
      resourceType: 'task',
      resourceId: taskId,
      data
    });
  }

  static async logAuthAction(
    action: 'LOGIN' | 'LOGOUT' | 'ACCESS_DENIED' | 'PERMISSION_CHECK',
    userId: string,
    data?: any,
    userEmail?: string
  ): Promise<void> {
    await this.log({
      action: `AUTH_${action}`,
      userId,
      userEmail,
      resourceType: 'auth',
      resourceId: userId,
      data
    });
  }

  static async logError(
    action: string,
    userId: string,
    error: Error,
    data?: any,
    userEmail?: string
  ): Promise<void> {
    await this.log({
      action,
      userId,
      userEmail,
      resourceType: 'error',
      resourceId: 'error',
      data,
      result: 'FAILURE',
      error: error.message
    });
  }

  // Utility method to sanitize sensitive data before logging
  private static sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'ssn', 'credit'];
    const sanitized = { ...data };

    const sanitizeObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
      }

      if (obj && typeof obj === 'object') {
        const result = { ...obj };
        Object.keys(result).forEach(key => {
          const lowerKey = key.toLowerCase();
          if (sensitiveFields.some(field => lowerKey.includes(field))) {
            result[key] = '[REDACTED]';
          } else if (typeof result[key] === 'object') {
            result[key] = sanitizeObject(result[key]);
          }
        });
        return result;
      }

      return obj;
    };

    return sanitizeObject(sanitized);
  }

  // Query audit logs for compliance and security analysis
  static async getAuditLogs(params: {
    userId?: string;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    let query = db.collection('audit_logs').orderBy('metadata.timestamp', 'desc');

    if (params.userId) {
      query = query.where('userId', '==', params.userId);
    }

    if (params.action) {
      query = query.where('action', '==', params.action);
    }

    if (params.resourceType) {
      query = query.where('resourceType', '==', params.resourceType);
    }

    if (params.resourceId) {
      query = query.where('resourceId', '==', params.resourceId);
    }

    if (params.startDate) {
      query = query.where('metadata.timestamp', '>=', Timestamp.fromDate(params.startDate));
    }

    if (params.endDate) {
      query = query.where('metadata.timestamp', '<=', Timestamp.fromDate(params.endDate));
    }

    if (params.limit) {
      query = query.limit(params.limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
} 