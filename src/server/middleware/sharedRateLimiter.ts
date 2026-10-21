import { getDb } from '../db/firestore';
import { FieldValue } from '../db/firestore';

/**
 * Postgres-backed rate limiter that works across all server instances.
 * Uses a sharded counter approach similar to workspaceShards but for rate limiting.
 * 
 * S-01: Shared rate limiter - counts are stored in Postgres so all server instances
 * share the same rate limit buckets, not per-instance memory.
 */

interface RateLimitConfig {
  windowMs: number; // window in milliseconds
  max: number; // max requests per window
  keyPrefix: string; // prefix for the rate limit key (e.g., 'ip', 'api-key', 'user')
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

/**
 * Rate limit entry stored in Postgres
 */
interface RateLimitEntry {
  key: string; // e.g., 'ip:192.168.1.1' or 'api-key:abc123'
  shardId: number; // 0-9 for sharding
  count: number; // request count in current window
  windowStart: number; // timestamp when current window started
  workspaceId: string; // for workspace-scoped limits
}

const NUM_SHARDS = 10;
const RATE_LIMIT_COLLECTION = 'rateLimitEntries';

/**
 * Get shard ID for a given key to distribute load evenly
 */
function getShardId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % NUM_SHARDS;
}

/**
 * Generate document ID for rate limit entry
 */
function getEntryId(key: string, shardId: number): string {
  return `rl_${key}_${shardId}`;
}

/**
 * Get current window start time aligned to windowMs
 */
function getWindowStart(windowMs: number): number {
  return Math.floor(Date.now() / windowMs) * windowMs;
}

/**
 * Shared rate limiter using Postgres-backed storage.
 * All server instances share the same counter, so rate limits are enforced
 * globally, not per-instance.
 */
export class SharedRateLimiter {
  private readonly config: RateLimitConfig;
  private readonly db: ReturnType<typeof getDb>;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.db = getDb();
  }

  /**
   * Check and increment rate limit for a given identifier
   * @param identifier - The thing being rate limited (IP address, API key, user ID, etc.)
   * @param workspaceId - Optional workspace ID for workspace-scoped limits
   */
  async checkAndIncrement(identifier: string, workspaceId: string = ''): Promise<RateLimitResult> {
    const key = workspaceId ? `${this.config.keyPrefix}:${workspaceId}:${identifier}` : `${this.config.keyPrefix}:${identifier}`;
    const shardId = getShardId(key);
    const entryId = getEntryId(key, shardId);
    const windowStart = getWindowStart(this.config.windowMs);

    try {
      const docRef = this.db.collection(RATE_LIMIT_COLLECTION).doc(entryId);
      const doc = await docRef.get();

      let currentCount = 0;
      let currentWindowStart = windowStart;

      if (doc.exists) {
        const data = doc.data();
        if (data && typeof data.count === 'number') {
          // Check if we're still in the same window
          if (data.windowStart === windowStart) {
            currentCount = data.count;
            currentWindowStart = data.windowStart;
          }
          // If window expired, start fresh
        }
      }

      // Check if we're over the limit
      if (currentCount >= this.config.max) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: currentWindowStart + this.config.windowMs,
          limit: this.config.max
        };
      }

      // Increment the counter
      await docRef.set({
        key,
        shardId,
        count: currentCount + 1,
        windowStart,
        workspaceId: workspaceId || ''
      }, { merge: true });

      return {
        allowed: true,
        remaining: this.config.max - currentCount - 1,
        resetTime: windowStart + this.config.windowMs,
        limit: this.config.max
      };
    } catch (err) {
      // If Postgres is unavailable, fall back to allowing the request
      // but log the error for monitoring
      console.error('[SharedRateLimiter] Error checking rate limit:', err);
      // Fail open - allow the request but with a conservative remaining count
      return {
        allowed: true,
        remaining: 0,
        resetTime: Date.now() + this.config.windowMs,
        limit: this.config.max
      };
    }
  }

  /**
   * Get the current rate limit status for a given identifier
   */
  async getStatus(identifier: string, workspaceId: string = ''): Promise<RateLimitResult> {
    const key = workspaceId ? `${this.config.keyPrefix}:${workspaceId}:${identifier}` : `${this.config.keyPrefix}:${identifier}`;
    const shardId = getShardId(key);
    const entryId = getEntryId(key, shardId);
    const windowStart = getWindowStart(this.config.windowMs);

    try {
      const docRef = this.db.collection(RATE_LIMIT_COLLECTION).doc(entryId);
      const doc = await docRef.get();

      let currentCount = 0;

      if (doc.exists) {
        const data = doc.data();
        if (data && typeof data.count === 'number' && data.windowStart === windowStart) {
          currentCount = data.count;
        }
      }

      return {
        allowed: currentCount < this.config.max,
        remaining: Math.max(0, this.config.max - currentCount),
        resetTime: windowStart + this.config.windowMs,
        limit: this.config.max
      };
    } catch (err) {
      console.error('[SharedRateLimiter] Error getting rate limit status:', err);
      return {
        allowed: true,
        remaining: this.config.max,
        resetTime: Date.now() + this.config.windowMs,
        limit: this.config.max
      };
    }
  }

  /**
   * Reset rate limit for a specific identifier (useful for testing or admin override)
   */
  async reset(identifier: string, workspaceId: string = ''): Promise<void> {
    const key = workspaceId ? `${this.config.keyPrefix}:${workspaceId}:${identifier}` : `${this.config.keyPrefix}:${identifier}`;
    const shardId = getShardId(key);
    const entryId = getEntryId(key, shardId);

    try {
      const docRef = this.db.collection(RATE_LIMIT_COLLECTION).doc(entryId);
      await docRef.delete();
    } catch (err) {
      console.error('[SharedRateLimiter] Error resetting rate limit:', err);
    }
  }

  /**
   * Clean up expired rate limit entries (can be run as a background job)
   */
  async cleanupExpired(): Promise<number> {
    try {
      const cutoff = Date.now() - this.config.windowMs * 2; // Keep 2 windows worth
      const snapshot = await this.db.collection(RATE_LIMIT_COLLECTION)
        .where('windowStart', '<', cutoff)
        .get();

      const batch = this.db.batch();
      let count = 0;

      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
      });

      if (count > 0) {
        await batch.commit();
      }

      return count;
    } catch (err) {
      console.error('[SharedRateLimiter] Error cleaning up expired entries:', err);
      return 0;
    }
  }
}

