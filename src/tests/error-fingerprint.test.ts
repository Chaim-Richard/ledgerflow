import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { 
  generateErrorFingerprint, 
  aggregateErrorSignatures 
} from '../server/services/errorDigestService.ts';

describe('Error Telemetry Fingerprinting and Aggregation', () => {
  test('normalizes dynamic user IDs, digit runs, and quotes into identical fingerprint key', () => {
    const fp1 = generateErrorFingerprint('frontend', 'User 17 not found');
    const fp2 = generateErrorFingerprint('frontend', 'User 42 not found');
    const fp3 = generateErrorFingerprint('frontend', 'User 91 not found');

    assert.equal(fp1, fp2);
    assert.equal(fp2, fp3);
    assert.equal(fp1, 'frontend::User # not found');
  });

  test('normalizes UUIDs and hex IDs in error messages', () => {
    const uuidMsg = 'Failed to load workspace 123e4567-e89b-12d3-a456-426614174000 document';
    const fp = generateErrorFingerprint('backend', uuidMsg);

    assert.equal(fp, 'backend::Failed to load workspace <id> document');
  });

  test('aggregates variable user error messages into a single ErrorGroupSummary', () => {
    const rawDocs = [
      { message: 'User 101 not found', source: 'api', severity: 'error', createdAt: '2026-09-08T10:00:00Z' },
      { message: 'User 202 not found', source: 'api', severity: 'error', createdAt: '2026-09-08T11:00:00Z' },
      { message: 'User 303 not found', source: 'api', severity: 'error', createdAt: '2026-09-08T12:00:00Z' }
    ];

    const result = aggregateErrorSignatures(rawDocs);

    assert.equal(result.totalErrors, 3);
    assert.equal(result.uniqueErrors, 1, 'Variable user IDs should collapse into 1 error group');
    assert.equal(result.groups[0].count, 3);
    assert.equal(result.groups[0].firstSeen, '2026-09-08T10:00:00Z');
    assert.equal(result.groups[0].lastSeen, '2026-09-08T12:00:00Z');
  });
});
