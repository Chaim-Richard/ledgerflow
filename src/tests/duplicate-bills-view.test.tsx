import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { DuplicateBillsReviewPanel } from '../components/reporting/DuplicateBillsReviewView';
import { findDuplicateBills } from '../lib/duplicateBills';

afterEach(() => cleanup());

const flushReportTable = async () => {
  await act(async () => { await new Promise<void>(resolve => setTimeout(resolve, 0)); });
};

const review = findDuplicateBills([
  { id: 'b1', vendorId: 'v1', vendorName: 'Northwind', number: 'A-11', date: '2026-03-02', amountCents: 125000, currency: 'USD', status: 'approved' },
  { id: 'b2', vendorId: 'v1', vendorName: 'Northwind', number: 'A-12', date: '2026-03-04', amountCents: 125000, currency: 'USD', status: 'approved' },
  { id: 'b3', vendorId: 'v2', vendorName: 'Harbour', number: 'H-1', date: '2026-04-01', amountCents: 5000, currency: 'USD', status: 'approved', metadata: { poNumber: 'PO-9' } },
  { id: 'b4', vendorId: 'v2', vendorName: 'Harbour', number: 'H-2', date: '2026-04-01', amountCents: 5000, currency: 'USD', status: 'approved', metadata: { poNumber: 'PO-9' } },
]);

test('A-195 screen shows the pairs, formats the money and offers no merge or delete action', async () => {
  render(<DuplicateBillsReviewPanel review={review} currency="USD" />);
  await flushReportTable();

  assert.ok(screen.getByRole('heading', { name: 'Duplicate bill review' }));
  const table = screen.getByRole('table').textContent || '';
  assert.match(table, /Northwind/);
  assert.match(table, /Harbour/);
  assert.match(table, /\$1,250\.00/);
  assert.match(table, /Shared document evidence|Date window only/);
  assert.equal(screen.queryByRole('button', { name: /merge/i }), null);
  assert.equal(screen.queryByRole('button', { name: /delete/i }), null);
  assert.equal(screen.queryByRole('button', { name: /void/i }), null);
});

test('A-195 screen filters by evidence and by a typed search', async () => {
  render(<DuplicateBillsReviewPanel review={review} currency="USD" />);
  await flushReportTable();

  fireEvent.change(screen.getByLabelText('Evidence'), { target: { value: 'documented' } });
  const table = () => screen.getByRole('table').textContent || '';
  assert.match(table(), /Harbour/);
  assert.doesNotMatch(table(), /Northwind/);

  fireEvent.change(screen.getByLabelText('Find a bill or vendor'), { target: { value: 'H-2' } });
  assert.match(table(), /Harbour/);
});

test('A-195 screen withholds the export and says so when the bill list is incomplete', async () => {
  render(<DuplicateBillsReviewPanel review={review} partial />);
  await flushReportTable();
  assert.match(screen.getByRole('alert').textContent || '', /capped or failed/);
  assert.equal((screen.getByRole('button', { name: 'Export CSV' }) as HTMLButtonElement).disabled, true);
});

test('A-195 screen states that nothing matched is not proof, and skips the pairs it excluded', async () => {
  const empty = findDuplicateBills([
    { id: 'b1', vendorId: 'v1', date: '2026-03-02', amountCents: 100, status: 'approved' },
    { id: 'b2', vendorId: 'v1', date: '2026-03-02', amountCents: 100, status: 'void' },
  ]);
  render(<DuplicateBillsReviewPanel review={empty} />);
  await flushReportTable();
  assert.match(screen.getByText(/not prove there is no duplicate/).textContent || '', /not prove there is no duplicate/);
  assert.match(screen.getByText(/Left out:/).textContent || '', /1 void, cancelled or rejected bill\(s\)/);
});
