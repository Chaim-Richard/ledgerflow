/**
 * EG-14: opening open items from a CSV (number, contact, date, due date, currency, amount, amount still open), as of
 * the cut-over date — the workspace's opening-balance date. Each row an open invoice (bill) on its own date, for its
 * open amount, against Opening Balance Equity; preview writes nothing; confirm saves all or nothing.
 *
 * Figures by hand (cut-over 2026-09-30, USD):
 *   INV-101 Acme  2026-08-14  1,250.00 of 1,250.00 open → A/R +1,250.00
 *   INV-102 Acme  2026-09-02    300.00 of   800.00 open → A/R   +300.00   (500.00 already paid in the old system)
 *   INV-7   Beta  2026-09-30     99.99 of    99.99 open → A/R    +99.99   (no due date: due on its date; on the cut-over is allowed)
 *   receivables  1,250.00 + 300.00 + 99.99 = 1,649.99 → A/R +164,999 cents, Opening Balance Equity −164,999
 *   B-77 Paper Co 2026-08-20    210.00 of   310.00 open → A/P −21,000 cents, Opening Balance Equity +21,000
 *   Opening Balance Equity nets to −164,999 + 21,000 = −143,999 (a credit of 1,439.99); Sales and Supplies 0.
 * Refused, each on its row: the same number twice for a contact; a date after 2026-09-30; 500.00 open of 400.00;
 * EUR in a USD workspace; an unknown contact; and the whole file again (already in the books). The database part runs
 * when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { readOpenItemsCsv } from '../lib/openItemImport';
import type { Transaction } from '../types';

const HEAD = 'Number,Contact,Date,Due Date,Currency,Amount,Amount Still Open';
const INVOICES = [HEAD,
  'INV-101,Acme Ltd,2026-08-14,2026-09-13,USD,"1,250.00","1,250.00"',
  'INV-102,Acme Ltd,2026-09-02,2026-10-02,USD,800.00,300.00',
  'INV-7,Beta Co,2026-09-30,,USD,99.99,99.99',
].join('\n');
const BILLS = [HEAD, 'B-77,Paper Co,2026-08-20,2026-09-19,USD,310.00,210.00'].join('\n');

describe('Reading the file', () => {
  const contacts = [{ id: 'c1', name: 'Acme Ltd' }, { id: 'c2', name: 'Beta Co' }];
  const opts = { cutOverDate: '2026-09-30', currency: 'USD', contacts };

  test('columns by name, the open amount carried, the due date optional', () => {
    const read = readOpenItemsCsv(INVOICES, opts);
    assert.equal(read.fileProblem, null);
    assert.deepEqual(read.rows.map(r => [r.line, r.number, r.contactId, r.date, r.dueDate, r.amountCents, r.openCents, r.problem]), [
      [2, 'INV-101', 'c1', '2026-08-14', '2026-09-13', 125_000, 125_000, null],
      [3, 'INV-102', 'c1', '2026-09-02', '2026-10-02', 80_000, 30_000, null],
      [4, 'INV-7', 'c2', '2026-09-30', '2026-09-30', 9_999, 9_999, null],
    ]);
    assert.equal(read.openTotalCents, 164_999);
  });

  test('each refusal named on its row', () => {
    const read = readOpenItemsCsv([HEAD,
      'A-1,Acme Ltd,2026-08-01,,USD,100.00,100.00',
      'a-1,acme ltd,2026-08-02,,USD,100.00,100.00',
      'A-2,Acme Ltd,2026-10-01,,USD,100.00,100.00',
      'A-3,Acme Ltd,2026-08-01,,USD,400.00,500.00',
      'A-4,Acme Ltd,2026-08-01,,EUR,100.00,100.00',
      'A-5,Nobody,2026-08-01,,USD,100.00,100.00',
      'A-6,Beta Co,2026-08-01,,USD,100.00,100.00',
    ].join('\n'), { ...opts, existing: [{ number: 'A-6', contactId: 'c2' }] });
    assert.deepEqual(read.rows.map(r => r.problem), [
      null,
      'The same number appears twice for this contact',
      'Dated after the cut-over date (2026-09-30): enter it as a normal invoice or bill',
      'The amount still open is more than the amount',
      'In EUR, not USD: nothing is converted, so enter it by hand',
      '"Nobody" is not in your contacts: add it first',
      'Already in the books for this contact',
    ]);
    assert.equal(read.openTotalCents, 10_000);
  });

  test('a file without the columns is refused as a whole', () => {
    assert.match(readOpenItemsCsv('Number,Contact,Date\nA,B,2026-01-01', opts).fileProblem || '', /Columns missing: dueDate, currency, open, amount/);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;

describe('EG-14 on the database', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_eg14_${crypto.randomBytes(4).toString('hex')}`;
  const OWNER = 'owner-eg14';
  const BOOKKEEPER = 'bk-eg14';
  let db: import('../server/db/pgFirestore').Firestore;
  let importOpenItems: typeof import('../server/services/openItemImportService').importOpenItems;
  const owner = { uid: OWNER };
  const accounts = [
    { id: `${ws}_ar`, name: 'Accounts Receivable', type: 'asset', category: 'Receivables', code: '1100' },
    { id: `${ws}_bank`, name: 'Bank', type: 'asset', category: 'Cash', code: '1000' },
    { id: `${ws}_ap`, name: 'Accounts Payable', type: 'liability', category: 'Payables', code: '2000' },
    { id: `${ws}_obe`, name: 'Opening Balance Equity', type: 'equity', category: 'Equity', code: '3900' },
    { id: `${ws}_sales`, name: 'Sales', type: 'income', category: 'Revenue', code: '4000' },
    { id: `${ws}_supplies`, name: 'Office Supplies', type: 'expense', category: 'Expenses', code: '6000' },
  ];
  const balance = async (account: string) => (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs
    .map(d => d.data() as Transaction).filter(tx => tx.status !== 'void')
    .flatMap(tx => tx.lines).filter(l => l.accountId === `${ws}_${account}`).reduce((s, l) => s + l.amountCents, 0);
  const count = async (collection: string) => (await db.collection(collection).where('workspaceId', '==', ws).get()).docs.length;

  before(async () => {
    process.env.DATABASE_URL = url;
    db = (await import('../server/db/firestore')).getDb() as unknown as typeof db;
    ({ importOpenItems } = await import('../server/services/openItemImportService'));
    await db.collection('workspaces').doc(ws).set({
      id: ws, uid: OWNER, name: 'EG-14', currency: 'USD', timezone: 'UTC', openingBalanceDate: '2026-09-30', setupCompletedAt: '2026-10-01',
      members: [OWNER, BOOKKEEPER], roles: { [OWNER]: 'owner', [BOOKKEEPER]: 'bookkeeper' },
      defaultAccountMappings: { ar: `${ws}_ar`, ap: `${ws}_ap`, revenue: `${ws}_sales` },
    });
    for (const a of accounts) await db.collection('chartAccounts').doc(a.id).set({ ...a, workspaceId: ws });
    await db.collection('customers').doc(`${ws}_c1`).set({ workspaceId: ws, name: 'Acme Ltd', status: 'active' });
    await db.collection('customers').doc(`${ws}_c2`).set({ workspaceId: ws, name: 'Beta Co', status: 'active' });
    await db.collection('vendors').doc(`${ws}_v1`).set({ workspaceId: ws, name: 'Paper Co', status: 'active' });
  });

  after(async () => {
    for (const table of ['transactions', 'invoices', 'bills', 'customers', 'vendors', 'chartAccounts', 'idempotencyKeys', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
    }
    await db.terminate();
  });

  test('preview: every row read against the books, nothing written', async () => {
    const result = await importOpenItems(db as never, owner, { workspaceId: ws, side: 'customer', csv: INVOICES, mode: 'preview' });
    assert.deepEqual([result.cutOverDate, result.openTotalCents, result.rows.map(r => r.problem), result.created], ['2026-09-30', 164_999, [null, null, null], []]);
    assert.deepEqual([await count('invoices'), await count('transactions')], [0, 0]);
  });

  test('a file with one bad row: nothing imported, the row named', async () => {
    const csv = `${INVOICES}\nINV-200,Acme Ltd,2026-10-05,,USD,10.00,10.00`;
    await assert.rejects(importOpenItems(db as never, owner, { workspaceId: ws, side: 'customer', csv, mode: 'confirm' }),
      (err: Error & { status: number; rows: Array<{ problem: string | null }> }) => err.status === 400 && /1 row has a problem/.test(err.message) && /after the cut-over/.test(String(err.rows[3].problem)));
    assert.deepEqual([await count('invoices'), await count('transactions')], [0, 0]);
  });

  test('a bookkeeper cannot import', async () => {
    await assert.rejects(importOpenItems(db as never, { uid: BOOKKEEPER }, { workspaceId: ws, side: 'customer', csv: INVOICES, mode: 'preview' }), (err: Error & { status: number }) => err.status === 403);
  });

  test('confirm: A/R +1,649.99 and A/P −210.00 against Opening Balance Equity, no revenue or expense', async () => {
    const inv = await importOpenItems(db as never, owner, { workspaceId: ws, side: 'customer', csv: INVOICES, mode: 'confirm' });
    const bill = await importOpenItems(db as never, owner, { workspaceId: ws, side: 'vendor', csv: BILLS, mode: 'confirm' });
    assert.deepEqual([inv.created.length, bill.created.length], [3, 1]);
    assert.equal(await balance('ar'), 164_999);
    assert.equal(await balance('ap'), -21_000);
    assert.equal(await balance('obe'), -143_999);
    assert.deepEqual([await balance('sales'), await balance('supplies')], [0, 0]);
    const docs = (await db.collection('invoices').where('workspaceId', '==', ws).get()).docs.map(d => d.data())
      .sort((a, b) => String(a.number).localeCompare(String(b.number)));
    assert.deepEqual(docs.map(d => [d.number, d.date, d.dueDate, d.amountCents, d.status, d.metadata?.type, d.metadata?.originalAmountCents]), [
      ['INV-101', '2026-08-14', '2026-09-13', 125_000, 'sent', 'opening-balance', 125_000],
      ['INV-102', '2026-09-02', '2026-10-02', 30_000, 'sent', 'opening-balance', 80_000],
      ['INV-7', '2026-09-30', '2026-09-30', 9_999, 'sent', 'opening-balance', 9_999],
    ]);
    const entries = (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs.map(d => d.data() as Transaction);
    assert.deepEqual(entries.map(tx => tx.date).sort(), ['2026-08-14', '2026-08-20', '2026-09-02', '2026-09-30'], 'each on its own date');
  });

  test('the same file again: every row already in the books, nothing written twice', async () => {
    await assert.rejects(importOpenItems(db as never, owner, { workspaceId: ws, side: 'customer', csv: INVOICES, mode: 'confirm' }),
      (err: Error & { rows: Array<{ problem: string | null }> }) => err.rows.every(r => r.problem === 'Already in the books for this contact'));
    assert.equal(await count('invoices'), 3);
    assert.equal(await balance('ar'), 164_999);
  });
});
