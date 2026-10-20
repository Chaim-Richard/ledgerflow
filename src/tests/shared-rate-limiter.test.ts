import { describe, it, expect, beforeEach, afterEach } from 'node:test';
import { getDb } from '../server/db/firestore';
import { SharedRateLimiter, sharedAuthRateLimiter, sharedSignInRateLimiter, sharedBrainRateLimiter } from '../server/middleware/sharedRateLimiter';

/**
 * Tests for S-01: Shared rate limiter with Postgres-backed store
 * 
 * These tests verify that rate limits are enforced across all server instances
 * by storing counts in Postgres rather than in-memory.
 */

describe('SharedRateLimiter', () => {
  let db: ReturnType<typeof getDb>;
  const testCollection = 'rateLimitEntries';

  beforeEach(async () => {
    db = getDb();
    // Clean up test entries
    const snapshot = await db.collection(testCollection)
      .where('key', '>', '')
      .get();
    const batch = db.batch();
    snapshot.forEach((doc) => {
      if (doc.id.startsWith('rl_')) {
        batch.delete(doc.ref);
      }
    });
    await batch.commit().catch(() => {});
  });

  afterEach(async () => {
    // Clean up after each test
    const snapshot = await db.collection(testCollection)
      .where('key', '>', '')
      .get();
    const batch = db.batch();
    snapshot.forEach((doc) => {
      if (doc.id.startsWith('rl_')) {
        batch.delete(doc.ref);
      }
    });
    await batch.commit().catch(() => {});
  });

  describe('basic rate limiting', () => {
    it('should allow requests within the limit', async () => {
      const limiter = new SharedRateLimiter({
        windowMs: 60 * 1000, // 1 minute
        max: 10,
        keyPrefix: 'test'
      });

      // First 5 requests should be allowed
      for (let i = 0; i < 5; i++) {
        const result = await limiter.checkAndIncrement('test-ip-1');
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(9 - i);
        expect(result.limit).toBe(10);
      }
    });

    it('should block requests over the limit', async () => {
      const limiter = new SharedRateLimiter({
        windowMs: 60 * 1000,
        max: 3,
        keyPrefix: 'test'
      });

      // Use up all requests
      for (let i = 0; i < 3; i++) {
        const result = await limiter.checkAndIncrement('test-ip-2');
        expect(result.allowed).toBe(true);
      }

      // Next request should be blocked
      const result = await limiter.checkAndIncrement('test-ip-2');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track different identifiers separately', async () => {
      const limiter = new SharedRateLimiter({
        windowMs: 60 * 1000,
        max: 2,
        keyPrefix: 'test'
      });

      // Use up limit for ip-1
      await limiter.checkAndIncrement('ip-1');
      await limiter.checkAndIncrement('ip-1');
      const result1 = await limiter.checkAndIncrement('ip-1');
      expect(result1.allowed).toBe(false);

      // ip-2 should still be allowed
      const result2 = await limiter.checkAndIncrement('ip-2');
      expect(result2.allowed).toBe(true);
    });
  });

  describe('workspace-scoped rate limiting', () => {
    it('should track workspace-scoped limits separately', async () => {
      const limiter = new SharedRateLimiter({
        windowMs: 60 * 1000,
        max: 2,
        keyPrefix: 'test'
      });

      // Use up limit for workspace-1
      await limiter.checkAndIncrement('user-1', 'workspace-1');
      await limiter.checkAndIncrement('user-1', 'workspace-1');
      const result1 = await limiter.checkAndIncrement('user-1', 'workspace-1');
      expect(result1.allowed).toBe(false);

      // Same user in workspace-2 should still be allowed
      const result2 = await limiter.checkAndIncrement('user-1', 'workspace-2');
      expect(result2.allowed).toBe(true);
    });
  });

  describe('window expiration', () => {
    it('should reset count after window expires', async () => {
      const limiter = new SharedRateLimiter({
        windowMs: 100, // Very short window for testing
        max: 2,
        keyPrefix: 'test'
      });

      // Use up limit
      await limiter.checkAndIncrement('test-ip-3');
      await limiter.checkAndIncrement('test-ip-3');
      let result = await limiter.checkAndIncrement('test-ip-3');
      expect(result.allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be allowed again
      result = await limiter.checkAndIncrement('test-ip-3');
      expect(result.allowed).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return current rate limit status', async () => {
      const limiter = new SharedRateLimiter({
        windowMs: 60 * 1000,
        max: 5,
        keyPrefix: 'test'
      });

      await limiter.checkAndIncrement('test-ip-4');
      await limiter.checkAndIncrement('test-ip-4');

      const status = await limiter.getStatus('test-ip-4');
      expect(status.remaining).toBe(3);
      expect(status.limit).toBe(5);
      expect(status.allowed).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset rate limit for a specific identifier', async () => {
      const limiter = new SharedRateLimiter({
        windowMs: 60 * 1000,
        max: 2,
        keyPrefix: 'test'
      });

      await limiter.checkAndIncrement('test-ip-5');
      await limiter.checkAndIncrement('test-ip-5');
      let result = await limiter.checkAndIncrement('test-ip-5');
      expect(result.allowed).toBe(false);

      // Reset
      await limiter.reset('test-ip-5');

      // Should be allowed again
      result = await limiter.checkAndIncrement('test-ip-5');
      expect(result.allowed).toBe(true);
    });
  });

  describe('pre-configured limiters', () => {
    it('should have pre-configured auth rate limiter', () => {
      expect(sharedAuthRateLimiter).toBeInstanceOf(SharedRateLimiter);
    });

    it('should have pre-configured sign-in rate limiter', () => {
      expect(sharedSignInRateLimiter).toBeInstanceOf(SharedRateLimiter);
    });

    it('should have pre-configured brain rate limiter', () => {
      expect(sharedBrainRateLimiter).toBeInstanceOf(SharedRateLimiter);
    });
  });

  describe('cleanup', () => {
    it('should clean up expired entries', async () => {
      const limiter = new SharedRateLimiter({
        windowMs: 100, // Short window
        max: 5,
        keyPrefix: 'test'
      });

      // Create some entries
      for (let i = 0; i < 10; i++) {
        await limiter.checkAndIncrement(`test-ip-cleanup-${i}`);
      }

      // Wait for entries to expire
      await new Promise(resolve => setTimeout(resolve, 250));

      // Clean up
      const cleaned = await limiter.cleanupExpired();
      expect(cleaned).toBeGreaterThan(0);
    });
  });
});

describe('SharedRateLimiter with two app instances', () => {
  /**
   * This test simulates two server instances sharing the same rate limit.
   * In the real deployment, this would be two separate Node processes,
   * but we simulate it by creating two separate limiter instances.
   */
  it('should share rate limit across instances', async () => {
    const db = getDb();
    const testCollection = 'rateLimitEntries';

    // Clean up first
    const snapshot = await db.collection(testCollection)
      .where('key', '==', 'test:shared-test')
      .get();
    const batch = db.batch();
    snapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit().catch(() => {});

    // Create two "instances" of the rate limiter
    const instance1 = new SharedRateLimiter({
      windowMs: 60 * 1000,
      max: 5,
      keyPrefix: 'test'
    });

    const instance2 = new SharedRateLimiter({
      windowMs: 60 * 1000,
      max: 5,
      keyPrefix: 'test'
    });

    // Instance 1 makes 3 requests
    await instance1.checkAndIncrement('shared-test');
    await instance1.checkAndIncrement('shared-test');
    await instance1.checkAndIncrement('shared-test');

    // Instance 2 makes 2 requests
    await instance2.checkAndIncrement('shared-test');
    await instance2.checkAndIncrement('shared-test');

    // Both instances should now be at the limit
    const result1 = await instance1.checkAndIncrement('shared-test');
    const result2 = await instance2.checkAndIncrement('shared-test');

    expect(result1.allowed).toBe(false);
    expect(result2.allowed).toBe(false);

    // Clean up
    const cleanupSnapshot = await db.collection(testCollection)
      .where('key', '==', 'test:shared-test')
      .get();
    const cleanupBatch = db.batch();
    cleanupSnapshot.forEach((doc) => cleanupBatch.delete(doc.ref));
    await cleanupBatch.commit().catch(() => {});
  });
});
