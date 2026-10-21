/**
 * DIM-2 phase 4 (GitHub #132): Stock sources and uses — opening + what came from each source − what went to each use
 * = closing, from the stock history alone. The issue's own example, in cents:
 *
 *   receive 100 units from Supplier A: goods 200,000 + freight 20,000 = 220,000 (2,200 a unit)
 *   move 50 between locations (out 50, in 50: no units and no value change, not counted twice)
 *   30 to Property A construction   (adjusted down, reason "Property A construction")   30 × 2,200 = 66,000
 *   20 to Property B maintenance    (adjusted down, reason "Property B maintenance")    20 × 2,200 = 44,000
 *   40 sold to Acme on a line labelled Project P1                                       40 × 2,200 = 88,000
 *   closing 10 units = 22,000                     check: 0 + 100 − (30 + 20 + 40) + 0 = 10
 *
 * A second item: 10 bought from Supplier A at 500 and 10 from Supplier B at 700 (both receipts kept apart while the
 * average moves), 4 sold with no customer recorded (flagged), 6 of opening stock with no recorded origin (flagged),
 * a sale of 2 undone (it nets the customer's line).
 */
import './helpers/dom';
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { stockSourcesUses, stockSourcesUsesCsv, type FlowNames } from '../lib/stockSourcesUses';
import type { ItemDetails } from '../lib/stockMoves';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import StockSourcesUsesReportView from '../components/reporting/StockSourcesUsesReportView';

type M = ItemDetails['moves'][number];
let n = 0;
const m = (over: Partial<M>): M => ({ key: `k${++n}`, date: '2026-06-01', kind: 'adjustment', quantity: 0, quantityAfter: 0, valueCents: 0, unitCostCents: 0, ...over } as M);
const names: FlowNames = {
  vendor: id => ({ va: 'Supplier A', vb: 'Supplier B' } as Record<string, string>)[id],
  customer: id => ({ acme: 'Acme Ltd' } as Record<string, string>)[id],
  label: (dim, id) => `${dim === 'project' ? 'Project' : dim} ${id}`,
};
const tiles: ItemDetails = {
  itemId: 'tiles', itemName: 'Tiles', opening: { quantity: 0, valueCents: 0 },
  moves: [
    m({ kind: 'purchase', quantity: 100, valueCents: 220_000, documentType: 'bill', documentId: 'b1', documentLine: 0, vendorId: 'va' }),
    m({ kind: 'transfer-out', quantity: -50, valueCents: -110_000, locationId: 'L1' }),
    m({ kind: 'transfer-in', quantity: 50, valueCents: 110_000, locationId: 'L2' }),
    m({ kind: 'adjustment', quantity: -30, valueCents: -66_000, documentType: 'adjustment', purpose: 'Property A construction' }),
    m({ kind: 'adjustment', quantity: -20, valueCents: -44_000, documentType: 'adjustment', purpose: 'Property B maintenance' }),
    m({ kind: 'sale', quantity: -40, valueCents: -88_000, documentType: 'invoice', documentId: 'i1', customerId: 'acme', documentLineId: 'l1', labels: { project: 'P1' } }),
  ],
  received: 150, issued: 140, closing: { quantity: 10, valueCents: 22_000 },
};
const bolts: ItemDetails = {
  itemId: 'bolts', itemName: 'Bolts', opening: { quantity: 0, valueCents: 0 },
  moves: [
    m({ kind: 'opening', quantity: 6, valueCents: 3_000, documentType: 'import' }),
    m({ kind: 'purchase', quantity: 10, valueCents: 5_000, documentType: 'bill', documentId: 'b2', vendorId: 'va' }),
    m({ kind: 'purchase', quantity: 10, valueCents: 7_000, documentType: 'bill', documentId: 'b3', vendorId: 'vb' }),
    m({ kind: 'sale', quantity: -4, valueCents: -2_400, documentType: 'invoice', documentId: 'i2' }),
    m({ kind: 'sale', quantity: -2, valueCents: -1_200, documentType: 'invoice', documentId: 'i3', customerId: 'acme' }),
    m({ kind: 'sale-reversal', quantity: 2, valueCents: 1_200, documentType: 'invoice', documentId: 'i3', customerId: 'acme' }),
  ],
  received: 28, issued: 6, closing: { quantity: 22, valueCents: 12_600 },
};

