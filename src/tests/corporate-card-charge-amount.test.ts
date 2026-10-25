/**
 * A card statement whose only amount column is a signed "Charge Amount": a refund (negative) is a credit and is
 * skipped, never imported as a charge (the column also matched 'charge' and was read as a debit, whose value is taken
 * as positive; found by the EG-10 review, FOR_YOU 25 Oct). Figures: 45.20 and 120.00 charged, 30.00 refunded.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCorporateCardCsv } from '../lib/corporateCardImport';

test('a signed Charge Amount column: charges in, the refund skipped as a credit', () => {
  const csv = ['Transaction Date,Description,Charge Amount', '2026-10-01,Taxi,45.20', '2026-10-02,Hotel,120.00', '2026-10-03,Hotel refund,-30.00'].join('\n');
  const out = parseCorporateCardCsv(csv, {} as never);
  assert.deepEqual(out.charges.map(c => c.amountCents), [4_520, 12_000]);
  assert.equal(out.skippedCreditsCount, 1);
});

test('a real Debit / Credit pair still works', () => {
  const csv = ['Date,Description,Debit,Credit', '2026-10-01,Taxi,45.20,', '2026-10-03,Refund,,30.00'].join('\n');
  const out = parseCorporateCardCsv(csv, {} as never);
  assert.deepEqual(out.charges.map(c => c.amountCents), [4_520]);
  assert.equal(out.skippedCreditsCount, 1);
});
