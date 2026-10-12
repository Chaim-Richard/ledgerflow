/**
 * A-74: the organisation's expense policy, checked against a claim before a person approves it.
 * What the test holds: a limit is inclusive (equal is fine, one cent over is not), a receipt rule is
 * about the amount and the attached receipts, rows are in force only between their own dates, a row
 * that matches nothing is not invented, and a corrupt stored row is dropped with a count rather than
 * guessed at. Money is whole cents throughout.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseExpensePolicy, policyRowsOn, policyRowsForLine, checkExpenseClaim,
  EXPENSE_POLICY_METADATA_KEY, type ExpensePolicyRow,
} from '../lib/expensePolicy';

const HOTEL: ExpensePolicyRow = {
  id: 'hotel', accountId: 'exp-travel', category: 'hotel', maxAmountCents: 25_000, receiptFromCents: 1,
  note: 'Hotel: up to $250.00 a night', validFrom: '2026-01-01',
};
const MEALS: ExpensePolicyRow = { id: 'meals', accountId: 'exp-meals', maxAmountCents: 6_000, receiptFromCents: 2_500, validFrom: '2025-01-01', validTo: '2025-12-31' };
const POLICY = { rows: [HOTEL, MEALS], defaultReceiptFromCents: 5_000 };

const line = (description: string, amountCents: number, accountId = 'exp-travel') => ({ line: { description, accountId, amountCents }, receipts: 0 });

test('the policy is read from the workspace metadata; a corrupt row is dropped, never guessed at', () => {
  const metadata = {
    [EXPENSE_POLICY_METADATA_KEY]: {
      rows: [
        HOTEL,
        { ...HOTEL, id: 'no-subject', accountId: undefined, category: undefined },
        { ...HOTEL, id: 'bad-date', validFrom: '2026-1-1' },
        { ...HOTEL, id: 'bad-end', validFrom: '2026-01-01', validTo: '2025-12-31' },
        { ...HOTEL, id: 'nothing', maxAmountCents: undefined, receiptFromCents: undefined },
        'not a row',
      ],
      defaultReceiptFromCents: 5_000,
    },
  };
  const { policy, dropped } = parseExpensePolicy(metadata);
  assert.equal(policy.rows.length, 1);
  assert.equal(policy.rows[0].id, 'hotel');
  assert.equal(policy.defaultReceiptFromCents, 5_000);
  assert.equal(dropped, 5);
  assert.deepEqual(parseExpensePolicy(undefined), { policy: { rows: [] }, dropped: 0 });
  assert.deepEqual(parseExpensePolicy({ expensePolicy: { rows: 'nope' } }).policy, { rows: [] });
});

test('a limit is inclusive and works in whole cents', () => {
  const atLimit = checkExpenseClaim({ rows: [HOTEL] }, { date: '2026-05-05', lines: [{ line: { description: 'Hotel night', accountId: 'exp-travel', amountCents: 25_000 }, receipts: 1 }] });
  assert.deepEqual(atLimit.breaches.filter(b => b.kind === 'over-max'), [], '$250.00 exactly is allowed');
  const oneOver = checkExpenseClaim({ rows: [HOTEL] }, { date: '2026-05-05', lines: [{ line: { description: 'Hotel night', accountId: 'exp-travel', amountCents: 25_001 }, receipts: 1 }] });
  assert.deepEqual(oneOver.breaches, [{
    line: 1, ruleId: 'hotel', kind: 'over-max', amountCents: 25_001, limitCents: 25_000,
    message: 'Line 1 is 250.01; Hotel: up to $250.00 a night allows up to 250.00',
  }]);
});

test('a receipt is asked for at the threshold, and one attached receipt satisfies the line', () => {
  const noReceipt = checkExpenseClaim(POLICY, { date: '2026-05-05', lines: [line('Hotel night', 12_000)] });
  assert.deepEqual(noReceipt.breaches.map(b => b.kind), ['receipt-missing'], 'the hotel row asks for a receipt from 0.01');
  assert.match(noReceipt.breaches[0].message, /a receipt is needed from 0.01/);

  const withReceipt = checkExpenseClaim(POLICY, { date: '2026-05-05', lines: [{ line: { description: 'Hotel night', accountId: 'exp-travel', amountCents: 12_000 }, receipts: 1 }] });
  assert.deepEqual(withReceipt.breaches, []);

  // the workspace default applies to a line no row matches
  const unmatched = checkExpenseClaim(POLICY, { date: '2026-05-05', lines: [line('Parking at the client', 6_000, 'exp-other')] });
  assert.deepEqual(unmatched.breaches.map(b => [b.kind, b.ruleId, b.limitCents]), [['receipt-missing', 'policy-default', 5_000]]);
  const smallUnmatched = checkExpenseClaim(POLICY, { date: '2026-05-05', lines: [line('Parking', 4_999, 'exp-other')] });
  assert.deepEqual(smallUnmatched.breaches, [], 'below the default threshold nothing is asked');
});

test('a row is in force only between its own dates, and the claim is checked on its own date', () => {
  const lines = [{ line: { description: 'Team meals', accountId: 'exp-meals', amountCents: 7_000 }, receipts: 1 }];
  const during = checkExpenseClaim({ rows: [MEALS] }, { date: '2025-06-01', lines });
  assert.deepEqual(during.breaches.map(b => b.kind), ['over-max'], '2025: the meals row is in force');
  const after = checkExpenseClaim({ rows: [MEALS] }, { date: '2026-06-01', lines });
  assert.deepEqual(after.breaches, [], '2026: the meals row ended, so nothing is claimed about it');
  assert.equal(after.rulesChecked, 0);
  assert.deepEqual(policyRowsOn({ rows: [HOTEL, MEALS] }, 'not-a-date'), []);
});

test('the subject is matched on the account and/or the line’s own words, and a mismatched row stays out', () => {
  const airlineRow: ExpensePolicyRow = { id: 'airline', accountId: 'exp-travel', category: 'airline', maxAmountCents: 90_000, validFrom: '2026-01-01' };
  assert.deepEqual(policyRowsForLine([airlineRow], { description: 'Airline ticket TLV-JFK', accountId: 'exp-travel', amountCents: 1 }).map(r => r.id), ['airline']);
  assert.deepEqual(policyRowsForLine([airlineRow], { description: 'Hotel night', accountId: 'exp-travel', amountCents: 1 }), [], 'both the account and the word must match when the row names both');
  assert.deepEqual(policyRowsForLine([HOTEL], { description: 'Hotel night', accountId: 'exp-travel', amountCents: 1 }).map(r => r.id), ['hotel']);

  const check = checkExpenseClaim({ rows: [airlineRow] }, { date: '2026-05-05', lines: [line('Hotel night', 50_000)] });
  assert.deepEqual(check.breaches, [], 'the hotel line is not judged by the airline rule');
  assert.equal(check.rulesChecked, 1);
  assert.equal(check.linesChecked, 1);
});

test('an unknown receipt count is a notice, never a breach', () => {
  // the report screen does not read the file list, so it passes receipts: undefined and gets a notice
  const check = checkExpenseClaim(POLICY, { date: '2026-05-05', lines: [{ line: { description: 'Hotel night', accountId: 'exp-travel', amountCents: 12_000 } }] });
  assert.deepEqual(check.breaches, []);
  assert.deepEqual(check.notices.map(n => [n.line, n.kind, n.limitCents]), [[1, 'receipt-not-checked', 1]]);
  assert.match(check.notices[0].message, /not counted here/);
  // zero receipts, by contrast, is a breach: somebody counted them
  const counted = checkExpenseClaim(POLICY, { date: '2026-05-05', lines: [{ line: { description: 'Hotel night', accountId: 'exp-travel', amountCents: 12_000 }, receipts: 0 }] });
  assert.deepEqual(counted.breaches.map(b => b.kind), ['receipt-missing']);
  assert.deepEqual(counted.notices, []);
});

test('a claim with several lines reports each breach with its own line number', () => {
  const check = checkExpenseClaim(POLICY, {
    date: '2026-05-05',
    lines: [line('Hotel night', 40_000), line('Taxi', 6_000, 'exp-other'), { line: { description: 'Hotel night 2', accountId: 'exp-travel', amountCents: 20_000 }, receipts: 2 }],
  });
  assert.deepEqual(check.breaches.map(b => [b.line, b.kind]), [[1, 'over-max'], [1, 'receipt-missing'], [2, 'receipt-missing']]);
});
