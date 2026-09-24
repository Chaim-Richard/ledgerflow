import { getInviteSecret } from '../../lib/inviteManager';

export function assertStartupConfig(): void {
  // 1. Assert INVITE_SECRET / JWT_SECRET is present and valid at startup
  getInviteSecret();

  // 2. Assert other required variables at boot in production
  if (process.env.NODE_ENV === 'production') {
    // Stripe and the currency/tax APIs are optional: those features report "not set up" until added.
    const required = [
      'SESSION_SECRET',
      'SYSTEM_SALT'
    ];

    const missing = required.filter(key => !process.env[key]);
    // The Supabase Postgres connection string (the Vercel integration sets POSTGRES_URL).
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.SUPABASE_DB_URL) {
      missing.push('DATABASE_URL (or POSTGRES_URL)');
    }
    if (missing.length > 0) {
      throw new Error(`[Startup Validator] Missing required environment variables at boot: ${missing.join(', ')}`);
    }
  }
}
