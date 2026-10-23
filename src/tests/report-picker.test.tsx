import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import ReportPicker from '../components/reporting/ReportPicker';
import { REPORT_TABS_REGISTRY } from '../config/registry';
import { useUIStore } from '../stores/useUIStore';
const ui = useUIStore.getState();
afterEach(() => { cleanup(); localStorage.removeItem('lf_recent_reports'); useUIStore.setState(ui, true); });
test('D-44 every registered report stays selectable exactly once in grouped select', () => {
  render(<ReportPicker activeTab="pnl" onSelect={() => {}} />);
  const select = screen.getByLabelText('Choose report', { exact: true }) as HTMLSelectElement;
  assert.equal(select.labels?.[0]?.textContent?.trim(), 'Choose report');
  assert.deepEqual(Array.from(select.options).map(o => o.value).filter(Boolean).sort(), REPORT_TABS_REGISTRY.map(r => r.id).sort());
  assert.equal(select.querySelectorAll('optgroup').length, 7);
});
test('D-44 search finds Hebrew data and no-match has a recovery message', () => {
  render(<ReportPicker activeTab="pnl" onSelect={() => {}} />);
  const input = screen.getByLabelText('Search reports');
  fireEvent.change(input, { target: { value: 'רווח והפסד' } });
  assert.ok(screen.getByRole('option', { name: 'Profit & Loss', hidden: true }));
  fireEvent.change(input, { target: { value: 'does-not-exist' } });
  assert.match(screen.getByRole('status', { hidden: true }).textContent || '', /Clear the search/);
});
test('D-44 selection uses existing navigation and saves bounded device-local recent list', () => {
  const selected: string[] = [];
  localStorage.setItem('lf_recent_reports', '["bogus","pnl","pnl"]');
  render(<ReportPicker activeTab="pnl" onSelect={id => selected.push(id)} />);
  fireEvent.change(screen.getByRole('combobox', { hidden: true }), { target: { value: 'balance-sheet' } });
  assert.deepEqual(selected, ['balance-sheet']);
  assert.deepEqual(JSON.parse(localStorage.getItem('lf_recent_reports')!), ['balance-sheet', 'pnl']);
});
test('D-44 existing report pins are reused; stale pins are ignored', () => {
  useUIStore.setState({ pinnedPages: [{ tab: 'reports', sub: 'pnl' }, { tab: 'reports', sub: 'gone' }] });
  render(<ReportPicker activeTab="pnl" onSelect={() => {}} />);
  assert.ok(screen.getByRole('region', { name: 'Pinned reports', hidden: true }));
  assert.equal(screen.queryByText('gone'), null);
});
