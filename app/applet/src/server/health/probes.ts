import { HealthProbeDefinition } from './types';
import { getDb } from '../db/firestore';

export const HEALTH_PROBES: HealthProbeDefinition[] = [
  {
    name: 'database',
    tier: 1,
    cacheTtlMs: 30_000,
    timeoutMs: 3_000,
    probe: async () => {
      const start = Date.now();
      try {
        const db = getDb();
        // Ping 1 document
        await db.collection('system').doc('health_ping').get();
        return {
          status: 'ok',
          latencyMs: Date.now() - start,
          message: 'Firestore connection active'
        };
      } catch (err: any) {
        return {
          status: 'error',
          latencyMs: Date.now() - start,
          error: err.message || 'Firestore ping failed'
        };
      }
    }
  },
  {
    name: 'stripe',
    tier: 2,
    cacheTtlMs: 60_000,
    timeoutMs: 3_000,
    probe: async () => {
      const start = Date.now();
      const hasKey = Boolean(process.env.STRIPE_SECRET_KEY);
      if (!hasKey) {
        return {
          status: 'degraded',
          latencyMs: Date.now() - start,
          message: 'STRIPE_SECRET_KEY not configured'
        };
      }
      return {
        status: 'ok',
        latencyMs: Date.now() - start,
        message: 'Stripe configuration ready'
      };
    }
  },
  {
    name: 'gemini',
    tier: 2,
    cacheTtlMs: 60_000,
    timeoutMs: 3_000,
    probe: async () => {
      const start = Date.now();
      const hasKey = Boolean(process.env.GEMINI_API_KEY);
      return {
        status: hasKey ? 'ok' : 'degraded',
        latencyMs: Date.now() - start,
        message: hasKey ? 'Gemini API key configured' : 'GEMINI_API_KEY missing'
      };
    }
  },
  {
    name: 'plaid',
    tier: 2,
    cacheTtlMs: 60_000,
    timeoutMs: 3_000,
    probe: async () => {
      const start = Date.now();
      const hasConfig = Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
      return {
        status: hasConfig ? 'ok' : 'degraded',
        latencyMs: Date.now() - start,
        message: hasConfig ? 'Plaid API credentials configured' : 'Plaid integration pending configuration'
      };
    }
  },
  {
    name: 'email',
    tier: 2,
    cacheTtlMs: 60_000,
    timeoutMs: 3_000,
    probe: async () => {
      const start = Date.now();
      const hasKey = Boolean(process.env.RESEND_API_KEY || process.env.POSTMARK_API_KEY || process.env.SENDGRID_API_KEY || process.env.SMTP_HOST);
      return {
        status: hasKey ? 'ok' : 'degraded',
        latencyMs: Date.now() - start,
        message: hasKey ? 'Email provider configured' : 'Email provider key pending'
      };
    }
  }
];
