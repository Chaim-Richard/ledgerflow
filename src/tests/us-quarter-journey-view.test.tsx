import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
afterEach(() => cleanup());
import { usQuarterJourney } from '../lib/usQuarterJourney';
import type { TaxProfiles } from '../lib/tax/profile';
import { UsQuarterJourneyPanel } from '../components/reporting/UsQuarterJourneyReportView';

const profiles: TaxProfiles = {
  labels: { 'world:tx': { place: { country: 'US', state: 'TX' }, registrations: [{ kind: 'sales_tax', number: '3200', place: { country: 'US', state: 'TX' } }] } },
};
const customers = [{ id: 'austin', metadata: { taxPlace: { country: 'US', state: 'TX', city: 'Austin' } } }];
const invoices = [
  { id: 'i1', date: '2026-08-10', status: 'sent', amountCents: 108250, taxAmountCents: 8250, customerId: 'austin', dimensions: { world: 'tx' }, taxTreatment: 'standard',
    taxBreakdown: [{ name: 'Texas state sales tax', rate: 0, taxCents: 6250 }, { name: 'Austin', rate: 0, taxCents: 2000 }] },
] as never;

const journey = (extra: Partial<Parameters<typeof usQuarterJourney>[0]> = {}) => usQuarterJourney({
  quarter: '2026-Q3', today: '2026-10-18', currency: 'USD', profiles, order: ['world'], customers, invoices,
  ...extra,
});

test('A-153 screen: the journey lists every step with its screen and what the data says', () => {
  render(<UsQuarterJourneyPanel journey={journey()} currency="USD" quarterText="2026-Q3" onQuarterChange={() => {}} />);
  assert.ok(screen.getByRole('heading', { name: 'US quarter journey' }));
  for (const title of ['Sales-tax permits for the quarter', 'Use tax on out-of-state purchases', 'Exemption certificates', '1099 preview for the tax year', 'Close the quarter’s months'])
    assert.ok(screen.getByText(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))), title);
  assert.ok(screen.getAllByText(/Sales tax by state/).length >= 2, 'the state step and its button');
  // the return's own figures, and the planning due date from the filing calendar
  assert.ok(screen.getByText('TX 3200'));
  assert.ok(screen.getAllByText(/2026-10-20/).length >= 1, 'the planning due date is shown');
  assert.match(screen.getByText(/Texas state sales tax \$62.50/).textContent ?? '', /Texas state sales tax/);
  // every step opens the screen that does the work
  assert.ok(screen.getByRole('button', { name: 'Open Reports → Tax return' }));
  assert.ok(screen.getByRole('button', { name: 'Open Month-end close' }));
  // it says plainly that nothing is filed or posted here
  assert.match(screen.getByText((_c, el) => el?.tagName === 'P' && /nothing files, posts, pays or closes/.test(el.textContent ?? ''))?.textContent ?? '', /nothing files, posts, pays or closes/);
});

test('A-153 screen: a step that needs attention is said so, in words', () => {
  render(<UsQuarterJourneyPanel journey={journey()} currency="USD" quarterText="2026-Q3" onQuarterChange={() => {}} />);
  assert.ok(screen.getAllByText('Needs attention').length >= 1, 'a flagged step is labelled');
  assert.match(screen.getByText(/next: Sales tax by state/).textContent ?? '', /next: Sales tax by state/);
});

test('A-153 screen: a return the server recorded is shown as filed', () => {
  render(<UsQuarterJourneyPanel journey={journey({ filedPeriods: [{ startDate: '2026-07-01', endDate: '2026-09-30' }] })}
    currency="USD" quarterText="2026-Q3" onQuarterChange={() => {}} />);
  assert.ok(screen.getByText('Yes'), 'the recorded return is shown as filed');
  assert.ok(screen.queryByText('Not recorded here') === null);
});

test('A-153 screen: a quarter that is not written as one is reported, not guessed', () => {
  render(<UsQuarterJourneyPanel journey={null} currency="USD" quarterText="Q3" onQuarterChange={() => {}} />);
  assert.match(screen.getByRole('alert').textContent ?? '', /A quarter is written as 2026-Q3/);
});

test('A-153 screen: a capped list is called provisional', () => {
  render(<UsQuarterJourneyPanel journey={journey()} currency="USD" quarterText="2026-Q3" onQuarterChange={() => {}} loading partial />);
  assert.match(screen.getByRole('alert').textContent ?? '', /provisional/);
  assert.match(screen.getByRole('status').textContent ?? '', /Loading/);
});
