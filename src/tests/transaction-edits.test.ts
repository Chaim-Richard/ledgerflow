/** Changing an amount in the transaction list (L-147): both lines move together. */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { withNewAmount } from '../lib/transactionEdits';
import type { TransactionLine } from '../types';

const line = (accountId: string, amountCents: number) => ({ accountId, amountCents }) as TransactionLine;

describe('withNewAmount', () => {
  test('a two-line entry gets the new amount on both sides, still balanced', () => {
    const out = withNewAmount({ lines: [line('rent', 1000), line('bank', -1000)] }, 1250);
    assert.deepEqual(out?.lines.map(l => [l.accountId, l.amountCents]), [['rent', 1250], ['bank', -1250]]);
    assert.equal(out?.totalAmountCents, 1250);
  });

  test('the credit can come first; a negative typed amount uses its size', () => {
    const out = withNewAmount({ lines: [line('sales', -500), line('bank', 500)] }, -800);
    assert.deepEqual(out?.lines.map(l => l.amountCents), [-800, 800]);
  });

  test('split, unbalanced or empty entries are left to the entry dialog', () => {
    assert.equal(withNewAmount({ lines: [line('a', 100), line('b', -60), line('c', -40)] }, 200), null);
    assert.equal(withNewAmount({ lines: [line('a', 100), line('b', -90)] }, 200), null);
    assert.equal(withNewAmount({ lines: [line('a', 0), line('b', 0)] }, 200), null);
    assert.equal(withNewAmount({ lines: [] }, 200), null);
  });
});
