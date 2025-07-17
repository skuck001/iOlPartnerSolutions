import { logger } from 'firebase-functions/v2';
import { RateLimitError } from './errors';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private static limits = new Map<string, RateLimitEntry>();
  
  /**
   * Check if a user has exceeded their rate limit
   * @param userId User ID to check
   * @param maxRequests Maximum requests allowed in the window
   * @param windowMs Time window in milliseconds
   * @param identifier Optional identifier for different rate limit buckets
   */
  static async checkLimit(
    userId: string, 
    maxRequests: number = 100, 
    windowMs: number = 60000, // 1 minute default
    identifier: string = 'default'
  ): Promise<void> {
    const now = Date.now();
    const userKey = `${userId}:${identifier}`;
    const current = this.limits.get(userKey);
    
    // If no entry exists or the window has expired, create a new one
    if (!current || current.resetTime <= now) {
      this.limits.set(userKey, { count: 1, resetTime: now + windowMs });
      return;
    }
    
    // If user has exceeded the limit, throw an error
    if (current.count >= maxRequests) {
      logger.warn('Rate limit exceeded', {
        userId,
        identifier,
        current: current.count,
        max: maxRequests,
        windowMs
      });
      throw new RateLimitError(`Rate limit exceeded: ${maxRequests} requests per ${windowMs/1000} seconds`);
    }
    
    // Increment the counter
    current.count++;
  }

  /**
   * Clear expired entries to prevent memory leaks
   */
  static cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (entry.resetTime <= now) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * Clear all rate limit entries for a user
   */
  static clearUserLimits(userId: string): void {
    for (const key of this.limits.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.limits.delete(key);
      }
    }
  }

  /**
   * Get current rate limit status for a user
   */
  static getStatus(userId: string, identifier: string = 'default'): {
    remaining: number;
    resetTime: number;
    maxRequests: number;
  } | null {
    const userKey = `${userId}:${identifier}`;
    const entry = this.limits.get(userKey);
    
    if (!entry) {
      return null;
    }
    
    // Default values - these would be passed from the calling function in a real implementation
    const maxRequests = 100;
    
    return {
      remaining: Math.max(0, maxRequests - entry.count),
      resetTime: entry.resetTime,
      maxRequests
    };
  }
}

// Cleanup expired entries every 5 minutes
setInterval(() => {
  RateLimiter.cleanup();
}, 5 * 60 * 1000);

// Rate limiting presets for different operations
export const RateLimitPresets = {
  // General API calls
  general: { maxRequests: 100, windowMs: 60000 }, // 100 requests per minute
  
  // Read operations (more permissive)
  read: { maxRequests: 200, windowMs: 60000 }, // 200 requests per minute
  
  // Write operations (more restrictive)
  write: { maxRequests: 50, windowMs: 60000 }, // 50 requests per minute
  
  // Heavy operations (very restrictive)
  heavy: { maxRequests: 10, windowMs: 60000 }, // 10 requests per minute
  
  // Authentication operations
  auth: { maxRequests: 20, windowMs: 60000 }, // 20 requests per minute
  
  // Statistics/reporting (moderate)
  stats: { maxRequests: 30, windowMs: 60000 }, // 30 requests per minute
};

/**
 * Decorator function to apply rate limiting to Cloud Functions
 */
export function withRateLimit(preset: keyof typeof RateLimitPresets = 'general') {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function(request: any, ...args: any[]) {
      // Extract user ID from the request (assuming authentication middleware has run)
      const userId = request.auth?.uid;
      
      if (userId) {
        const config = RateLimitPresets[preset];
        await RateLimiter.checkLimit(userId, config.maxRequests, config.windowMs, preset);
      }
      
      return method.apply(this, [request, ...args]);
    };
    
    return descriptor;
  };
} 