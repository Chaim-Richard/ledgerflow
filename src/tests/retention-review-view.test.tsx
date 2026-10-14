import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { RetentionReviewPanel } from '../components/reporting/RetentionReviewReportView';
import { retentionReview } from '../lib/retentionReview';

afterEach(() => cleanup());

const flushReportTable = async () => {
  await act(async () => { await new Promise<void>(resolve => setTimeout(resolve, 0)); });
};

test('A-144 screen presents the country table and record due dates without a delete action', async () => {
  const report = retentionReview({
    records: [
      { collection: 'bills', id: 'b1', number: 'B-1', date: '2019-01-01', status: 'approved' },
      { collection: 'invoices', id: 'i1', number: 'I-1', date: '2026-01-01', status: 'sent' },
    ],
    profiles: { books: { name: 'US books', place: { country: 'US' } } },
    asOfDate: '2026-02-01',
  });
  render(<RetentionReviewPanel report={report} asOfDate="2026-02-01" />);
  await flushReportTable();

  assert.ok(screen.getByRole('heading', { name: 'Record retention review' }));
  const timetable = screen.getByRole('table', { name: /owner-specified country review timetable/i }).textContent || '';
  assert.match(timetable, /7 years/);
  assert.match(timetable, /United Kingdom \(UK\)/);
  assert.doesNotMatch(timetable, /United Kingdom \(GB\)/);
  assert.match(screen.getByRole('table', { name: /document review status/i }).textContent || '', /2026-01-01/);
  assert.ok(screen.getByText(/not legal advice/));
  assert.equal(screen.queryByRole('button', { name: /delete/i }), null);
  fireEvent.change(screen.getByLabelText('Retention review status'), { target: { value: 'due' } });
  assert.match(screen.getByRole('table', { name: /document review status/i }).textContent || '', /B-1/);
  assert.doesNotMatch(screen.getByRole('table', { name: /document review status/i }).textContent || '', /I-1/);
});

test('A-144 screen explains when attachment data is unavailable and disables incomplete exports', async () => {
  const report = retentionReview({ records: [], asOfDate: '2026-02-01' });
  render(<RetentionReviewPanel report={report} asOfDate="2026-02-01" partial attachmentIndexAvailable={false} />);
  await flushReportTable();
  assert.ok(screen.getByText(/Attached-file metadata is not available in demo\/offline mode/));
  assert.ok(screen.getByRole('alert').textContent?.includes('review history is incomplete'));
  assert.equal((screen.getByRole('button', { name: 'Export CSV' }) as HTMLButtonElement).disabled, true);
});
