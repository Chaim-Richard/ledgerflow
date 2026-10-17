import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { DocumentNumberGapsPanel } from '../components/reporting/DocumentNumberGapsReportView';
import { documentNumberGaps } from '../lib/documentNumberGaps';

afterEach(() => cleanup());

const flushReportTable = async () => {
  await act(async () => { await new Promise<void>(resolve => setTimeout(resolve, 0)); });
};

const report = documentNumberGaps([
  { id: 'i1', collection: 'Invoice', number: 'INV-2026-0001' },
  { id: 'i2', collection: 'Invoice', number: 'INV-2026-0002' },
  { id: 'i4', collection: 'Invoice', number: 'INV-2026-0004' },
  { id: 'c1', collection: 'Credit note', number: 'CN-7' },
  { id: 'c2', collection: 'Credit note', number: 'CN-7' },
  { id: 'q1', collection: 'Bill', number: 'B-1' },
  { id: 'q2', collection: 'Bill', number: 'B-2' },
  { id: 'x1', collection: 'Estimate', number: 'LEGACY/A' },
  { id: 'x2', collection: 'Estimate', number: undefined },
]);

test('A-184 screen lists the missing and repeated numbers with their series', async () => {
  render(<DocumentNumberGapsPanel report={report} documents={7} excludedDrafts={3} />);
  await flushReportTable();

  assert.ok(screen.getByRole('heading', { name: 'Document number gaps' }));
  const table = screen.getByRole('table').textContent || '';
  assert.match(table, /INV-2026-/);
  assert.match(table, /CN-7/);
  const invoiceRow = screen.getAllByRole('row').find(row => (row.textContent || '').includes('INV-2026-'))!;
  const cells = Array.from(invoiceRow.querySelectorAll('td')).map(cell => (cell.textContent || '').trim());
  assert.equal(cells[1], '3');   // documents in the series
  assert.equal(cells[2], '1–4'); // first and last number
  assert.equal(cells[3], '3');   // the number missing between them
  assert.match(screen.getByText(/Excluded: 3 draft/).textContent || '', /3 draft, void, cancelled or rejected/);
  assert.match(screen.getByText(/1 issued document\(s\) have no number at all/i).textContent || '', /no number at all/);
  assert.match(screen.getByRole('heading', { name: /Numbers without a readable series/ }).textContent || '', /readable series/);
});

test('A-184 screen can show only the series that need a look', async () => {
  render(<DocumentNumberGapsPanel report={report} documents={7} excludedDrafts={3} />);
  await flushReportTable();
  fireEvent.click(screen.getByLabelText(/Only series with a gap/));
  const table = screen.getByRole('table').textContent || '';
  assert.match(table, /INV-2026-/);
  assert.match(table, /CN-7/);     // a repeated number is kept
  assert.doesNotMatch(table, /B-1/); // a clean series is dropped
});

test('A-184 screen withholds the export while a document list is incomplete', async () => {
  render(<DocumentNumberGapsPanel report={report} documents={7} partial />);
  await flushReportTable();
  assert.match(screen.getByRole('alert').textContent || '', /capped or failed/);
  assert.equal((screen.getByRole('button', { name: 'Export CSV' }) as HTMLButtonElement).disabled, true);
});

test('A-184 screen says a gap is not proof that a document was deleted', async () => {
  render(<DocumentNumberGapsPanel report={documentNumberGaps([])} />);
  await flushReportTable();
  assert.match(screen.getByText(/not proof that a document was deleted/).textContent || '', /not proof/);
  assert.match(screen.getByText(/No series to show/).textContent || '', /No series to show/);
});
