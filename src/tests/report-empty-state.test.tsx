import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import ReportTableScroll from '../components/reporting/ReportTableScroll';
import ReportEmptyState from '../components/reporting/ReportEmptyState';

afterEach(() => { cleanup(); localStorage.clear(); });

const tick = () => new Promise(resolve => setTimeout(resolve, 15));

test('an empty report table gets one shared next-action state', async () => {
  const view = render(<ReportTableScroll><table>
    <caption>Empty report</caption><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody />
  </table></ReportTableScroll>);
  await waitFor(() => assert.ok(view.getByText('Nothing to show in this table yet')));
  assert.match(view.getByText(/Check the selected period/).textContent || '', /save the source invoice/);
  assert.equal(view.container.querySelectorAll('[data-report-empty-state]').length, 1);
});

test('data rows, loading, and an explicit empty row never receive a second empty state', async () => {
  const data = render(<ReportTableScroll><table>
    <caption>Data report</caption><thead><tr><th>Item</th><th>Amount</th></tr></thead>
    <tbody><tr><td>Chair</td><td>$10.00</td></tr></tbody>
  </table></ReportTableScroll>);
  await tick();
  assert.equal(data.queryByText('Nothing to show in this table yet'), null);

  const loading = render(<ReportTableScroll><table>
    <caption>Loading report</caption><thead><tr><th>Item</th><th>Amount</th></tr></thead>
    <tbody><tr><td colSpan={2}>Loading complete history…</td></tr></tbody>
  </table></ReportTableScroll>);
  await tick();
  assert.equal(loading.queryByText('Nothing to show in this table yet'), null);

  const explicit = render(<ReportTableScroll><table>
    <caption>Explicit empty report</caption><thead><tr><th>Item</th><th>Amount</th></tr></thead>
    <tbody><tr><td colSpan={2} data-report-empty-state>No bills in this period. Choose another month or record a bill.</td></tr></tbody>
  </table></ReportTableScroll>);
  await tick();
  assert.equal(explicit.queryByText('Nothing to show in this table yet'), null);
  assert.equal(explicit.container.querySelectorAll('[data-report-empty-state]').length, 1);

  const outside = render(<div>
    <p role="status">Provisional: loaded records may be incomplete. Load full history before relying on these figures.</p>
    <ReportTableScroll><table>
      <caption>Provisional empty report</caption><thead><tr><th>Item</th><th>Amount</th></tr></thead><tbody />
    </table></ReportTableScroll>
  </div>);
  await tick();
  assert.equal(outside.queryByText('Nothing to show in this table yet'), null,
    'the report’s own live region remains the only status');
  assert.equal(outside.container.querySelectorAll('[role="status"]').length, 1);
});

test('the shared empty state can carry the screen’s own next action', () => {
  let opened = false;
  const view = render(<ReportEmptyState title="No saved budgets" description="Add a budget to compare plan with actual."
    actionLabel="Open budgets" onAction={() => { opened = true; }} />);
  fireEvent.click(view.getByRole('button', { name: 'Open budgets' }));
  assert.equal(opened, true);
  assert.equal(view.container.querySelector('[data-report-empty-state]')?.getAttribute('role'), 'status');
});
