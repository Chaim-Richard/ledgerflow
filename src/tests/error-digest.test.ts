import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateErrorSignatures, processErrorDigest } from '../server/services/errorDigestService';
import { sendErrorDigestEmail } from '../server/services/emailService';

describe('Error Telemetry Digest Service (Task 3)', () => {
  test('aggregateErrorSignatures correctly groups, counts, and orders error telemetry records', () => {
    const rawTelemetry = [
      {
        message: 'Uncaught TypeError: Cannot read properties of undefined',
        source: 'frontend',
        severity: 'error',
        createdAt: '2026-09-08T10:00:00.000Z',
        url: 'https://ledgerflow.app/ledger',
        stack: 'TypeError: Cannot read properties...'
      },
      {
        message: 'Uncaught TypeError: Cannot read properties of undefined',
        source: 'frontend',
        severity: 'fatal',
        createdAt: '2026-09-08T11:30:00.000Z',
        url: 'https://ledgerflow.app/ledger'
      },
      {
        message: 'Network request failed: 504 Gateway Timeout',
        source: 'network',
        severity: 'warning',
        createdAt: '2026-09-08T09:00:00.000Z',
        url: 'https://ledgerflow.app/api/v1/tx'
      },
      {
        message: 'Uncaught TypeError: Cannot read properties of undefined',
        source: 'frontend',
        severity: 'error',
        createdAt: '2026-09-08T12:00:00.000Z',
        url: 'https://ledgerflow.app/ledger'
      }
    ];

    const result = aggregateErrorSignatures(rawTelemetry);

    assert.equal(result.totalErrors, 4, 'Total errors should equal input document count');
    assert.equal(result.uniqueErrors, 2, 'Should group into 2 unique signatures');

    // Group 1: TypeError (3 occurrences)
    const topGroup = result.groups[0];
    assert.equal(topGroup.message, 'Uncaught TypeError: Cannot read properties of undefined');
    assert.equal(topGroup.count, 3);
    assert.equal(topGroup.source, 'frontend');
    assert.equal(topGroup.severity, 'fatal', 'Severity should escalate to fatal if one occurrence was fatal');
    assert.equal(topGroup.firstSeen, '2026-09-08T10:00:00.000Z');
    assert.equal(topGroup.lastSeen, '2026-09-08T12:00:00.000Z');
    assert.ok(topGroup.sampleStack?.includes('TypeError'), 'Should retain sample stack trace');

    // Group 2: 504 Gateway Timeout (1 occurrence)
    const secondGroup = result.groups[1];
    assert.equal(secondGroup.message, 'Network request failed: 504 Gateway Timeout');
    assert.equal(secondGroup.count, 1);
    assert.equal(secondGroup.severity, 'warning');
  });

  test('processErrorDigest handles zero records gracefully without dispatching', async () => {
    const mockDb = {
      collection: () => ({
        where: () => ({
          get: async () => ({ docs: [] })
        })
      })
    };

    const result = await processErrorDigest({
      hoursBack: 24,
      recipientEmail: 'audit@ledgerflow.app',
      forceSendZero: false,
      dbOverride: mockDb
    });

    assert.equal(result.processed, true);
    assert.equal(result.totalErrors, 0);
    assert.equal(result.uniqueErrors, 0);
    assert.equal(result.delivered, false);
    assert.equal(result.recipient, 'audit@ledgerflow.app');
  });

  test('processErrorDigest aggregates from mock collection and attempts email delivery safely', async () => {
    const mockDocs = [
      {
        data: () => ({
          message: 'PostgreSQL connection timeout',
          source: 'backend',
          severity: 'fatal',
          createdAt: new Date().toISOString()
        })
      }
    ];

    const mockDb = {
      collection: () => ({
        where: () => ({
          get: async () => ({ docs: mockDocs })
        })
      })
    };

    // When no external provider credentials exist in test env, it should not crash
    const result = await processErrorDigest({
      hoursBack: 12,
      recipientEmail: 'alerts@test.com',
      dbOverride: mockDb
    });

    assert.equal(result.processed, true);
    assert.equal(result.totalErrors, 1);
    assert.equal(result.uniqueErrors, 1);
    assert.equal(result.recipient, 'alerts@test.com');
    assert.equal(result.groups[0].message, 'PostgreSQL connection timeout');
    assert.equal(result.groups[0].severity, 'fatal');
    // In test environment without API keys, delivered will be false and error documented
    assert.equal(result.delivered, false);
  });

  test('sendErrorDigestEmail throws NO_EMAIL_SERVICE_CONFIGURED when no credentials are provided', async () => {
    const originalResend = process.env.RESEND_API_KEY;
    const originalPostmark = process.env.POSTMARK_SERVER_TOKEN;
    const originalSendGrid = process.env.SENDGRID_API_KEY;

    try {
      delete process.env.RESEND_API_KEY;
      delete process.env.POSTMARK_SERVER_TOKEN;
      delete process.env.SENDGRID_API_KEY;

      await assert.rejects(
        async () => {
          await sendErrorDigestEmail({
            toEmail: 'ops@ledgerflow.app',
            periodHours: 24,
            totalErrors: 1,
            uniqueErrors: 1,
            groups: [
              {
                message: 'Test Error',
                count: 1,
                source: 'test',
                firstSeen: '2026-09-08T00:00:00Z',
                lastSeen: '2026-09-08T00:00:00Z'
              }
            ]
          });
        },
        /NO_EMAIL_SERVICE_CONFIGURED/
      );
    } finally {
      if (originalResend) process.env.RESEND_API_KEY = originalResend;
      if (originalPostmark) process.env.POSTMARK_SERVER_TOKEN = originalPostmark;
      if (originalSendGrid) process.env.SENDGRID_API_KEY = originalSendGrid;
    }
  });
});
