/**
 * L-94 step 0: the entry builders run without the browser. With no posting host registered (this file never
 * imports postingKit.ts) and everything in the context, an invoice's entry is built and collected in
 * `context.capture` instead of being sent; and nothing the builders import reaches the Firebase client, the screen
 * stores, toasts or React, so the server can run the same builders (docs/design/L-94-server-postings.md).
 *
 * Figures by hand: INV-1 to Acme, 2 × 150.00 + 10% tax = 330.00 → A/R +330.00, Sales −300.00, VAT −30.00.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { postInvoiceLedger } from '../services/ledgerPost/invoicePosting';
import { postTxsServerApi, postingToday, type LedgerPostContext } from '../services/ledgerPost/postingCore';
import type { ChartAccount, Invoice, Workspace } from '../types';

const accounts = [
  { id: 'ar', name: 'Accounts Receivable', type: 'asset', category: 'Receivables', code: '1100' },
  { id: 'bank', name: 'Bank', type: 'asset', category: 'Cash', code: '1000' },
  { id: 'sales', name: 'Sales', type: 'income', code: '4000' },
  { id: 'vat', name: 'VAT Payable', type: 'liability', category: 'Tax', code: '2200' },
] as unknown as ChartAccount[];
const workspace = { id: 'ws', name: 'Books', currency: 'USD', defaultAccountMappings: { ar: 'ar', revenue: 'sales', tax: 'vat' } } as unknown as Workspace;

test('L-94: an invoice entry is built and captured with no browser host', async () => {
  const context: LedgerPostContext = { accounts, workspaces: [workspace], transactions: [], inventory: [], lockDate: null, uid: 'u1', today: '2026-10-21', capture: [] };
  const invoice = {
    number: 'INV-1', customerName: 'Acme', customerId: 'c1', date: '2026-10-21', status: 'sent', currency: 'USD',
    amountCents: 33_000, taxAmountCents: 3_000, taxRate: 10,
    items: [{ description: 'Hours', quantity: 2, unitPriceCents: 15_000, amountCents: 30_000 }],
  } as unknown as Partial<Invoice>;
  await postInvoiceLedger('inv1', invoice, 'ws', 'u1', { collection: 'invoices', docId: 'inv1', action: 'create', data: invoice as Record<string, unknown> }, context);
  assert.equal(context.capture!.length, 1, 'one request collected, nothing sent');
  const [{ txs, entityMutation }] = context.capture!;
  assert.equal(entityMutation?.docId, 'inv1');
  const lines = txs.flatMap(tx => tx.lines);
  assert.equal(lines.reduce((s, l) => s + l.amountCents, 0), 0, 'the entry balances');
  const by = (id: string) => lines.filter(l => l.accountId === id).reduce((s, l) => s + l.amountCents, 0);
  assert.deepEqual([by('ar'), by('sales'), by('vat')], [33_000, -30_000, -3_000]);
});

test('L-94: without a host and without capture, sending fails loudly (never silently dropped)', async () => {
  await assert.rejects(postTxsServerApi([{ uid: 'u', workspaceId: 'ws', date: '2026-10-21', description: 'x', totalAmountCents: 0, lines: [] }], 'ws'), /no posting host/);
  assert.equal(postingToday({ today: '2026-01-31' }), '2026-01-31');
  assert.match(postingToday(), /^\d{4}-\d{2}-\d{2}$/);
});

test('L-94 guard: nothing the entry builders import reaches browser-only code', () => {
  const browserOnly = /firebase|\/stores\/|^sonner$|^react(-dom)?(\/|$)/;
  const seen = new Set<string>();
  const offenders: string[] = [];
  const resolve = (from: string, spec: string) => {
    const base = path.normalize(path.join(path.dirname(from), spec));
    return ['', '.ts', '.tsx', '/index.ts'].map(ext => base + ext).find(p => fs.existsSync(p) && fs.statSync(p).isFile());
  };
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = fs.readFileSync(file, 'utf8');
    const specs = [
      ...src.matchAll(/^\s*import\s+(?!type\b)[^'"]*?from\s+['"]([^'"]+)['"]/gm),
      ...src.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm),
      ...src.matchAll(/^export \{[^}]*\} from ['"]([^'"]+)['"]/gm),
    ].map(m => m[1]);
    for (const spec of specs) {
      if (browserOnly.test(spec)) { offenders.push(`${file} imports ${spec}`); continue; }
      if (spec.startsWith('.')) { const next = resolve(file, spec); if (next) walk(next); }
    }
  };
  for (const builder of ['invoicePosting', 'billPosting', 'creditPosting', 'paymentPosting', 'deletePostings']) walk(`src/services/ledgerPost/${builder}.ts`);
  assert.deepEqual(offenders, []);
  assert.ok(seen.size > 5, 'the walk followed the imports');
});

test('L-94 guard: every builder passes its context when it sends (or the server rebuild would post for real)', () => {
  const missing: string[] = [];
  for (const builder of ['invoicePosting', 'billPosting', 'creditPosting', 'paymentPosting', 'deletePostings']) {
    const file = `src/services/ledgerPost/${builder}.ts`;
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (/postTxsServerApi\(/.test(line) && !/,\s*context\s*\)/.test(line)) missing.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(missing, []);
});
