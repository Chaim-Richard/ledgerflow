import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Ensure test execution has deterministic salt even if running without env wrappers
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.SYSTEM_SALT = process.env.SYSTEM_SALT || 'test-audit-salt-hex-32-chars-at-least-1234';

import { SecurityService } from '../services/securityService.js';
import { DoubleEntryValidator } from '../kernel/validation/DoubleEntryValidator.js';
import { validateWorkspaceMember, validateWorkspaceAccounts } from '../server/db/firestore.js';
import type { Firestore } from '../server/db/firestore';

describe('Security and Integrity Deep Audit Test Suite', () => {
  test('AES-256-GCM encryption & decryption round-trip works accurately', () => {
    const sensitiveToken = 'access-sandbox-98234-super-secret-plaid-token';
    const encrypted = SecurityService.encryptSensitiveField(sensitiveToken);
    
    assert.notEqual(encrypted, sensitiveToken);
    assert.ok(encrypted.includes(':'), 'Encrypted payload must contain IV:AuthTag:Ciphertext');

    const decrypted = SecurityService.decryptSensitiveField(encrypted);
    assert.equal(decrypted, sensitiveToken);
  });

  test('AES-256-GCM decryption rejects tampered ciphertext or auth tag', () => {
    const sensitiveToken = 'secret-token-1234';
    const encrypted = SecurityService.encryptSensitiveField(sensitiveToken);
    const parts = encrypted.split(':');
    
    // Tamper with ciphertext (parts: enc:iv:authTag:ciphertext)
    const tamperedCipher = parts[0] + ':' + parts[1] + ':' + parts[2] + ':' + 'deadbeef' + parts[3].slice(8);
    assert.throws(() => {
      SecurityService.decryptSensitiveField(tamperedCipher);
    }, /Decryption failed/);
  });

  test('PII Scrubber sanitizes SSNs, credit cards, emails, and API keys', () => {
    const raw = 'User john.doe@enterprise.com with card 4111-2222-3333-4444 and key lf_live_9a8b7c6d5e4f3a2b1c';
    const scrubbed = SecurityService.scrubPII(raw);

    assert.ok(!scrubbed.includes('john.doe@enterprise.com'));
    assert.ok(!scrubbed.includes('4111-2222-3333-4444'));
    assert.ok(!scrubbed.includes('lf_live_9a8b7c6d5e4f3a2b1c'));
    assert.ok(scrubbed.includes('[EMAIL_REDACTED]'));
    assert.ok(scrubbed.includes('[CREDIT_CARD_REDACTED]'));
    assert.ok(scrubbed.includes('[SECRET_KEY_REDACTED]'));
  });

  test('DoubleEntryValidator strictly enforces zero net balance', () => {
    const balancedEntry = {
      id: 'tx-1',
      date: '2026-09-01',
      workspaceId: 'ws-123',
      description: 'Balanced Office Supplies',
      lines: [
        { accountId: 'acc-exp', accountName: 'Office Expense', amountCents: 15000 },
        { accountId: 'acc-cash', accountName: 'Cash', amountCents: -15000 }
      ]
    };

    assert.doesNotThrow(() => {
      DoubleEntryValidator.validateJournalEntry(balancedEntry as unknown as Parameters<typeof DoubleEntryValidator.validateJournalEntry>[0]);
    });

    const imbalancedEntry = {
      id: 'tx-2',
      date: '2026-09-01',
      workspaceId: 'ws-123',
      description: 'Imbalanced Entry (1 cent discrepancy)',
      lines: [
        { accountId: 'acc-exp', accountName: 'Office Expense', amountCents: 15000 },
        { accountId: 'acc-cash', accountName: 'Cash', amountCents: -14999 }
      ]
    };

    assert.throws(() => {
      DoubleEntryValidator.validateJournalEntry(imbalancedEntry as unknown as Parameters<typeof DoubleEntryValidator.validateJournalEntry>[0]);
    }, /Unbalanced entry/);
  });

  test('DoubleEntryValidator rejects single-legged entries', () => {
    const singleLegEntry = {
      id: 'tx-3',
      date: '2026-09-01',
      workspaceId: 'ws-123',
      description: 'Single legged transaction',
      lines: [
        { accountId: 'acc-exp', accountName: 'Office Expense', amountCents: 0 }
      ]
    };

    assert.throws(() => {
      DoubleEntryValidator.validateJournalEntry(singleLegEntry as unknown as Parameters<typeof DoubleEntryValidator.validateJournalEntry>[0]);
    }, /Transaction must have at least two line items/);
  });

  test('Payment token regex strictly validates format and prevents injection', () => {
    const validToken = 'pay_' + crypto.randomBytes(32).toString('hex');
    const tokenRegex = /^pay_[a-zA-Z0-9_-]{10,128}$/;

    assert.ok(tokenRegex.test(validToken));
    assert.equal(tokenRegex.test('pay_invalid; DROP TABLE users;'), false);
    assert.equal(tokenRegex.test('invalid_prefix_1234567890'), false);
    assert.equal(tokenRegex.test('pay_short'), false);
    assert.equal(tokenRegex.test('pay_' + 'a'.repeat(200)), false);
  });

  test('Forensic hash generation and integrity verification works deterministically', () => {
    const payloadA = { amountCents: 10000, description: 'Audit verification', accountId: 'acc-1' };
    const payloadB = { accountId: 'acc-1', description: 'Audit verification', amountCents: 10000 };
    
    const hashA = SecurityService.generateForensicHash(payloadA);
    const hashB = SecurityService.generateForensicHash(payloadB);

    assert.equal(hashA, hashB, 'Deterministic stringify must produce matching hashes regardless of key insertion order');
    assert.equal(SecurityService.verifyIntegrity(payloadA, hashA), true);
    assert.equal(SecurityService.verifyIntegrity({ ...payloadA, amountCents: 10001 }, hashA), false);
  });

  test('validateWorkspaceMember and validateWorkspaceAccounts reject PERMISSION_DENIED in production', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const throwingDb = {
      collection: () => ({
        doc: () => ({
          get: async () => { throw new Error('PERMISSION_DENIED'); }
        })
      }),
      getAll: async () => { throw new Error('PERMISSION_DENIED'); }
    } as unknown as Firestore;

    try {
      await assert.rejects(async () => {
        await validateWorkspaceMember(throwingDb, 'ws-123', { uid: 'user-1' });
      }, /PERMISSION_DENIED/);

      await assert.rejects(async () => {
        await validateWorkspaceAccounts(throwingDb, 'ws-123', ['acc-1']);
      }, /PERMISSION_DENIED/);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  test('Audit logs are permanent: no server file contains .delete() on auditLogs', () => {
    function scanDir(dir: string): string[] {
      const files: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...scanDir(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const serverFiles = [
      path.resolve(process.cwd(), 'server.ts'),
      ...scanDir(path.resolve(process.cwd(), 'src/server'))
    ];

    const violations: string[] = [];
    for (const file of serverFiles) {
      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes("collection('auditLogs')") || content.includes('collection("auditLogs")')) {
        if (content.includes('.delete(')) {
          // Check if .delete( is specifically used on an auditLog reference
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('.delete(') && (lines[i].includes('auditLog') || (i > 0 && lines[i - 1].includes('auditLog')))) {
              violations.push(`${path.relative(process.cwd(), file)}:${i + 1}: ${lines[i].trim()}`);
            }
          }
        }
      }
    }

    assert.deepEqual(violations, [], `Audit log deletion forbidden! Found: ${violations.join(', ')}`);
  });
});
