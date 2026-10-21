/**
 * ISS-156 (GitHub #156, found by AI #4): the withholding rate follows the certificate valid on the payment's date.
 * The issue's own case, in agorot: certificate EXPIRY-PROBE at 5%, good until 2026-12-31; a bill of 11,800 with
 * 1,800 VAT saved, half paid (5,900) → VAT 900, before VAT 5,000.
 *   2026-12-31  certificate good       → 5% × 5,000 = 250 withheld, with the certificate number
 *   2027-01-01  certificate ran out    → the rate is cleared, nothing is sent until one is typed (was: 5% kept, 250)
 *   typed 20%                          → 20% × 5,000 = 1,000, no certificate number
 *   back to 2026-12-31                 → a typed rate stays the person's: 1,000 at 20%, still no certificate number
 *                                        (it is not the certificate's rate)
 *   cleared, then 2027-01-01 → 2026-12-31 with nothing typed → the certificate's 5% again: 250 with its number
 *   another vendor (no certificate)    → starts again: blank, nothing sent
 */
import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import WithholdingField, { type Withholding } from '../components/purchases/WithholdingField';

const probe = { metadata: { withholding: { ratePercent: 5, number: 'EXPIRY-PROBE', expires: '2026-12-31' } } };
const none = { metadata: {} };
const bills = [{ id: 'bill', taxVersion: 2, amountCents: 11_800, taxAmountCents: 1_800 }];

afterEach(() => cleanup());

test('the rate follows the certificate on the payment date; a typed rate is kept; a vendor change starts again', () => {
  const sent: Array<Withholding | null> = [];
  const onChange = (w: Withholding | null) => { sent.push(w); };
  const field = (vendor: typeof probe | typeof none, date: string) =>
    <WithholdingField vendor={vendor} date={date} currency="ILS" bills={bills} allocations={{ bill: 5_900 }} onChange={onChange} />;
  const input = () => screen.getByLabelText('Tax withheld at source, %') as HTMLInputElement;

  const { rerender } = render(field(probe, '2026-12-31'));
  assert.equal(input().value, '5');
  assert.deepEqual(sent.at(-1), { withheldCents: 250, ratePercent: 5, certificate: 'EXPIRY-PROBE' });

  rerender(field(probe, '2027-01-01'));
  assert.equal(input().value, '', 'the expired certificate\'s rate is not kept');
  assert.equal(sent.at(-1), null);
  assert.match(screen.getByRole('status').textContent || '', /ran out on 2026-12-31/);

  fireEvent.change(input(), { target: { value: '20' } });
  assert.deepEqual(sent.at(-1), { withheldCents: 1_000, ratePercent: 20 });

  rerender(field(probe, '2026-12-31'));
  assert.equal(input().value, '20', 'a typed rate stays');
  assert.deepEqual(sent.at(-1), { withheldCents: 1_000, ratePercent: 20 }, 'no certificate number with another rate');

  fireEvent.change(input(), { target: { value: '' } });
  rerender(field(probe, '2027-01-01'));
  assert.equal(input().value, '');
  rerender(field(probe, '2026-12-31'));
  assert.equal(input().value, '5', 'nothing typed: the certificate in force again');
  assert.deepEqual(sent.at(-1), { withheldCents: 250, ratePercent: 5, certificate: 'EXPIRY-PROBE' });

  fireEvent.change(input(), { target: { value: '7' } });
  rerender(field(none, '2026-12-31'));
  assert.equal(input().value, '', 'another vendor starts again');
  assert.equal(sent.at(-1), null);
});
