import assert from 'node:assert/strict';
import { test, describe } from 'node:test';
import { auditDescription, auditTime } from '../lib/auditFormat';

describe('Audit Format Utilities', () => {
  test('handles string details and object details with description', () => {
    assert.equal(auditDescription({ details: 'Legacy string audit detail' }), 'Legacy string audit detail');
    assert.equal(auditDescription({ details: { description: 'New audit format' } }), 'New audit format');
    assert.equal(auditDescription({ details: { description: 12345 } }), '12345');
    assert.equal(auditDescription({ details: null }), '');
    assert.equal(auditDescription(null), '');
  });

  test('handles ISO timestamps, Firestore Timestamp toDate objects, numbers, and missing values', () => {
    const isoDate = '2026-09-24T12:00:00.000Z';
    const date1 = auditTime({ timestamp: isoDate });
    assert.ok(date1 instanceof Date);
    assert.equal(date1?.toISOString(), isoDate);

    const mockFirestoreTimestamp = {
      toDate: () => new Date('2026-09-20T10:00:00.000Z')
    };
    const date2 = auditTime({ timestamp: mockFirestoreTimestamp });
    assert.ok(date2 instanceof Date);
    assert.equal(date2?.toISOString(), '2026-09-20T10:00:00.000Z');

    const epochMs = 1700000000000;
    const date3 = auditTime({ timestamp: epochMs });
    assert.ok(date3 instanceof Date);
    assert.equal(date3?.getTime(), epochMs);

    assert.equal(auditTime({ timestamp: 'invalid-date-string' }), null);
    assert.equal(auditTime({}), null);
    assert.equal(auditTime(null), null);
  });
});
