import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { CashForecast13WeekPanel } from '../components/reporting/CashForecast13WeekView';
import { cashForecast13Week } from '../lib/cashForecast13Week';

afterEach(() => cleanup());

const flushReportTable = async () => {
  await act(async () => { await new Promise<void>(resolve => setTimeout(resolve, 0)); });
};

const report = cashForecast13Week({
  asOf: '2026-01-05',
  homeCurrency: 'USD',
  openingCashCents: 100000,
  invoices: [
    { id: 'i1', label: 'INV-1', expectedDate: '2026-01-05', amountCents: 100000, currency: 'USD', status: 'sent' },
    { id: 'i2', label: 'INV-2', expectedDate: '2025-12-20', amountCents: 40000, currency: 'USD', status: 'overdue' },
  ],
  bills: [{ id: 'b1', label: 'BILL-1', expectedDate: '2026-01-12', amountCents: 30000, currency: 'USD', status: 'approved' }],
  recurring: [{ id: 'r1', label: 'Office rent', amountCents: 50000, frequency: 'monthly', nextOccurrence: '2026-01-10', direction: 'outflow' }],
});

const panel = (over: Partial<React.ComponentProps<typeof CashForecast13WeekPanel>> = {}) =>
  render(<CashForecast13WeekPanel
    report={report}
    currency="USD"
    asOf="2026-01-05"
    onAsOfChange={() => undefined}
    openingCashText="1000.00"
    onOpeningCashChange={() => undefined}
    {...over}
  />);

test('A-186 screen shows thirteen weeks with the money formatted in the workspace currency', async () => {
  panel();
  await flushReportTable();
  assert.ok(screen.getByRole('heading', { name: '13-week cash forecast' }));
  const tables = screen.getAllByRole('table');
  const weeks = tables[0].textContent || '';
  assert.match(weeks, /Week 1/);
  assert.match(weeks, /Week 13/);
  // Week 1: 1,000.00 opening + 1,000.00 invoice + 400.00 past-due invoice − 500.00 rent = 1,900.00
  assert.match(weeks, /\$1,900\.00/);
  assert.match(screen.getByText(/Expected in:/).closest('p')!.textContent || '', /Expected out:/);
});

test('A-186 screen names the money that is already past due and the lines not in the weeks', async () => {
  panel({
    report: cashForecast13Week({
      asOf: '2026-01-05', homeCurrency: 'USD', openingCashCents: 0,
      invoices: [
        { id: 'i1', label: 'INV-1', expectedDate: '2025-12-20', amountCents: 40000, currency: 'USD', status: 'overdue' },
        { id: 'eur', label: 'INV-EUR', expectedDate: '2026-01-06', amountCents: 9000, currency: 'EUR', status: 'sent' },
      ],
      bills: [], recurring: [],
    }),
  });
  await flushReportTable();
  assert.match(screen.getByRole('alert').textContent || '', /Already past its due date/);
  assert.match(screen.getByText(/Not in the weeks:/).textContent || '', /in another currency/);
  assert.match(screen.getByText(/Not in the weeks:/).textContent || '', /without a readable date|0 without a readable date/);
});

test('A-186 screen says what a forecast is not, and refuses the export while a list is incomplete', async () => {
  panel({ report: null, partial: true, validDay: true });
  await flushReportTable();
  assert.match(screen.getByText(/not a prediction/).textContent || '', /assumes every customer pays on the due date/);
  assert.match(screen.getByRole('alert').textContent || '', /capped or failed/);
  assert.equal((screen.getByRole('button', { name: 'Export CSV' }) as HTMLButtonElement).disabled, true);
});

test('A-186 screen asks for a real day and a number instead of forecasting on a broken input', async () => {
  panel({ report: null, validDay: false, openingCashValid: false });
  await flushReportTable();
  const alerts = screen.getAllByRole('alert').map(node => node.textContent || '').join(' ');
  assert.match(alerts, /Choose a real assessment day/);
  assert.match(alerts, /not a number/);
  assert.equal((screen.getByRole('button', { name: 'Export CSV' }) as HTMLButtonElement).disabled, true);
});
