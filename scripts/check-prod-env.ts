#!/usr/bin/env tsx
/**
 * S-02: Production settings check script
 * 
 * Lists missing or weak production settings without printing values.
 * Checks for: SESSION_SECRET, SYSTEM_SALT, DATABASE_CA_CERT, webhook secrets
 * 
 * Usage: npm run check:prod-env
 */

interface CheckResult {
  name: string;
  status: 'OK' | 'MISSING' | 'WEAK' | 'INFO';
  message: string;
  severity: 'high' | 'medium' | 'low';
  fix: string;
}

interface ConfigCheck {
  name: string;
  envVars: string[];
  checkFn?: (value: string | undefined) => CheckResult;
  severity: 'high' | 'medium' | 'low';
  description: string;
  fix: string;
}

const REQUIRED_SECRET_LENGTH = 32;
const MINIMUM_SECRET_LENGTH = 16;

/**
 * Configuration checks for production settings
 */
const configChecks: ConfigCheck[] = [
  {
    name: 'Session Secret',
    envVars: ['SESSION_SECRET', 'SESSION_SALT'],
    severity: 'high',
    description: 'Used to sign session cookies. Must be long and random.',
    fix: 'Generate with: openssl rand -hex 32. Set in your deployment environment variables.',
    checkFn: (value) => {
      if (!value) {
        return {
          name: 'Session Secret',
          status: 'MISSING',
          message: 'No session secret configured. Sessions will not be secure.',
          severity: 'high',
          fix: 'Set SESSION_SECRET or SESSION_SALT environment variable.'
        };
      }
      if (value.length < MINIMUM_SECRET_LENGTH) {
        return {
          name: 'Session Secret',
          status: 'WEAK',
          message: `Session secret is only ${value.length} characters. Should be at least ${REQUIRED_SECRET_LENGTH}.`,
          severity: 'high',
          fix: `Generate a new secret with at least ${REQUIRED_SECRET_LENGTH} characters.`
        };
      }
      return {
        name: 'Session Secret',
        status: 'OK',
        message: `Session secret configured (${value.length} chars).`,
        severity: 'high',
        fix: ''
      };
    }
  },
  {
    name: 'System Salt',
    envVars: ['SYSTEM_SALT'],
    severity: 'high',
    description: 'Used for forensic stamping, encryption of bank tokens. Must be set before connecting banks.',
    fix: 'Generate with: openssl rand -hex 32. Set in your deployment environment variables. DO THIS BEFORE connecting any banks with Plaid.',
    checkFn: (value) => {
      if (!value) {
        return {
          name: 'System Salt',
          status: 'MISSING',
          message: 'No system salt configured. Forensic stamping and encryption will fail.',
          severity: 'high',
          fix: 'Set SYSTEM_SALT environment variable before connecting banks.'
        };
      }
      if (value.length < MINIMUM_SECRET_LENGTH) {
        return {
          name: 'System Salt',
          status: 'WEAK',
          message: `System salt is only ${value.length} characters. Should be at least ${REQUIRED_SECRET_LENGTH}.`,
          severity: 'high',
          fix: `Generate a new salt with at least ${REQUIRED_SECRET_LENGTH} characters.`
        };
      }
      return {
        name: 'System Salt',
        status: 'OK',
        message: `System salt configured (${value.length} chars).`,
        severity: 'high',
        fix: ''
      };
    }
  },
  {
    name: 'Database CA Certificate',
    envVars: ['DATABASE_CA_CERT', 'DB_CA_CERT'],
    severity: 'high',
    description: 'TLS certificate for database connection verification. Prevents MITM attacks.',
    fix: 'Download from Supabase Database settings (SSL) and paste as DATABASE_CA_CERT.',
    checkFn: (value) => {
      if (!value) {
        return {
          name: 'Database CA Certificate',
          status: 'MISSING',
          message: 'No database CA certificate configured. Database connections may not verify certificates.',
          severity: 'high',
          fix: 'Set DATABASE_CA_CERT environment variable with your database certificate.'
        };
      }
      // Check if it looks like a certificate (starts with -----BEGIN CERTIFICATE-----)
      if (!value.includes('BEGIN CERTIFICATE') && !value.includes('BEGIN CERT')) {
        return {
          name: 'Database CA Certificate',
          status: 'WEAK',
          message: 'Database CA certificate does not appear to be a valid certificate.',
          severity: 'high',
          fix: 'Ensure you are using the correct certificate format from your database provider.'
        };
      }
      return {
        name: 'Database CA Certificate',
        status: 'OK',
        message: 'Database CA certificate configured.',
        severity: 'high',
        fix: ''
      };
    }
  },
  {
    name: 'Stripe Webhook Secret',
    envVars: ['STRIPE_WEBHOOK_SECRET'],
    severity: 'medium',
    description: 'Secret for verifying Stripe webhook signatures.',
    fix: 'Get from Stripe Dashboard -> Developers -> Webhooks -> your webhook endpoint -> Signing secret.',
    checkFn: (value) => {
      if (!value) {
        return {
          name: 'Stripe Webhook Secret',
          status: 'MISSING',
          message: 'No Stripe webhook secret configured. Stripe webhooks will not be verified.',
          severity: 'medium',
          fix: 'Set STRIPE_WEBHOOK_SECRET environment variable.'
        };
      }
      if (value === 'whsec_') {
        return {
          name: 'Stripe Webhook Secret',
          status: 'WEAK',
          message: 'Stripe webhook secret appears to be a placeholder.',
          severity: 'medium',
          fix: 'Set the actual webhook signing secret from Stripe dashboard.'
        };
      }
      return {
        name: 'Stripe Webhook Secret',
        status: 'OK',
        message: 'Stripe webhook secret configured.',
        severity: 'medium',
        fix: ''
      };
    }
  },
  {
    name: 'Email Webhook Secret',
    envVars: ['EMAIL_WEBHOOK_SECRET'],
    severity: 'medium',
    description: 'Secret for verifying email bounce webhook signatures.',
    fix: 'Generate a long random string and set as EMAIL_WEBHOOK_SECRET. Configure in your email provider.',
    checkFn: (value) => {
      if (!value) {
        return {
          name: 'Email Webhook Secret',
          status: 'INFO',
          message: 'No email webhook secret configured. Email bounce webhooks will not be verified.',
          severity: 'medium',
          fix: 'Set EMAIL_WEBHOOK_SECRET environment variable if using email bounce webhooks.'
        };
      }
      if (value.length < MINIMUM_SECRET_LENGTH) {
        return {
          name: 'Email Webhook Secret',
          status: 'WEAK',
          message: `Email webhook secret is only ${value.length} characters. Should be at least ${MINIMUM_SECRET_LENGTH}.`,
          severity: 'medium',
          fix: `Generate a new secret with at least ${MINIMUM_SECRET_LENGTH} characters.`
        };
      }
      return {
        name: 'Email Webhook Secret',
        status: 'OK',
        message: 'Email webhook secret configured.',
        severity: 'medium',
        fix: ''
      };
    }
  },
  {
    name: 'Invite Secret',
    envVars: ['INVITE_SECRET'],
    severity: 'medium',
    description: 'Secret for validating workspace invitation tokens.',
    fix: 'Generate with: openssl rand -hex 32. Set as INVITE_SECRET.',
    checkFn: (value) => {
      if (!value) {
        return {
          name: 'Invite Secret',
          status: 'INFO',
          message: 'No invite secret configured. Workspace invitations may not be secure.',
          severity: 'medium',
          fix: 'Set INVITE_SECRET environment variable.'
        };
      }
      if (value.length < MINIMUM_SECRET_LENGTH) {
        return {
          name: 'Invite Secret',
          status: 'WEAK',
          message: `Invite secret is only ${value.length} characters. Should be at least ${MINIMUM_SECRET_LENGTH}.`,
          severity: 'medium',
          fix: `Generate a new secret with at least ${MINIMUM_SECRET_LENGTH} characters.`
        };
      }
      return {
        name: 'Invite Secret',
        status: 'OK',
        message: 'Invite secret configured.',
        severity: 'medium',
        fix: ''
      };
    }
  },
  {
    name: 'Cron Secret',
    envVars: ['CRON_SECRET'],
    severity: 'medium',
    description: 'Secret for authenticating cron job requests.',
    fix: 'Generate with: openssl rand -hex 32. Set as CRON_SECRET.',
    checkFn: (value) => {
      if (!value) {
        return {
          name: 'Cron Secret',
          status: 'INFO',
          message: 'No cron secret configured. Cron jobs may not be authenticated.',
          severity: 'medium',
          fix: 'Set CRON_SECRET environment variable.'
        };
      }
      if (value.length < MINIMUM_SECRET_LENGTH) {
        return {
          name: 'Cron Secret',
          status: 'WEAK',
          message: `Cron secret is only ${value.length} characters. Should be at least ${MINIMUM_SECRET_LENGTH}.`,
          severity: 'medium',
          fix: `Generate a new secret with at least ${MINIMUM_SECRET_LENGTH} characters.`
        };
      }
      return {
        name: 'Cron Secret',
        status: 'OK',
        message: 'Cron secret configured.',
        severity: 'medium',
        fix: ''
      };
    }
  },
  {
    name: 'Plaid Webhook Secret',
    envVars: ['PLAID_WEBHOOK_SECRET', 'PLAID_CLIENT_SECRET'],
    severity: 'medium',
    description: 'Secret for Plaid webhook verification.',
    fix: 'Get from Plaid Dashboard -> Team Settings -> Webhooks.',
    checkFn: (value) => {
      if (!value) {
        return {
          name: 'Plaid Webhook Secret',
          status: 'INFO',
          message: 'No Plaid webhook secret configured. Plaid webhooks will not be verified.',
          severity: 'medium',
          fix: 'Set PLAID_WEBHOOK_SECRET environment variable if using Plaid.'
        };
      }
      return {
        name: 'Plaid Webhook Secret',
        status: 'OK',
        message: 'Plaid webhook secret configured.',
        severity: 'medium',
        fix: ''
      };
    }
  },
  {
    name: 'Encryption Secret',
    envVars: ['ENCRYPTION_SECRET'],
    severity: 'high',
    description: 'Alternative secret for encryption when SYSTEM_SALT is not available.',
    fix: 'Generate with: openssl rand -hex 32. Set as ENCRYPTION_SECRET.',
    checkFn: (value) => {
      if (!value) {
        return {
          name: 'Encryption Secret',
          status: 'INFO',
          message: 'No encryption secret configured. Falls back to SYSTEM_SALT.',
          severity: 'high',
          fix: 'Set ENCRYPTION_SECRET environment variable as a fallback.'
        };
      }
      if (value.length < MINIMUM_SECRET_LENGTH) {
        return {
          name: 'Encryption Secret',
          status: 'WEAK',
          message: `Encryption secret is only ${value.length} characters. Should be at least ${MINIMUM_SECRET_LENGTH}.`,
          severity: 'high',
          fix: `Generate a new secret with at least ${MINIMUM_SECRET_LENGTH} characters.`
        };
      }
      return {
        name: 'Encryption Secret',
        status: 'OK',
        message: 'Encryption secret configured.',
        severity: 'high',
        fix: ''
      };
    }
  }
];

