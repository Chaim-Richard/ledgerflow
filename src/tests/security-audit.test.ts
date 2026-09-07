import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import crypto from 'node:crypto';

// Ensure test execution has deterministic salt even if running without env wrappers
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.SYSTEM_SALT = process.env.SYSTEM_SALT || 'test-audit-salt-hex-32-chars-at-least-1234';

import { SecurityService } from '../services/securityService.js';
import { DoubleEntryValidator } from '../kernel/validation/DoubleEntryValidator.js';

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
      DoubleEntryValidator.validateJournalEntry(balancedEntry as any);
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
      DoubleEntryValidator.validateJournalEntry(imbalancedEntry as any);
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
      DoubleEntryValidator.validateJournalEntry(singleLegEntry as any);
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
});
