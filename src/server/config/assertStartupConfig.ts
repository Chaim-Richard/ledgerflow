import { getInviteSecret } from '../../lib/inviteManager';

export function assertStartupConfig(): void {
  // 1. Assert INVITE_SECRET / JWT_SECRET is present and valid at startup
  getInviteSecret();

  // 2. Assert other required variables at boot in production
  if (process.env.NODE_ENV === 'production') {
    const required = [
      'SESSION_SECRET',
      'SYSTEM_SALT',
      'CURRENCY_API_KEY',
      'TAX_API_KEY',
      'STRIPE_SECRET_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`[Startup Validator] Missing required environment variables at boot: ${missing.join(', ')}`);
    }
  }
}
