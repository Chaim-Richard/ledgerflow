/**
 * DIM-2 phase 1 on the Stock history window: each change says where the units came from or went (the party and the
 * document), names a missing link, and the summary counts the units whose origin is not recorded. Figures: 4 on hand
 * when the history began, +10 on bill B-1 from Acme, −3 on invoice INV-1 to Dune, +5 on bill B-9 (not in the books).
 */
import './helpers/dom';
import test, { afterEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import StockHistoryDialog from '../components/inventory/StockHistoryDialog';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { getSupabase } from '../lib/db/client';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import type { StockMove } from '../lib/stockMoves';
import type { InventoryItem } from '../types';

const move = (seq: number, over: Partial<StockMove>): StockMove => ({
  workspaceId: 'component-workspace', itemId: 'widget', date: `2026-06-0${seq}`, kind: 'adjustment', quantity: 0, quantityBefore: 0, quantityAfter: 0,
  unitCostCents: 500, valueCents: 0, seq: String(seq), uid: 'u', createdAt: '', ...over,
});
const tables: Record<string, unknown[]> = {
  stockMoves: [
    move(1, { kind: 'purchase', quantity: 10, quantityBefore: 4, quantityAfter: 14, valueCents: 5000, documentType: 'bill', documentId: 'B-1' }),
    move(2, { kind: 'sale', quantity: -3, quantityBefore: 14, quantityAfter: 11, valueCents: -1500, documentType: 'invoice', documentId: 'INV-1' }),
    move(3, { kind: 'purchase', quantity: 5, quantityBefore: 11, quantityAfter: 16, valueCents: 2500, documentType: 'bill', documentId: 'B-9' }),
  ],
  bills: [{ id: 'B-1', number: 'B-1', vendorId: 'acme', workspaceId: 'component-workspace', date: '2026-06-01', amountCents: 5000, status: 'approved' }],
  invoices: [{ id: 'INV-1', number: 'INV-1', customerId: 'dune', workspaceId: 'component-workspace', date: '2026-06-02', amountCents: 3000, status: 'sent' }],
  vendors: [{ id: 'acme', name: 'Acme Supplies', workspaceId: 'component-workspace' }],
  customers: [{ id: 'dune', name: 'Dune LLC', workspaceId: 'component-workspace' }],
};

describe('DIM-2: where the stock came from, on the Stock history window', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('each change names its party and document; a missing bill is named; the summary counts the origins', async () => {
    setComponentWorkspace('viewer');
    // the documents as the app holds them once loaded
    useLedgerStore.setState({ bills: tables.bills, invoices: tables.invoices, vendors: tables.vendors, customers: tables.customers, creditNotes: [], vendorCredits: [], estimates: [], transactions: [], truncatedCollections: {} } as never);
    useDataNeedsStore.setState(s => ({ loaded: { ...s.loaded, bills: true, invoices: true, creditNotes: true, vendorCredits: true, estimates: true, transactions: true, vendors: true, customers: true } }));
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const table = new URL(String(input), 'http://x').pathname.split('/').pop() || '';
      const rows = (tables[table] || []).map((data, i) => ({ id: (data as { id?: string }).id || `${table}${i}`, updated_at: '2026-06-01T00:00:00Z', data }));
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    render(<StockHistoryDialog item={{ id: 'widget', name: 'Widget', quantityAtHand: 16 } as InventoryItem} workspaceId="component-workspace" currency="USD" onClose={() => {}} />);
    await waitFor(() => assert.ok(screen.getByRole('cell', { name: /Acme Supplies · Bill B-1/ })));
    const rows = screen.getAllByRole('row').slice(1);
    assert.match(within(rows[0]).getByRole('cell', { name: /Acme/ }).textContent || '', /^Acme Supplies · Bill B-1$/);
    await waitFor(() => assert.match(rows[1].textContent || '', /Dune LLC · Invoice INV-1/));
    assert.match(rows[2].textContent || '', /The bill it names \(B-9\) is not in the books\./);
    // 10 recorded; 4 on hand before the history began; 5 on a bill that cannot be found
    assert.match(screen.getByTestId('stock-trail-summary').textContent || '', /10 came in on a document with its vendor or customer; 4 with no recorded origin .*on hand before the history began\); 5 whose document is missing\./);
  });
});
