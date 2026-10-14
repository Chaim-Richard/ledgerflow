import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ExpenseReceiptChecklistPanel } from '../components/reporting/ExpenseReceiptChecklistReportView';
import { receiptChecklist } from '../lib/receiptChecklist';
import { makeBill } from './fixtures';

afterEach(() => cleanup());

const flushReportTable = async () => {
  await act(async () => { await new Promise<void>(resolve => setTimeout(resolve, 0)); });
};

test('A-133 screen groups missing evidence by employee and distinguishes linked files from verified receipts', async () => {
  const report = receiptChecklist({
    bills: [
      makeBill({ id: 'missing', vendorName: 'Rina', date: '2026-06-10', amountCents: 5500, currency: 'USD', metadata: { expenseClaim: { state: 'submitted', submittedBy: 'u1', submittedByName: 'Rina', submittedAt: '2026-06-10' } } }),
      makeBill({ id: 'file', vendorName: 'Omar', date: '2026-06-11', amountCents: 8000, currency: 'EUR', metadata: { expenseClaim: { state: 'approved', submittedBy: 'u2', submittedByName: 'Omar', submittedAt: '2026-06-11' } } }),
    ],
    attachmentLinks: [{ id: 'f1', linkedId: 'file', linkedCollection: 'bills' }],
    attachmentIndexComplete: true,
    from: '2026-06-01',
    to: '2026-06-30',
  });
  render(<ExpenseReceiptChecklistPanel report={report} from="2026-06-01" to="2026-06-30" />);
  await flushReportTable();

  assert.ok(screen.getByRole('heading', { name: 'Expense receipt checklist' }));
  assert.match(screen.getByText(/Claims to review by employee/).parentElement?.textContent || '', /Rina: 1/);
  assert.match(screen.getByRole('table').textContent || '', /No receipt URL or linked file — review/);
  assert.match(screen.getByRole('table').textContent || '', /1 linked file\(s\); content not checked/);
  assert.ok(screen.getByRole('button', { name: 'Export CSV' }));
});

test('A-133 screen reports unknown status rather than missing evidence when file metadata is unavailable', async () => {
  const report = receiptChecklist({
    bills: [makeBill({ id: 'claim', vendorName: 'Ari', date: '2026-06-10', metadata: { expenseClaim: { state: 'submitted', submittedBy: 'u1', submittedAt: '2026-06-10' } } })],
    attachmentLinks: [],
    attachmentIndexComplete: false,
  });
  render(<ExpenseReceiptChecklistPanel report={report} attachmentIndexAvailable={false} />);
  await flushReportTable();
  assert.equal(report.missingClaims, 0);
  assert.ok(screen.getByText(/not available in demo\/offline mode/));
  assert.match(screen.getByRole('table').textContent || '', /Not checked in demo \/ offline mode/);
});
