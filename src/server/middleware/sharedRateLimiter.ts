import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { getDb } from '../db/firestore';
import type { Firestore } from '../db/firestore';

export interface SharedRateLimitConfig {
  windowMs: number;
  max: number;
  keyPrefix: string;
}

export interface SharedRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

interface StoredLimit {
  keyHash: string;
  count: number;
  windowStart: number;
  workspaceId: string;
}

const COLLECTION = 'rateLimitEntries';

/**
 * Postgres-backed rate limiter. One SHA-256 key per identifier, window and
 * namespace (not 10 independent shards). Does not persist IPs or API keys in
 * plaintext, and stays within Postgres' 127-character document-id limit.
 *
 * pgFirestore.runTransaction uses SERIALIZABLE isolation and retries transient
 * serialization conflicts. The check and increment are one commit, never a
 * separate read followed by an unprotected write.
 */
export class SharedRateLimiter {
  constructor(
    private readonly config: SharedRateLimitConfig,
    private readonly db: Firestore = getDb(),
  ) {
    if (!Number.isSafeInteger(config.windowMs) || config.windowMs <= 0 ||
        !Number.isSafeInteger(config.max) || config.max <= 0 ||
        !config.keyPrefix.trim()) {
      throw new Error('Invalid shared rate-limit configuration');
    }
  }

  private key(identifier: string, workspaceId: string): string {
    return createHash('sha256')
      .update(JSON.stringify([this.config.keyPrefix, workspaceId, identifier]))
      .digest('hex');
  }

  async checkAndIncrement(identifier: string, workspaceId = ''): Promise<SharedRateLimitResult> {
    const keyHash = this.key(identifier, workspaceId);
    const ref = this.db.collection(COLLECTION).doc(`rl_${keyHash}`);
    return this.db.runTransaction(async transaction => {
      const windowStart = Math.floor(Date.now() / this.config.windowMs) * this.config.windowMs;
      const snap = await transaction.get(ref);
      const stored = snap.data() as Partial<StoredLimit> | undefined;
      if (snap.exists && (!stored ||
          stored.keyHash !== keyHash ||
          !Number.isSafeInteger(stored.count) ||
          (stored.count ?? -1) < 0 ||
          !Number.isSafeInteger(stored.windowStart))) {
        throw new Error('Stored rate-limit counter is invalid');
      }
      const count = stored?.windowStart === windowStart ? stored.count! : 0;
      const resetTime = windowStart + this.config.windowMs;
      if (count >= this.config.max) {
        return { allowed: false, remaining: 0, resetTime, limit: this.config.max };
      }
      transaction.set(ref, {
        keyHash,
        count: count + 1,
        windowStart,
        workspaceId,
      } satisfies StoredLimit);
      return {
        allowed: true,
        remaining: this.config.max - count - 1,
        resetTime,
        limit: this.config.max,
      };
    }, { maxAttempts: 32 });
  }
}

/** Do not let DB outages silently disable protection on authentication routes. */
export function sharedRateLimitMiddleware(
  limiter: SharedRateLimiter,
  identify: (request: Parameters<RequestHandler>[0]) => string,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const result = await limiter.checkAndIncrement(identify(req));
      if (!result.allowed) {
        const retrySeconds = Math.max(1, Math.ceil((result.resetTime - Date.now()) / 1000));
        res.setHeader('Retry-After', String(retrySeconds));
        res.status(429).json({
          status: 'error',
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Try again later.',
        });
        return;
      }
      res.setHeader('RateLimit-Limit', String(result.limit));
      res.setHeader('RateLimit-Remaining', String(result.remaining));
      res.setHeader('RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)));
      next();
    } catch (error) {
      console.error('[SharedRateLimiter] Database check failed', error);
      res.status(503).json({
        status: 'error',
        code: 'RATE_LIMIT_UNAVAILABLE',
        message: 'Request protection is temporarily unavailable. Please retry later.',
      });
    }
  };
}

export const sharedAuthRateLimiter = new SharedRateLimiter({
  keyPrefix: 'auth', windowMs: 15 * 60 * 1000, max: 5,
});
export const sharedBrainRateLimiter = new SharedRateLimiter({
  keyPrefix: 'brain', windowMs: 60 * 1000, max: 20,
});
