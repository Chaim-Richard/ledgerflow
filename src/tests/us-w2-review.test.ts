import test from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../lib/csvExport';
import { usW2Review, type W2ReviewEmployee } from '../lib/tax/usW2Review';

const example: W2ReviewEmployee = {
  employeeId: 'worker-1', name: 'Example Employee', currency: 'USD', sourceReviewed: true,
  box1Cents: 1000000, box2Cents: 150000, box3Cents: 1300000,
  box4Cents: 80600, box5Cents: 1300000, box6Cents: 18850,
};

test('E-19 uses independently reviewed IRS 2026 W-2 boxes without recomputing wage or tax amounts', () => {
  // IRS 2026 W-2/W-3 instructions worked example: 10,000; 1,500; 13,000; 806; 13,000; 188.50
  const result = usW2Review([example], 2026);
  assert.equal(result.readyForFiling, false);
  assert.equal(result.canDownloadForReview, true);
  assert.deepEqual(result.rows[0].slice(3, 9),
    ['10000.00', '1500.00', '13000.00', '806.00', '13000.00', '188.50']);
  assert.match(toCsv([...result.headers], result.rows), /REVIEW ONLY/);
  assert.equal(result.rows[0].includes('123-45-6789'), false);
});

test('E-19 refuses missing figures, unsafe cents, unsupported years and unreviewed source', () => {
  const cases = [
    { box1Cents: undefined }, { box5Cents: NaN },
    { box2Cents: -1 }, { box6Cents: 1.5 },
    { box4Cents: Number.MAX_SAFE_INTEGER + 1 },
    { box1Cents: Number.MAX_SAFE_INTEGER },
    { sourceReviewed: false }, { currency: 'ILS' },
    { contractor: true }, { box3Cents: 19000000 },
    { box3Cents: 1300000, box5Cents: 1200000 },
  ] as const;
  for (const change of cases) {
    const result = usW2Review([{ ...example, ...change }], 2026);
    assert.equal(result.canDownloadForReview, false, JSON.stringify(change));
    assert.deepEqual(result.rows, []);
    assert.ok(result.blockers.length > 0);
  }
  assert.equal(usW2Review([], 2026).canDownloadForReview, false);
  assert.equal(usW2Review([example], 2027).canDownloadForReview, false);
  assert.equal(usW2Review([example, example], 2026).canDownloadForReview, false);
});

test('E-19 keeps Hebrew names in deterministic review CSV, zero withholding is explicit, and inputs stay unchanged', () => {
  const hebrew = Object.freeze({
    ...example, employeeId: 'other', name: 'עובד שני',
    box2Cents: 0, box4Cents: 0, box6Cents: 0,
  });
  const input = Object.freeze([hebrew, Object.freeze(example)]);
  const result = usW2Review(input, 2026);
  assert.equal(result.canDownloadForReview, true);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows.find(row => row[1] === 'other')?.[4], '0.00');
  assert.ok(toCsv([...result.headers], result.rows).includes('עובד שני'));
});

test('E-19 rejects 2025 wage-base overflow separately from 2026', () => {
  const boundary = { ...example, box3Cents: 18000000, box5Cents: 18000000 };
  assert.equal(usW2Review([boundary], 2025).canDownloadForReview, false);
  assert.equal(usW2Review([boundary], 2026).canDownloadForReview, true);
});