test('the issue\'s example: 100 from Supplier A → 30 construction, 20 maintenance, 40 sold to Acme (Project P1), 10 left', () => {
  const [r] = stockSourcesUses([tiles], names);
  assert.deepEqual(r.sources.map(l => [l.label, l.quantity, l.valueCents]), [['Bought from Supplier A', 100, 220_000]]);
  assert.deepEqual(r.uses.map(l => [l.label, l.quantity, l.valueCents]), [
    ['Sold to Acme Ltd · Project P1', 40, 88_000],
    ['Adjusted down: Property A construction', 30, 66_000],
    ['Adjusted down: Property B maintenance', 20, 44_000],
  ]);
  assert.deepEqual(r.transfers, { moves: 2, net: 0 }, 'the move between locations is not counted twice');
  assert.deepEqual([r.closing.quantity, r.differenceUnits, r.unknownUnits], [10, 0, 0], '0 + 100 − 90 + 0 = 10');
  // value too: 220,000 − 88,000 − 66,000 − 44,000 = 22,000 = closing
  assert.equal(r.sources[0].valueCents - r.uses.reduce((s, l) => s + l.valueCents, 0), r.closing.valueCents);
});

test('two vendors at two prices stay apart; an undone sale nets its customer; unknowns are flagged, never guessed', () => {
  const [r] = stockSourcesUses([bolts], names);
  assert.deepEqual(r.sources.map(l => [l.label, l.quantity, l.valueCents, Boolean(l.unknown)]), [
    ['Bought from Supplier A', 10, 5_000, false], ['Bought from Supplier B', 10, 7_000, false], ['Origin not recorded (opening stock, imports)', 6, 3_000, true],
  ]);
  assert.deepEqual(r.uses.map(l => [l.label, l.quantity, Boolean(l.unknown)]), [['Sold, customer not recorded', 4, true], ['Sold to Acme Ltd', 0, false]]);
  // 0 + 26 − 4 = 22; unknown: 6 in + 4 out
  assert.deepEqual([r.differenceUnits, r.unknownUnits], [0, 10]);
});

test('a history that does not add up says so; the CSV holds every line and the check', () => {
  const broken: ItemDetails = { ...tiles, closing: { quantity: 12, valueCents: 26_400 } };
  const [r] = stockSourcesUses([broken], names);
  assert.equal(r.differenceUnits, -2);
  const csv = stockSourcesUsesCsv([r], c => (c / 100).toFixed(2));
  assert.deepEqual(csv[0], ['Item', 'Section', 'Line', 'Units', 'Value', 'Moves']);
  assert.deepEqual(csv.find(row => row[2] === 'Sold to Acme Ltd · Project P1'), ['Tiles', 'Use', 'Sold to Acme Ltd · Project P1', '40', '880.00', '1']);
  assert.deepEqual(csv[csv.length - 1], ['Tiles', 'Does not add up', '-2 units not explained by the history', '-2', '', '']);
});

afterEach(() => cleanup());

test('the report shows each item\'s sources, uses and the check', async () => {
  setComponentWorkspace('viewer');
  useLedgerStore.setState({ vendors: [{ id: 'va', name: 'Supplier A' }], customers: [{ id: 'acme', name: 'Acme Ltd' }], dimensionNodes: [{ id: 'P1', dimensionId: 'project', description: 'Harbour tower' }] } as never);
  useDataNeedsStore.setState(s => ({ loaded: { ...s.loaded, vendors: true, customers: true } }));
  globalThis.fetch = (async () => new Response(JSON.stringify({ items: [tiles] }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch;
  render(<StockSourcesUsesReportView />);
  const card = await waitFor(() => screen.getByTestId('stock-flow'));
  const rows = within(card).getAllByRole('row').map(r => r.textContent);
  assert.ok(rows.some(t => /Bought from Supplier A100\$2,200\.00/.test(t || '')), rows.join(' | '));
  assert.ok(rows.some(t => /Sold to Acme Ltd · Harbour tower40\$880\.00/.test(t || '')), rows.join(' | '));
  assert.match(card.textContent || '', /Opening \+ came from − went to = closing\./);
  assert.ok(screen.getByRole('button', { name: 'Export CSV' }));
});