// ---------------------------------------------------------------------------
// Pre-configured rate limiters for common use cases
// ---------------------------------------------------------------------------

/**
 * Rate limiter for authentication endpoints.
 * 5 attempts per 15 minutes per IP address (shared across all instances).
 */
export const sharedAuthRateLimiter = new SharedRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyPrefix: 'auth'
});

/**
 * Rate limiter for password reset endpoints.
 * 3 attempts per hour per IP address.
 */
export const sharedPasswordResetRateLimiter = new SharedRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyPrefix: 'password-reset'
});

/**
 * Rate limiter for AI routes.
 * 20 requests per minute per user (or per API key).
 */
export const sharedBrainRateLimiter = new SharedRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  keyPrefix: 'brain'
});

/**
 * Rate limiter for sign-in endpoints.
 * 10 attempts per minute per IP.
 */
export const sharedSignInRateLimiter = new SharedRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  keyPrefix: 'signin'
});

/**
 * Rate limiter for API key based requests.
 * Configurable limit per key (default 120/min as per existing API_KEY_DEFAULT_PER_MINUTE).
 */
export class ApiKeySharedRateLimiter {
  private readonly db: ReturnType<typeof getDb>;

  constructor() {
    this.db = getDb();
  }

  async checkAndIncrement(apiKeyId: string, limitPerMinute: number = 120): Promise<RateLimitResult> {
    const limiter = new SharedRateLimiter({
      windowMs: 60 * 1000,
      max: limitPerMinute,
      keyPrefix: 'api-key'
    });
    return limiter.checkAndIncrement(apiKeyId);
  }
}

export const sharedApiKeyRateLimiter = new ApiKeySharedRateLimiter();

// ---------------------------------------------------------------------------
// Express middleware factory for easy integration
// ---------------------------------------------------------------------------

/**
 * Create Express middleware for a shared rate limiter
 */
export function createSharedRateLimitMiddleware(
  limiter: SharedRateLimiter,
  getIdentifier: (req: any) => string,
  getWorkspaceId: (req: any) => string = () => ''
) {
  return async (req: any, res: any, next: any) => {
    const identifier = getIdentifier(req);
    const workspaceId = getWorkspaceId(req);

    const result = await limiter.checkAndIncrement(identifier, workspaceId);

    if (!result.allowed) {
      res.status(429).json({
        status: 'error',
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Rate limit exceeded. Please retry after ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`
      });
      return;
    }

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000))
    });

    next();
  };
}

/**
 * Express middleware for auth rate limiting using shared storage
 */
export const sharedAuthMiddleware = createSharedRateLimitMiddleware(
  sharedAuthRateLimiter,
  (req) => req.ip || req.connection.remoteAddress || 'unknown'
);

/**
 * Express middleware for sign-in rate limiting using shared storage
 */
export const sharedSignInMiddleware = createSharedRateLimitMiddleware(
  sharedSignInRateLimiter,
  (req) => req.ip || req.connection.remoteAddress || 'unknown'
);

/**
 * Express middleware for brain/AI rate limiting using shared storage
 * Uses user ID or API key ID as the identifier
 */
export const sharedBrainMiddleware = createSharedRateLimitMiddleware(
  sharedBrainRateLimiter,
  (req) => req.user?.uid || req.user?.usedApiKeyId || req.ip || 'unknown',
  (req) => req.user?.workspaceId || ''
);
