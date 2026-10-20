/**
 * CON-2: the US economic-nexus watch from posted invoices, on a screen. Worked by hand (cents), as of 2026-10-20:
 *
 *   Texas ($500,000 sales, revenue only): 2026 invoices $300,000 + $120,000 = $420,000, credit note −$20,000
 *     → $400,000 = 40,000,000 cents, 2 sales → 80% exactly: flagged, not crossed. 2025: $100,000, 1 sale → 20%.
 *   New York ($500,000 AND 100 sales): 2025, 120 sales of $5,000 = $600,000 = 60,000,000 cents → both met: crossed.
 *     2026: 99 sales of $6,000 = $594,000 → sales met, count 99 < 100 → not crossed; 120% of the sales line → flagged.
 *   Illinois ($100,000 or 200 sales): 2026 one invoice of €25,000 at 1.08 → $27,000 = 2,700,000 cents → 27%,
 *     shown "not verified".
 *   Draft invoices, a German customer and dates outside 2025–2026 count nowhere; a customer with no tax place is
 *   counted as "unplaced".
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { usNexusWatch, US_NEXUS_SUPPORTED_STATES, type NexusSaleDocument } from '../lib/tax/usNexusWatch';
import type { TaxProfiles } from '../lib/tax/profile';
import { UsNexusWatchPanel } from '../components/reporting/UsNexusWatchReportView';

const customers = [
  { id: 'tx', metadata: { taxPlace: { country: 'US', state: 'TX', city: 'Austin' } } },
  { id: 'ny', metadata: { taxPlace: { country: 'US', state: 'NY' } } },
  { id: 'il', metadata: { taxPlace: { country: 'US', state: 'IL' } } },
  { id: 'de', metadata: { taxPlace: { country: 'DE' } } },
  { id: 'none' },
];
// net = amount − tax; the tax amounts are the state's own, so the net is the round figure in the comment
const inv = (id: string, customerId: string, date: string, netCents: number, extra: Partial<NexusSaleDocument> = {}): NexusSaleDocument =>
  ({ id, customerId, date, status: 'sent', taxVersion: 2, amountCents: netCents + Math.round(netCents * 0.0625), taxAmountCents: Math.round(netCents * 0.0625), ...extra });
// New York's sales are made by the New York entity (label world:ny), which holds the NY permit (#241 review: an
// entity's permit covers its own sales only)
const ny2025 = Array.from({ length: 120 }, (_, i) => inv(`ny25-${i}`, 'ny', '2025-06-01', 500_000, { dimensions: { world: 'ny' } }));
const ny2026 = Array.from({ length: 99 }, (_, i) => inv(`ny26-${i}`, 'ny', '2026-03-01', 600_000, { dimensions: { world: 'ny' } }));
const invoices = [
  inv('tx1', 'tx', '2026-02-10', 30_000_000), inv('tx2', 'tx', '2026-09-30', 12_000_000), inv('tx25', 'tx', '2025-11-01', 10_000_000),
  ...ny2025, ...ny2026,
  inv('il1', 'il', '2026-05-05', 2_500_000, { exchangeRate: 1.08 }),
  inv('draft', 'tx', '2026-05-05', 99_000_000, { status: 'draft' }),
  inv('de1', 'de', '2026-05-05', 99_000_000),
  inv('old', 'tx', '2024-12-31', 99_000_000),
  inv('future', 'tx', '2026-10-21', 99_000_000),
  inv('nowhere', 'none', '2026-01-02', 1_000_000),
];
const creditNotes = [inv('cn1', 'tx', '2026-10-01', 2_000_000, { status: 'issued' })];
const profiles: TaxProfiles = {
  books: { place: { country: 'US', state: 'TX' }, registrations: [{ kind: 'sales_tax', number: '320001', place: { country: 'US', state: 'TX' } }] },
  labels: { 'world:ny': { registrations: [{ kind: 'sales_tax', number: 'NY-1', place: { country: 'US', state: 'NY' }, validFrom: '2026-01-01' }] } },
};
const watch = usNexusWatch({ asOf: '2026-10-20', invoices, creditNotes, customers, profiles, order: ['world'] });
const state = (code: string) => watch.states.find(s => s.state === code)!;

test('CON-2 worked figures: Texas at exactly 80% is flagged, not crossed; a credit note lowers sales, not the count', () => {
  const tx = state('TX');
  assert.deepEqual([tx.thisYear!.salesCents, tx.thisYear!.orders, tx.thisYear!.ratio, tx.thisYear!.crossed, tx.thisYear!.warning], [40_000_000, 2, 0.8, false, true]);
  assert.deepEqual([tx.lastYear!.salesCents, tx.lastYear!.orders, tx.lastYear!.ratio], [10_000_000, 1, 0.2]);
  assert.deepEqual([tx.thisYear!.startDate, tx.thisYear!.endDate, tx.lastYear!.startDate, tx.lastYear!.endDate], ['2026-01-01', '2026-10-20', '2025-01-01', '2025-12-31']);
  assert.deepEqual([tx.crossed, tx.warning, tx.verified, tx.permit], [false, true, true, true]);
});

test('CON-2 worked figures: New York needs both tests — crossed in 2025, not in 2026 with 99 sales', () => {
  const ny = state('NY');
  assert.deepEqual([ny.lastYear!.salesCents, ny.lastYear!.orders, ny.lastYear!.crossed], [60_000_000, 120, true]);
  assert.deepEqual([ny.thisYear!.salesCents, ny.thisYear!.orders, ny.thisYear!.crossed, ny.thisYear!.warning], [59_400_000, 99, false, true]);
  assert.deepEqual([ny.crossed, ny.permit], [true, true], 'the permit on the New York entity label counts');
});

test('CON-2 worked figures: Illinois in euros at 1.08 → $27,000, 27%, not verified; nothing else leaks in', () => {
  const il = state('IL');
  assert.deepEqual([il.thisYear!.salesCents, il.thisYear!.ratio, il.warning, il.verified, il.permit], [2_700_000, 0.27, false, false, false]);
  assert.deepEqual(watch.states.map(s => s.state), ['NY', 'TX', 'IL'], 'crossed first, then flagged, then the rest');
  assert.equal(watch.unplacedDocuments, 1, 'the customer with no tax place; the German customer is abroad, not unplaced');
  assert.deepEqual([...US_NEXUS_SUPPORTED_STATES], ['TX', 'CA', 'NY', 'WA', 'CO']);
});

describe('CON-2 on the screen', () => {
  afterEach(() => cleanup());

  test('the table names each state\'s status, figures, threshold, permit and whether its table is checked', () => {
    const changed: string[] = [];
    render(<UsNexusWatchPanel watch={watch} currency="USD" asOf="2026-10-20" onAsOfChange={v => { changed.push(v); }} />);
    assert.match(screen.getByRole('status').textContent || '', /3 state\(s\) with sales; 2 at 80% of a threshold or over: NY, TX\. 1 posted sale\(s\) have a customer with no tax place recorded/);
    const table = screen.getByRole('table', { name: 'Sales by state against the economic-nexus thresholds' });
    const rows = within(table).getAllByRole('row').slice(1).map(row => row.textContent || '');
    assert.match(rows[0], /^nyNew YorkThreshold crossed: ask about registering.*\$594,000\.00, 99 sale\(s\) \(119%\).*\$600,000\.00, 120 sale\(s\) \(120%\).*\$500,000\.00 and 100 sales.*Recorded.*Checked$/);
    assert.match(rows[1], /^The booksTexasAt 80% or over: watch.*\$400,000\.00, 2 sale\(s\) \(80%\).*\$500,000\.00.*Recorded.*Checked$/);
    assert.match(rows[2], /^The booksIllinoisBelow 80%.*\$27,000\.00, 1 sale\(s\) \(27%\).*None recorded.*Not verified$/);
    assert.match(screen.getByRole('region', { name: 'US nexus watch' }).textContent || '', /a watch, not a conclusion that you must register/);
    fireEvent.change(screen.getByLabelText('As of'), { target: { value: '2025-12-31' } });
    assert.deepEqual(changed, ['2025-12-31']);
  });

  test('no sales: said plainly', () => {
    render(<UsNexusWatchPanel watch={usNexusWatch({ asOf: '2026-10-20', invoices: [], customers: [] })} asOf="2026-10-20" onAsOfChange={() => {}} />);
    assert.match(screen.getByRole('status').textContent || '', /No posted sale to a customer with a US tax place in these two years\./);
    assert.equal(screen.queryByRole('table'), null);
  });
});

// ---- review fixes (#241) ----
test('CON-2 review: books kept in another currency are refused, never compared with US-dollar thresholds', () => {
  const eur = usNexusWatch({ asOf: '2026-10-20', invoices, creditNotes, customers, profiles, currency: 'EUR' });
  assert.deepEqual(eur.states, []);
  assert.match(eur.problem || '', /thresholds are in US dollars and these books are kept in EUR/);
  render(<UsNexusWatchPanel watch={eur} asOf="2026-10-20" onAsOfChange={() => {}} />);
  assert.match(screen.getByRole('alert').textContent || '', /Nothing is converted at a guessed rate/);
  assert.equal(screen.queryByRole('table'), null);
  cleanup();
});

test('CON-2 review: a sale counts where it went — its own tax place or ship-to — before the customer\'s place', () => {
  const docs = [
    inv('ship', 'tx', '2026-04-01', 1_000_000, { shippingAddress: { state: 'CA' } }),             // customer in Texas, shipped to California
    inv('own', 'tx', '2026-04-02', 2_000_000, { metadata: { taxPlace: { country: 'US', state: 'WA' } } }), // the invoice's own place
    inv('plain', 'tx', '2026-04-03', 3_000_000),                                                       // no place of its own: the customer's
  ];
  const w = usNexusWatch({ asOf: '2026-10-20', invoices: docs, customers });
  assert.deepEqual(w.states.map(s => [s.state, s.thisYear!.salesCents]).sort(), [['CA', 1_000_000], ['TX', 3_000_000], ['WA', 2_000_000]]);
});

test('CON-2 review: each selling entity is watched on its own — two $300,000 Texas entities are 60% each, not $600,000', () => {
  const two: TaxProfiles = {
    books: { name: 'Parent Inc', place: { country: 'US', state: 'TX' }, registrations: [{ kind: 'sales_tax', number: '320001', place: { country: 'US', state: 'TX' } }] },
    // Sub LLC lists its own registrations (Oklahoma only), so it does not file under the parent's Texas permit
    labels: { 'world:sub': { name: 'Sub LLC', place: { country: 'US', state: 'TX' }, registrations: [{ kind: 'sales_tax', number: 'OK-1', place: { country: 'US', state: 'OK' } }] } },
  };
  const docs = [inv('p', 'tx', '2026-05-01', 30_000_000), inv('s', 'tx', '2026-05-02', 30_000_000, { dimensions: { world: 'sub' } })];
  const w = usNexusWatch({ asOf: '2026-10-20', invoices: docs, customers, profiles: two, order: ['world'] });
  assert.deepEqual(w.states.map(s => [s.entityName, s.state, s.thisYear!.salesCents, s.thisYear!.ratio, s.crossed, s.permit]).sort(),
    [['Parent Inc', 'TX', 30_000_000, 0.6, false, true], ['Sub LLC', 'TX', 30_000_000, 0.6, false, false]]);
});

test('CON-2 review: a state with no economic-nexus test says so, never "Below 80%"', () => {
  const w = usNexusWatch({ asOf: '2026-10-20', invoices: [inv('or', 'or', '2026-05-01', 5_000_000)], customers: [{ id: 'or', metadata: { taxPlace: { country: 'US', state: 'OR' } } }] });
  assert.deepEqual([w.states[0].state, w.states[0].noTest, w.states[0].warning], ['OR', true, false]);
  render(<UsNexusWatchPanel watch={w} asOf="2026-10-20" onAsOfChange={() => {}} />);
  const row = within(screen.getByRole('table')).getAllByRole('row')[1].textContent || '';
  assert.match(row, /No economic-nexus test in this state/);
  assert.doesNotMatch(row, /Below 80%/);
  cleanup();
});

describe('CON-2 review on the screen', () => {
  afterEach(() => cleanup());
  test('the Reports period\'s date starts the watch, and a capped customer list marks the figures provisional', async () => {
    const { useLedgerStore } = await import('../stores/useLedgerStore');
    const { useAuthStore } = await import('../stores/useAuthStore');
    const { useDataNeedsStore } = await import('../stores/useDataNeedsStore');
    useAuthStore.setState({ currentWorkspaceId: 'w' } as never);
    useLedgerStore.setState({ invoices: [], creditNotes: [], customers: [], truncatedCollections: { customers: true } } as never);
    useDataNeedsStore.setState({ loaded: { invoices: true, creditNotes: true, customers: true }, loadedWorkspaceId: 'w', failed: {} } as never);
    const { default: UsNexusWatchReportView } = await import('../components/reporting/UsNexusWatchReportView');
    render(<UsNexusWatchReportView asOfDate="2025-12-31" />);
    assert.equal((screen.getByLabelText('As of') as HTMLInputElement).value, '2025-12-31');
    assert.match(screen.getByRole('alert').textContent || '', /capped or failed, so the figures below are provisional/);
  });
});
