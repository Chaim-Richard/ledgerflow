/**
 * S-02 production preflight. Read-only: never print secrets or connect to a DB.
 * This complements (never replaces) assertStartupConfig at server boot.
 * Usage: NODE_ENV=production npx tsx scripts/check-prod-env.ts
 */
import { X509Certificate } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export interface PreflightFinding {
  name: string;
  status: 'pass' | 'fail' | 'manual';
  message: string;
}

function strongSecret(value: string | undefined): boolean {
  if (!value || value.trim().length < 32) return false;
  if (/dev_|dummy|example|placeholder|change.?me|test[_-]/i.test(value)) return false;
  return new Set(value).size >= 8;
}

export function checkProductionConfig(env: NodeJS.ProcessEnv): PreflightFinding[] {
  const findings: PreflightFinding[] = [];
  const check = (name: string, condition: boolean, message: string) => {
    findings.push({ name, status: condition ? 'pass' : 'fail', message });
  };
  check('Production mode', env.NODE_ENV === 'production', 'NODE_ENV must be production.');
  check('Session signing', strongSecret(env.SESSION_SECRET), 'SESSION_SECRET must be a non-placeholder, sufficiently long random value.');
  check('System encryption salt', strongSecret(env.SYSTEM_SALT), 'SYSTEM_SALT must be a non-placeholder, sufficiently long random value.');
  check('Invitation signing', strongSecret(env.INVITE_SECRET || env.JWT_SECRET), 'INVITE_SECRET or JWT_SECRET must be a non-placeholder, sufficiently long random value.');

  const database = env.DATABASE_URL || env.POSTGRES_URL || env.SUPABASE_DB_URL;
  let remote = false;
  let validUrl = false;
  if (database) {
    try {
      const parsed = new URL(database);
      validUrl = ['postgres:', 'postgresql:'].includes(parsed.protocol) && Boolean(parsed.hostname);
      remote = validUrl && !['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname);
    } catch { /* report missing/invalid without exposing connection strings */ }
  }
  check('Database connection', validUrl, 'Set a valid DATABASE_URL, POSTGRES_URL or SUPABASE_DB_URL.');
  if (remote) {
    let validCa = false;
    try {
      const pem = (env.DATABASE_CA_CERT || '').replace(/\\n/g, '\n');
      const cert = new X509Certificate(pem);
      validCa = cert.validTo !== '';
    } catch { /* invalid certificate */ }
    check('Remote database certificate', validCa, 'Set a valid DATABASE_CA_CERT for verified remote PostgreSQL TLS.');
  }
  if (env.STRIPE_SECRET_KEY) {
    check('Stripe mode', env.STRIPE_SECRET_KEY.startsWith('sk_live_') &&
      !/dummy|placeholder|example|test_/i.test(env.STRIPE_SECRET_KEY),
      'A production-enabled Stripe integration must use a live, non-placeholder secret.');
    check('Stripe webhook', strongSecret(env.STRIPE_WEBHOOK_SECRET), 'Configured Stripe needs a real webhook signing secret.');
  } else {
    findings.push({ name: 'Stripe integration', status: 'manual', message: 'Not configured: ensure billing is disabled until verified.' });
  }
  findings.push({ name: 'Deployment', status: 'manual', message: 'Verify backups, remote TLS handshake, email provider, scheduler, migrations, RLS and access policies in the running environment.' });
  return findings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = checkProductionConfig(process.env);
  for (const row of result) {
    console.log(`${row.status.toUpperCase()} — ${row.name}: ${row.message}`);
  }
  const failures = result.filter(row => row.status === 'fail').length;
  console.log(`Preflight: ${failures} failed; remaining manual checks are not certified.`);
  if (failures) process.exitCode = 1;
}
