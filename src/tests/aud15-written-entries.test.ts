/**
 * AUD-15: after a save, the screen's list holds the entries as the server wrote them, not the ones the browser sent
 * (postingKit.ts, through the real /transactions/bulk and /documents/:type/:id/post on the local test database):
 *  - a 250.00 journal sent with another person's uid and no server check comes back with the saver's uid and the
 *    server's check stamp; the list shows that one;
 *  - the live updates brought the entry in first (a stale copy with the same id) → after the answer, one entry with
 *    that id, the server's;
 *  - the same save again (same key) → the server wrote nothing the second time and the list is unchanged (one entry);
 *  - another workspace opened while the save was on its way → that workspace's list is not touched;
 *  - an invoice (2 × 50.00 = 100.00) saved through the server's own posting → the list holds the server's entry, with
 *    the id the database has.
 */
import './helpers/dom';
import test, { after, before, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { postTxsServerApi, type PostableTransaction } from '../services/ledgerPost/postingKit';
import { postInvoiceLedger } from '../services/ledgerPost/invoicePosting';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import type { ChartAccount, Invoice, Transaction, Workspace } from '../types';

const url = process.env.LF_TEST_DATABASE_URL;

describe('AUD-15: the list shows what the server wrote', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_aud15_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-aud15';
  let server: Server;
  let db: import('../server/db/pgFirestore').Firestore;
  const realFetch = globalThis.fetch;
  /** while set, every answer waits for this before it reaches the browser */
  let hold: Promise<void> | null = null;
  const accounts = [
    { id: `${ws}_ar`, name: 'Accounts Receivable', type: 'asset', category: 'Receivables', code: '1100' },
    { id: `${ws}_bank`, name: 'Checking', type: 'asset', category: 'Cash', code: '1000' },
    { id: `${ws}_sales`, name: 'Sales', type: 'income', code: '4000' },
    { id: `${ws}_rent`, name: 'Rent', type: 'expense', code: '6100' },
  ].map(a => ({ ...a, workspaceId: ws })) as unknown as ChartAccount[];
  const workspace = { id: ws, uid: OWNER, name: 'AUD-15', currency: 'USD', timezone: 'UTC', defaultAccountMappings: { ar: `${ws}_ar`, revenue: `${ws}_sales` } } as unknown as Workspace;
  const journal = (id: string): PostableTransaction => ({
    id, uid: 'someone-else', workspaceId: ws, date: '2026-10-21', description: 'October rent', totalAmountCents: 25_000, currency: 'USD', status: 'completed', type: 'actual',
    lines: [{ accountId: `${ws}_rent`, amountCents: 25_000, description: 'Rent' }, { accountId: `${ws}_bank`, amountCents: -25_000, description: 'Rent' }] as PostableTransaction['lines'],
  });
  const listed = (id: string) => (useLedgerStore.getState().transactions || []).filter(tx => tx.id === id);

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ ...workspace, members: [OWNER], roles: { [OWNER]: 'owner' } } as unknown as Record<string, unknown>);
    for (const a of accounts) await db.collection('chartAccounts').doc(a.id).set(a as unknown as Record<string, unknown>);
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'owner@aud15.test' }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    app.use('/api/v1/documents', (await import('../server/routes/documentPostRoutes')).documentPostRouter);
    server = app.listen(0);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = String(input);
      if (!target.startsWith('/')) return realFetch(input, init);
      const answer = await realFetch(`${base}${target}`, { ...init, headers: { ...(init?.headers as Record<string, string> || {}), 'x-test-uid': OWNER } });
      if (hold) await hold;
      return answer;
    }) as typeof fetch;
  });

  beforeEach(() => {
    hold = null;
    useAuthStore.setState({ currentWorkspaceId: ws });
    useLedgerStore.setState({ transactions: [] });
  });

  after(async () => {
    globalThis.fetch = realFetch;
    server?.close();
    for (const table of ['transactions', 'invoices', 'chartAccounts', 'auditLogs', 'idempotencyKeys', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    const { getSupabase } = await import('../lib/db/client');
    getSupabase().realtime.disconnect();
    await getSupabase().auth.dispose();
    await db.terminate();
  });

  test('a 250.00 journal sent with another uid: the list shows the saver\'s uid and the server\'s check, as written', async () => {
    const id = crypto.randomUUID();
    await postTxsServerApi([journal(id)], ws);
    const saved = (await db.collection('transactions').doc(id).get()).data()!;
    const [shown] = listed(id);
    assert.equal(saved.uid, OWNER);
    assert.equal(shown.uid, OWNER, 'not the uid that was sent');
    assert.equal(shown.verification?.verifiedBy, 'server-vault');
    assert.equal(shown.verification?.hash, saved.verification.hash);
    assert.deepEqual(shown.lines.map(l => l.amountCents), [25_000, -25_000]);
  });

  test('the live updates brought it in first: one entry with that id, the server\'s', async () => {
    const id = crypto.randomUUID();
    useLedgerStore.setState({ transactions: [{ ...journal(id), description: 'stale live copy' } as unknown as Transaction] });
    await postTxsServerApi([journal(id)], ws);
    assert.equal(listed(id).length, 1);
    assert.equal(listed(id)[0].description, 'October rent');
    assert.equal(listed(id)[0].uid, OWNER);
  });

  test('the same save again: nothing written the second time, the list unchanged', async () => {
    const id = crypto.randomUUID();
    const key = crypto.randomUUID();
    await postTxsServerApi([journal(id)], ws, undefined, { idempotencyKey: key });
    const before = useLedgerStore.getState().transactions.length;
    await postTxsServerApi([journal(id)], ws, undefined, { idempotencyKey: key });
    assert.equal(useLedgerStore.getState().transactions.length, before);
    assert.equal(listed(id).length, 1);
    assert.equal((await db.collection('transactions').where('workspaceId', '==', ws).where('description', '==', 'October rent').get()).docs.filter(d => d.id === id).length, 1);
  });

  test('another workspace opened while the save was on its way: its list is not touched', async () => {
    const id = crypto.randomUUID();
    let release!: () => void;
    hold = new Promise(resolve => { release = resolve; });
    const saving = postTxsServerApi([journal(id)], ws);
    await new Promise(resolve => setTimeout(resolve, 200));
    useAuthStore.setState({ currentWorkspaceId: 'ws_other' });
    useLedgerStore.setState({ transactions: [] });
    release();
    await saving;
    assert.deepEqual(useLedgerStore.getState().transactions, []);
    assert.ok((await db.collection('transactions').doc(id).get()).exists, 'saved in the workspace it was asked in');
  });

  test('an invoice of 100.00 posted by the server: the list holds the server\'s entry with the database\'s id', async () => {
    const invoiceId = `${ws}_inv1`;
    const data = {
      id: invoiceId, workspaceId: ws, number: 'INV-1', customerId: 'c1', customerName: 'Acme', date: '2026-10-21', dueDate: '2026-11-20', status: 'sent', currency: 'USD',
      amountCents: 10_000, items: [{ id: 'l1', description: 'Mugs', quantity: 2, rateCents: 5_000, amountCents: 10_000 }],
    } as unknown as Invoice;
    await postInvoiceLedger(invoiceId, data, ws, OWNER, { collection: 'invoices', docId: invoiceId, action: 'create', data: data as unknown as Record<string, unknown> },
      { accounts, workspaces: [workspace], transactions: [], inventory: [], lockDate: null, uid: OWNER, today: '2026-10-21' });
    const written = (await db.collection('transactions').where('workspaceId', '==', ws).where('metadata.invoiceId', '==', invoiceId).get()).docs.map(d => d.id);
    const shown = (useLedgerStore.getState().transactions || []).filter(tx => tx.metadata?.invoiceId === invoiceId);
    assert.deepEqual(shown.map(tx => tx.id), written);
    assert.deepEqual(shown[0].lines.map(l => [l.accountId, l.amountCents]), [[`${ws}_ar`, 10_000], [`${ws}_sales`, -10_000]]);
  });
});
