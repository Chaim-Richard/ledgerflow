/**
 * A-69: customer credit limits. Hand-checked cases: the limit is read from the customer's own
 * metadata and a corrupt value is not one, the open balance is the issued amount less what is paid
 * and written off (never below zero, drafts and void invoices are not sales), the over-limit state
 * and headroom come from that comparison, another currency is listed separately rather than added
 * or converted, and a customer with no limit is "not limited" — never over it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  creditLimitOf, openBalanceCents, customerCreditLimits, customerCreditLimitsCsvRows, CREDIT_LIMITS_CSV_HEADERS,
  CREDIT_LIMIT_METADATA_KEY,
} from '../lib/customerCreditLimits';

const customer = (id: string, name: string, limitCents?: number | string) => ({
  id, name, metadata: limitCents === undefined ? {} : { [CREDIT_LIMIT_METADATA_KEY]: limitCents },
});
const invoice = (over: { [key: string]: unknown }) => ({
  id: 'i', customerId: 'c1', status: 'sent', amountCents: 0, amountPaidCents: 0, currency: 'USD', ...over,
});

test('a limit is a whole non-negative number of minor units, and nothing else', () => {
  assert.equal(creditLimitOf(customer('c1', 'Acme', 100_00)), 100_00);
  assert.equal(creditLimitOf(customer('c1', 'Acme', -1)), undefined);
  assert.equal(creditLimitOf(customer('c1', 'Acme', 12.5)), undefined, 'fractions of a minor unit are not a limit');
  assert.equal(creditLimitOf(customer('c1', 'Acme', '1000')), undefined, 'a string is not a limit');
  assert.equal(creditLimitOf(customer('c1', 'Acme')), undefined);
});

test('the open balance is what is unpaid on an issued invoice, and a draft is not a sale', () => {
  assert.equal(openBalanceCents(invoice({ amountCents: 500_00, amountPaidCents: 200_00 })), 300_00);
  assert.equal(openBalanceCents(invoice({ amountCents: 500_00, amountPaidCents: 400_00, writtenOffCents: 100_00 })), 0);
  assert.equal(openBalanceCents(invoice({ amountCents: 500_00, status: 'draft' })), 0);
  assert.equal(openBalanceCents(invoice({ amountCents: 500_00, status: 'void' })), 0);
  assert.equal(openBalanceCents(invoice({ amountCents: 500_00, amountPaidCents: 900_00 })), 0, 'an overpayment is not a negative balance');
});

test('a customer over the limit is first, with the excess and the headroom of the others', () => {
  const rows = customerCreditLimits({
    homeCurrency: 'USD',
    asOfDate: '2026-10-13',
    customers: [customer('c1', 'Acme', 1_000_00), customer('c2', 'Beta', 500_00), customer('c3', 'Gamma'), customer('c4', 'Delta', 0)],
    invoices: [
      invoice({ id: 'i1', customerId: 'c1', amountCents: 1_200_00, dueDate: '2026-09-01' }),
      invoice({ id: 'i2', customerId: 'c2', amountCents: 400_00, amountPaidCents: 100_00, dueDate: '2026-11-01' }),
      invoice({ id: 'i3', customerId: 'c3', amountCents: 90_00 }),
      invoice({ id: 'i4', customerId: 'c4', amountCents: 10_00 }),
      invoice({ id: 'i5', customerId: 'c1', amountCents: 999_00, status: 'draft', dueDate: '2026-09-01' }),
    ],
  });
  assert.deepEqual(rows.map(row => row.name), ['Acme', 'Delta', 'Beta', 'Gamma'], 'the over-limit rows first, the worst excess first, then by exposure');
  const acme = rows[0];
  assert.equal(acme.state, 'over');
  assert.equal(acme.openCents, 1_200_00);
  assert.equal(acme.overdueCents, 1_200_00, 'past its due date on the as-of date');
  assert.equal(acme.headroomCents, -200_00);
  assert.equal(acme.utilizationPct, 120);
  assert.equal(acme.invoices, 1, 'the draft is not counted as an invoice');
  const gamma = rows.find(row => row.name === 'Gamma')!;
  assert.equal(gamma.state, 'not-limited');
  assert.equal(gamma.headroomCents, undefined, 'no limit, no headroom invented');
  assert.equal(gamma.utilizationPct, undefined);
  const beta = rows.find(row => row.name === 'Beta')!;
  assert.equal(beta.state, 'within');
  assert.equal(beta.headroomCents, 200_00);
  assert.equal(beta.overdueCents, 0, 'not overdue yet');
  const delta = rows.find(row => row.name === 'Delta')!;
  assert.equal(delta.state, 'over', 'a zero limit is a limit: any balance is over it');
  assert.equal(delta.headroomCents, -10_00);
});

test('another currency is listed beside the row, never added in or converted', () => {
  const rows = customerCreditLimits({
    homeCurrency: 'ILS',
    customers: [customer('c1', 'Acme', 1_000_00)],
    invoices: [
      invoice({ id: 'i1', customerId: 'c1', amountCents: 400_00, currency: 'ILS' }),
      invoice({ id: 'i2', customerId: 'c1', amountCents: 300_00, currency: 'EUR' }),
    ],
  });
  const acme = rows[0];
  assert.equal(acme.openCents, 400_00, 'the limit is compared with the base-currency balance only');
  assert.equal(acme.state, 'within');
  assert.deepEqual(acme.otherCurrencies, [{ currency: 'EUR', openCents: 300_00 }]);
});

test('a customer with neither a limit nor a balance is not a row, and the CSV has a row per currency', () => {
  const empty = customerCreditLimits({ customers: [customer('c1', 'Nobody')], invoices: [] });
  assert.deepEqual(empty, []);
  const rows = customerCreditLimits({
    homeCurrency: 'USD',
    customers: [customer('c1', 'Acme', 1_000_00), customer('c2', 'Beta')],
    invoices: [
      invoice({ id: 'i1', customerId: 'c1', amountCents: 300_00 }),
      invoice({ id: 'i2', customerId: 'c2', amountCents: 200_00, currency: 'GBP' }),
    ],
  });
  const csv = customerCreditLimitsCsvRows(rows, 'USD');
  assert.equal(csv.length, 2, 'one row per customer: only Beta has a second currency');
  for (const row of csv) assert.equal(row.length, CREDIT_LIMITS_CSV_HEADERS.length);
  assert.deepEqual(csv[0].slice(0, 3), ['Acme', 'within', 'USD']);
  assert.ok(csv.some(row => row.includes('GBP') && row.includes(200_00)));
});
