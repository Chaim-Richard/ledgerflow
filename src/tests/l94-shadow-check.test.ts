/**
 * L-94 step 1 (shadow): after an invoice save, the server rebuilds its entries from the database with the same
 * builder and compares them with what the browser sent (postingShadowCheck.ts). On the local test database:
 *  - INV-1 (2 × 150.00 + 10% tax = 330.00) saved with the builder's own entry → the rebuild matches;
 *  - the same save with the 300.00 of revenue moved to another income account (still balanced) → a difference,
 *    naming Sales −300.00 as missing and Other income −300.00 as extra;
 *  - an edit to 3 × 150.00 (495.00) after the first entry is in the books → the rebuild reverses the first entry
 *    and posts the new one, the same as the browser's builder did.
 */
import test, { before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { postInvoiceLedger } from '../services/ledgerPost/invoicePosting';
import type { EntityMutation, LedgerPostContext, PostableTransaction } from '../services/ledgerPost/postingCore';
import { postingFingerprint, shadowCheckDocumentPosting } from './helpers/postingShadowCheck';
import type { ChartAccount, Invoice, Transaction, Workspace } from '../types';

const url = process.env.LF_TEST_DATABASE_URL;

describe('L-94 shadow check on the test database', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_l94_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-l94';
  let db: import('../server/db/pgFirestore').Firestore;
  const accounts = [
    { id: `${ws}_ar`, name: 'Accounts Receivable', type: 'asset', category: 'Receivables', code: '1100' },
    { id: `${ws}_bank`, name: 'Bank', type: 'asset', category: 'Cash', code: '1000' },
    { id: `${ws}_sales`, name: 'Sales', type: 'income', code: '4000' },
    { id: `${ws}_other`, name: 'Other income', type: 'income', code: '4900' },
    { id: `${ws}_vat`, name: 'VAT Payable', type: 'liability', category: 'Tax', code: '2200' },
  ].map(a => ({ ...a, workspaceId: ws })) as unknown as ChartAccount[];
  const workspace = { id: ws, uid: OWNER, name: 'L-94', currency: 'USD', timezone: 'UTC', defaultAccountMappings: { ar: `${ws}_ar`, revenue: `${ws}_sales`, tax: `${ws}_vat` } } as unknown as Workspace;
  const invoice = (qty: number, id: string) => ({
    id, workspaceId: ws, number: `INV-${id.slice(-1)}`, customerName: 'Acme', customerId: 'c1', date: '2026-10-21', status: 'sent', currency: 'USD',
    amountCents: qty * 15_000 * 1.1, taxAmountCents: qty * 1_500, taxRate: 10,
    items: [{ description: 'Hours', quantity: qty, unitPriceCents: 15_000, amountCents: qty * 15_000 }],
  }) as unknown as Invoice;
  const entries = async (docId: string) => (await db.collection('transactions').where('workspaceId', '==', ws).where('metadata.invoiceId', '==', docId).get()).docs.map(d => ({ ...d.data(), id: d.id }) as Transaction);

  /** what the browser's builder would send for this save, given what is in the books now */
  const build = async (data: Invoice, mutation: EntityMutation): Promise<PostableTransaction[]> => {
    const context: LedgerPostContext = { accounts, workspaces: [workspace], transactions: await entries(data.id!), inventory: [], lockDate: null, uid: OWNER, today: '2026-10-21', capture: [] };
    await postInvoiceLedger(data.id!, data, ws, OWNER, mutation, context);
    return context.capture!.flatMap(c => c.txs).map(tx => ({ ...tx, id: tx.id || crypto.randomUUID() }));
  };
  /** the save as the bulk route commits it: the document, then the entries */
  const save = async (data: Invoice, txs: PostableTransaction[]) => {
    await db.collection('invoices').doc(data.id!).set(data as unknown as Record<string, unknown>);
    for (const tx of txs) await db.collection('transactions').doc(tx.id!).set(tx as unknown as Record<string, unknown>);
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    db = (await import('../server/db/firestore')).getDb() as unknown as typeof db;
    await db.collection('workspaces').doc(ws).set({ ...workspace, members: [OWNER], roles: { [OWNER]: 'owner' } } as unknown as Record<string, unknown>);
    for (const a of accounts) await db.collection('chartAccounts').doc(a.id).set(a as unknown as Record<string, unknown>);
  });

  test('the browser\'s own entry: the server rebuilds the same lines', async () => {
    const data = invoice(2, `${ws}_inv1`);
    const mutation: EntityMutation = { collection: 'invoices', docId: data.id!, action: 'create', data: data as unknown as Record<string, unknown> };
    const posted = await build(data, mutation);
    await save(data, posted);
    const result = await shadowCheckDocumentPosting(db as never, { workspaceId: ws, uid: OWNER, mutation, posted: posted as never });
    assert.ok(result.checked);
    assert.equal(result.matched, true);
    assert.equal(result.sent.length, 3, 'A/R, Sales and VAT');
  });

  test('revenue moved to another account (still balanced): the difference is named', async () => {
    const data = invoice(2, `${ws}_inv2`);
    const mutation: EntityMutation = { collection: 'invoices', docId: data.id!, action: 'create', data: data as unknown as Record<string, unknown> };
    const posted = (await build(data, mutation)).map(tx => ({ ...tx, lines: tx.lines.map(l => (l.accountId === `${ws}_sales` ? { ...l, accountId: `${ws}_other` } : l)) }));
    assert.equal(posted.flatMap(tx => tx.lines).reduce((s, l) => s + l.amountCents, 0), 0, 'the tampered entry still balances');
    await save(data, posted);
    const result = await shadowCheckDocumentPosting(db as never, { workspaceId: ws, uid: OWNER, mutation, posted: posted as never });
    assert.ok(result.checked && !result.matched);
    assert.deepEqual(result.expected.filter(r => !result.sent.includes(r)), [`2026-10-21|${ws}_sales|-30000|[]`]);
    assert.deepEqual(result.sent.filter(r => !result.expected.includes(r)), [`2026-10-21|${ws}_other|-30000|[]`]);
  });

  test('an edit: the rebuild reverses the first entry and posts the new one, as the browser did', async () => {
    const first = invoice(2, `${ws}_inv3`);
    const create: EntityMutation = { collection: 'invoices', docId: first.id!, action: 'create', data: first as unknown as Record<string, unknown> };
    await save(first, await build(first, create));
    const edited = invoice(3, `${ws}_inv3`);
    const update: EntityMutation = { collection: 'invoices', docId: edited.id!, action: 'update', data: edited as unknown as Record<string, unknown> };
    const posted = await build(edited, update);
    assert.ok(posted.length >= 2, 'a reversal and the new entry');
    await save(edited, posted);
    const result = await shadowCheckDocumentPosting(db as never, { workspaceId: ws, uid: OWNER, mutation: update, posted: posted as never });
    assert.ok(result.checked);
    assert.equal(result.matched, true, JSON.stringify(result));
    assert.deepEqual(postingFingerprint(posted).filter(r => r.includes('_sales|')), [`2026-10-21|${ws}_sales|-45000|[]`, `2026-10-21|${ws}_sales|30000|[]`].sort());
  });

  test('not an invoice or bill: nothing to check', async () => {
    const result = await shadowCheckDocumentPosting(db as never, { workspaceId: ws, uid: OWNER, mutation: { collection: 'projects', docId: 'p1', action: 'create' }, posted: [] });
    assert.equal(result.checked, false);
  });
});
