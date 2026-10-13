/**
 * A-49: the quotes a customer can accept. Only their own live quotes are listed; open ones can be
 * accepted with a full name and "I accept" (the Y-20 rules); expired, signed and closed ones say why.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { acceptQuoteProblem, customerOpenQuotes } from '../lib/customerQuotes';

const est = (overrides: Record<string, unknown>) => ({
  id: 'est_1', customerId: 'cus_a', number: 'EST-1', date: '2026-10-01', amountCents: 10000, status: 'sent', lines: [], ...overrides,
}) as never;

const estimates = [
  est({ id: 'est_open', number: 'EST-2', date: '2026-10-05', expiryDate: '2026-11-01' }),
  est({ id: 'est_old', number: 'EST-1', date: '2026-08-01', expiryDate: '2026-09-01' }),
  est({ id: 'est_signed', number: 'EST-3', date: '2026-09-10', signature: { name: 'Dana Levi', signedAt: '2026-09-11T10:00:00Z' } }),
  est({ id: 'est_draft', status: 'draft' }),
  est({ id: 'est_declined', status: 'declined' }),
  est({ id: 'est_other', customerId: 'cus_b' }),
];

describe('A-49 customer quote acceptance list', () => {
  test('lists only the customer\'s own live quotes, open first', () => {
    const items = customerOpenQuotes(estimates, 'cus_a', '2026-10-13');
    assert.deepEqual(items.map(i => [i.estimateId, i.state]), [['est_open', 'open'], ['est_old', 'expired'], ['est_signed', 'signed']]);
  });

  test('only open quotes can be accepted, and each closed one says why', () => {
    const items = customerOpenQuotes(estimates, 'cus_a', '2026-10-13');
    assert.equal(items[0].canAccept, true);
    assert.equal(items[0].reason, undefined);
    assert.equal(items[1].canAccept, false);
    assert.match(items[1].reason || '', /expired/);
    assert.match(items[2].reason || '', /already accepted/);
  });

  test('a quote with a proposal is shown as a proposal, with its title', () => {
    const items = customerOpenQuotes(estimates, 'cus_a', '2026-10-13', { est_open: { title: 'Office refit' } });
    assert.equal(items[0].kind, 'proposal');
    assert.equal(items[0].title, 'Office refit');
    assert.equal(items[1].kind, 'estimate');
  });

  test('a quote that expires today is still open; the day after it is expired', () => {
    const today = customerOpenQuotes([est({ id: 'e', expiryDate: '2026-10-13' })], 'cus_a', '2026-10-13');
    assert.equal(today[0].state, 'open');
    const after = customerOpenQuotes([est({ id: 'e', expiryDate: '2026-10-13' })], 'cus_a', '2026-10-14');
    assert.equal(after[0].state, 'expired');
  });

  test('accepting needs a full name and "I accept"; a closed quote refuses whatever is sent', () => {
    const [open, expired] = customerOpenQuotes(estimates, 'cus_a', '2026-10-13');
    assert.equal(acceptQuoteProblem(open, { name: 'Dana Levi', agree: true }), null);
    assert.match(String(acceptQuoteProblem(open, { name: 'D', agree: true })), /full name/);
    assert.match(String(acceptQuoteProblem(open, { name: 'Dana Levi', agree: false })), /I accept/);
    assert.match(String(acceptQuoteProblem(expired, { name: 'Dana Levi', agree: true })), /expired/);
  });

  test('no customer id, no list', () => {
    assert.deepEqual(customerOpenQuotes(estimates, '', '2026-10-13'), []);
  });
});
