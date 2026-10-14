import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ledgerMark, LedgerDoorError } from '../server/services/ledgerDoor';

// AU-6: a posted entry is only marked (void, reversed by…), never edited in place.
test('ledgerMark lets the header marks through', () => {
  const calls: unknown[] = [];
  ledgerMark({ update: (_r, d) => calls.push(d) }, 'ref', { status: 'void', voidedReason: 'x', voidedAt: 'now', reversalEventId: 'r1', updatedAt: 'now' });
  assert.equal(calls.length, 1);
});

test('ledgerMark refuses a change to amounts or lines and writes nothing', () => {
  const calls: unknown[] = [];
  for (const patch of [{ lines: [] }, { totalAmountCents: 5 }, { status: 'posted', date: '2026-01-01' }]) {
    assert.throws(() => ledgerMark({ update: (_r, d) => calls.push(d) }, 'ref', patch), LedgerDoorError);
  }
  assert.equal(calls.length, 0);
});