/**
 * Get environment variable value, checking multiple possible names
 */
function getEnvValue(envVarNames: string[]): string | undefined {
  for (const name of envVarNames) {
    const value = process.env[name];
    if (value && value.trim()) {
      return value;
    }
  }
  return undefined;
}

/**
 * Run all configuration checks
 */
function runChecks(): CheckResult[] {
  const results: CheckResult[] = [];

  for (const check of configChecks) {
    const value = getEnvValue(check.envVars);
    
    if (check.checkFn) {
      const result = check.checkFn(value);
      results.push(result);
    } else {
      // Default check: just check if present
      if (!value) {
        results.push({
          name: check.name,
          status: 'MISSING',
          message: `No value configured for ${check.name}.`,
          severity: check.severity,
          fix: check.fix
        });
      } else {
        results.push({
          name: check.name,
          status: 'OK',
          message: `${check.name} configured.`,
          severity: check.severity,
          fix: ''
        });
      }
    }
  }

  return results;
}

/**
 * Format check results for display
 */
function formatResults(results: CheckResult[]): void {
  const highIssues = results.filter(r => r.severity === 'high' && r.status !== 'OK');
  const mediumIssues = results.filter(r => r.severity === 'medium' && r.status !== 'OK');
  const allOk = results.filter(r => r.status === 'OK');

  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           S-02: Production Settings Check                            ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // High severity issues
  if (highIssues.length > 0) {
    console.log('❌ HIGH SEVERITY ISSUES (must fix for production):\n');
    for (const issue of highIssues) {
      console.log(`  ${issue.status === 'MISSING' ? '🔴' : '🟡'} ${issue.name}`);
      console.log(`     ${issue.message}`);
      console.log(`     Fix: ${issue.fix}\n`);
    }
  }

  // Medium severity issues
  if (mediumIssues.length > 0) {
    console.log('⚠️  MEDIUM SEVERITY ISSUES (should fix):\n');
    for (const issue of mediumIssues) {
      console.log(`  ${issue.status === 'MISSING' ? '🔴' : '🟡'} ${issue.name}`);
      console.log(`     ${issue.message}`);
      console.log(`     Fix: ${issue.fix}\n`);
    }
  }

  // OK results
  if (allOk.length > 0) {
    console.log('✅ CONFIGURED CORRECTLY:\n');
    for (const ok of allOk) {
      console.log(`  ✓ ${ok.name}: ${ok.message}`);
    }
    console.log();
  }

  // Summary
  const total = results.length;
  const okCount = allOk.length;
  const issueCount = results.length - okCount;

  console.log('─'.repeat(65));
  console.log(`Summary: ${okCount}/${total} checks passed, ${issueCount} issues found`);
  console.log('─'.repeat(65));

  // Exit with error code if there are issues
  if (issueCount > 0) {
    console.log('\n⚠️  Production is NOT ready. Please fix the issues above.');
    process.exit(1);
  } else {
    console.log('\n✅ All production settings are properly configured!');
    process.exit(0);
  }
}

/**
 * Main entry point
 */
function main(): void {
  const isTest = process.env.NODE_ENV === 'test';

  if (isTest) {
    // In test environment, we expect some values to be missing or test values
    console.log('ℹ️  Running in test environment - some checks may be skipped.');
  }

  const results = runChecks();
  formatResults(results);
}

main();
