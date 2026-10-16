import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { Vendor1099ReadinessPanel } from '../components/reporting/Vendor1099ReadinessReportView';
import { vendor1099Readiness } from '../lib/vendor1099Readiness';

afterEach(() => cleanup());

const flushReportTable = async () => {
  await act(async () => { await new Promise<void>(resolve => setTimeout(resolve, 0)); });
};

const report = vendor1099Readiness({
  taxYear: 2025,
  homeCurrency: 'USD',
  vendors: [
    { id: 'v1', name: 'Ada Consulting', address: '1 Main St', is1099: true, metadata: { taxPlace: { country: 'US' }, taxId: '12-3456789' } },
    { id: 'v2', name: 'No Papers Ltd', metadata: {} },
  ],
  payments: [
    { contactId: 'v1', date: '2025-03-04', amountCents: 70000, currency: 'USD', direction: 'made', status: 'posted' },
    { contactId: 'v2', date: '2025-04-04', amountCents: 90000, currency: 'USD', direction: 'made', status: 'posted' },
  ],
});

test('A-188 screen shows the masked tax ID, the readiness and never the full number', async () => {
  render(<Vendor1099ReadinessPanel report={report} currency="USD" taxYearText="2025" onTaxYearChange={() => undefined} />);
  await flushReportTable();
  assert.ok(screen.getByRole('heading', { name: 'Vendor 1099 readiness' }));
  const table = screen.getByRole('table').textContent || '';
  assert.match(table, /Ada Consulting/);
  assert.match(table, /••••6789/);
  assert.doesNotMatch(table, /12-3456789/);
  assert.match(table, /Missing details/);
  assert.match(table, /Details recorded — review/);
  assert.match(screen.getByText(/Threshold for 2025:/).closest('p')!.textContent || '', /\$600\.00/);
});

test('A-188 screen filters to the vendors that are over the threshold with missing details', async () => {
  render(<Vendor1099ReadinessPanel report={report} currency="USD" taxYearText="2025" onTaxYearChange={() => undefined} />);
  await flushReportTable();
  fireEvent.click(screen.getByLabelText(/Only over the threshold with missing details/));
  const table = screen.getByRole('table').textContent || '';
  assert.match(table, /No Papers Ltd/);
  assert.doesNotMatch(table, /Ada Consulting/);
});

test('A-188 screen says what it is not: no filing, no W-9 claim, no assumed country', async () => {
  render(<Vendor1099ReadinessPanel report={report} currency="USD" taxYearText="2025" onTaxYearChange={() => undefined} />);
  await flushReportTable();
  const table = screen.getByRole('table').textContent || '';
  assert.match(table, /Not recorded here/);
  assert.match(table, /Not recorded/);
  assert.match(screen.getByText(/no W-9 field/).closest('p')!.textContent || '', /nothing here files a form/);
});

test('A-188 screen refuses a year outside the supported range and withholds the export when lists are incomplete', async () => {
  render(<Vendor1099ReadinessPanel report={null} currency="USD" taxYearText="1800" onTaxYearChange={() => undefined} validYear={false} partial />);
  await flushReportTable();
  const alerts = screen.getAllByRole('alert').map(node => node.textContent || '').join(' ');
  assert.match(alerts, /Choose a tax year between 2020 and 2099/);
  assert.match(alerts, /capped or failed/);
  assert.equal((screen.getByRole('button', { name: 'Export CSV' }) as HTMLButtonElement).disabled, true);
});
