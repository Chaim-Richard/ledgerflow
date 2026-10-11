/** Israel's allocation numbers on large business invoices (PLAN IL-6). */
import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { allocationNumberProblem, allocationThresholdCents, needsAllocationNumber } from '../lib/tax/ilAllocation';
import AllocationNumberField from '../components/sales/AllocationNumberField';
import { layoutDocumentPdf } from '../server/services/pdfService';

afterEach(() => cleanup());

test('the threshold steps down by date; only business buyers, above it before VAT, with VAT charged', () => {
  assert.equal(allocationThresholdCents('2024-01-01'), undefined);
  assert.equal(allocationThresholdCents('2025-06-01'), 2000000);
  assert.equal(allocationThresholdCents('2026-03-01'), 1000000);
  assert.equal(allocationThresholdCents('2026-10-11'), 500000);
  const base = { date: '2026-10-11', currency: 'ILS', buyerVatNumber: '514000000', taxCents: 90000 };
  assert.equal(needsAllocationNumber({ ...base, netCents: 500001 }), true);
  assert.equal(needsAllocationNumber({ ...base, netCents: 500000 }), false, 'exactly the threshold is not above it');
  assert.equal(needsAllocationNumber({ ...base, netCents: 900000, buyerVatNumber: '' }), false, 'a private buyer');
  assert.equal(needsAllocationNumber({ ...base, netCents: 200000, currency: 'USD', exchangeRate: 3.7 }), true, 'USD 2,000 at 3.7 is ₪7,400');
  assert.equal(allocationNumberProblem('123456789'), null);
  assert.match(String(allocationNumberProblem('12345')), /9 digits/);
});

test('the invoice asks for it when needed; the PDF prints it', () => {
  const typed: string[] = [];
  const customer = { metadata: { vatNumber: '514000000' } };
  render(<AllocationNumberField customer={customer} date="2026-10-11" netCents={600000} taxCents={108000} currency="ILS" value="" onChange={v => { typed.push(v); }} />);
  fireEvent.change(screen.getByLabelText(/Allocation number/), { target: { value: '12-3456789a' } });
  assert.deepEqual(typed, ['123456789'], 'digits only');
  cleanup();
  render(<AllocationNumberField customer={{}} date="2026-10-11" netCents={600000} taxCents={108000} currency="ILS" value="" onChange={() => {}} />);
  assert.equal(screen.queryByLabelText(/Allocation number/), null, 'not for a private buyer');
  const layout = layoutDocumentPdf('invoice', { number: 'INV-9', date: '2026-10-11', status: 'sent', amountCents: 708000, items: [], metadata: { ilAllocationNumber: '123456789' } }, { name: 'Acme' }, { language: 'he' });
  assert.ok(layout.meta.some(([label, value]) => label === 'מספר הקצאה' && value === '123456789'));
});
