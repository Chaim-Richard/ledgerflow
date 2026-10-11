/**
 * Column chooser on report tables (N-10): the first column and at least one other always stay; the
 * choice is remembered per report; the CSS hides exactly those columns; on screen, "Columns" lists
 * the headings, hiding one keeps it hidden next time the report opens.
 */
import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { hiddenColumnsCss, readHidden, saveHidden, toggleColumn } from '../lib/columnChoice';
import ReportTableScroll from '../components/reporting/ReportTableScroll';

afterEach(() => { cleanup(); localStorage.clear(); });

test('what can be hidden, remembered per report, and the CSS for it', () => {
  assert.deepEqual(toggleColumn([], 0, 4), [], 'the first column stays');
  assert.deepEqual(toggleColumn([], 2, 4), [2]);
  assert.deepEqual(toggleColumn([2], 2, 4), []);
  assert.deepEqual(toggleColumn([1, 2], 3, 4), [1, 2], 'one other column stays');
  saveHidden('Sales', [2]);
  assert.deepEqual([readHidden('Sales'), readHidden('Other')], [[2], []]);
  assert.equal(hiddenColumnsCss('s1', [2]), '[data-columns="s1"] tr > :nth-child(3) { display: none; }');
});

const Report = () => (
  <ReportTableScroll>
    <table><caption>Sales by item</caption>
      <thead><tr><th>Item</th><th>Units</th><th>Amount</th></tr></thead>
      <tbody><tr><td>Chair</td><td>2</td><td>$100.00</td></tr></tbody>
    </table>
  </ReportTableScroll>
);

test('on screen: Columns lists the headings; a hidden one stays hidden next time', async () => {
  const view = render(<Report />);
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Columns' })));
  fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Units' }));
  assert.ok(screen.getByRole('button', { name: 'Columns (1 hidden)' }));
  assert.match(view.container.querySelector('style')!.textContent || '', /:nth-child\(2\) \{ display: none; \}/);
  view.unmount();
  render(<Report />);
  await waitFor(() => assert.ok(screen.getByRole('button', { name: 'Columns (1 hidden)' })));
});
