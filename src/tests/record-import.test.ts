/**
 * Bulk import of customers, vendors, items and accounts (K-01): the CSV reader (src/lib/csv.ts),
 * the shared rules (src/lib/recordImport.ts) and the server import/undo
 * (src/server/services/recordImportService.ts via POST /api/v1/workspaces/:id/import-records).
 * The database part runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { parseCsv } from '../lib/csv';
import { applyMapping, guessMapping, parseAccountType, parseMoneyCents, prepareImport } from '../lib/recordImport';
import { resolveAccountRole } from '../lib/accountUtils';
import { makeChartAccount } from './fixtures';
import type { DocumentData, Firestore } from '../server/db/pgFirestore';

describe('Reading CSV files', () => {
  test('quoted cells keep commas, quotes and line breaks; blank lines and the BOM are dropped', () => {
    const text = '﻿Name,Address,Notes\r\n"Acme, Inc.","1 Main St\nSpringfield","He said ""hi"""\r\n\r\nBeta,,\r\n';
    assert.deepEqual(parseCsv(text), [
      ['Name', 'Address', 'Notes'],
      ['Acme, Inc.', '1 Main St\nSpringfield', 'He said "hi"'],
      ['Beta', '', ''],
    ]);
  });

  test('semicolon and tab files are read with their own delimiter', () => {
    assert.deepEqual(parseCsv('Name;Price\nWidget;"1.234,50"'), [['Name', 'Price'], ['Widget', '1.234,50']]);
    assert.deepEqual(parseCsv('Name\tPrice\nWidget\t12'), [['Name', 'Price'], ['Widget', '12']]);
  });
});

describe('Import values', () => {
  test('amounts in the usual formats become integer cents', () => {
    const cases: Array<[string, number | null]> = [
      ['1,234.50', 123450], ['$12', 1200], ['(5.00)', -500], ['-7.25', -725], ['1.234,50', 123450],
      ['12,5', 1250], ['1,250', 125000], ['0.125', 13], ['0.124', 12], ['€ 99.99', 9999], ['1.234.567', 123456700],
      ['abc', null], ['1.2.3', null], ['', null],
    ];
    for (const [text, cents] of cases) assert.equal(parseMoneyCents(text), cents, text);
  });

  test('account types from other products map to a type and a category the app recognises', () => {
    const role = (text: string) => resolveAccountRole(makeChartAccount({ name: 'X', ...parseAccountType(text) } as never));
    assert.equal(role('Bank'), 'cash');
    assert.equal(role('Accounts receivable (A/R)'), 'ar');
    assert.equal(role('Accounts payable (A/P)'), 'ap');
    assert.equal(role('Other Current Liability'), 'liability');
    assert.equal(role('Cost of Goods Sold'), 'cogs');
    assert.equal(role('Inventory'), 'inventory');
    assert.equal(role('Income'), 'revenue');
    assert.equal(role('Other Expense'), 'expense');
    assert.equal(role('Equity'), 'equity');
    assert.equal(parseAccountType('Sales tax payable')?.category, undefined, 'a tax liability is not accounts payable');
    assert.equal(parseAccountType('magic'), null);
  });
});

describe('Preparing an import', () => {
  test('columns are found by their header names, whatever the order or spelling', () => {
    const header = ['Phone Number', 'E-mail', 'Customer Name', 'Unused'];
    const mapping = guessMapping('customers', header);
    assert.equal(mapping.name, 2);
    assert.equal(mapping.email, 1);
    assert.equal(mapping.phone, 0);
    assert.equal(mapping.notes, -1);
    assert.deepEqual(applyMapping('customers', [['555', 'A@X.TEST', 'Acme', 'z']], mapping), [{ phone: '555', email: 'A@X.TEST', name: 'Acme' }]);
  });

  test('every problem is listed with its spreadsheet row; good rows are typed and get defaults', () => {
    const { records, errors } = prepareImport('customers', [
      { name: 'Acme', email: 'A@X.TEST' },
      { name: '', email: 'b@x.test' },
      { name: 'Beta', email: 'not-an-email', status: 'maybe' },
      { name: ' acme ' },
    ]);
    assert.deepEqual(records.map(r => [r.row, r.data]), [[2, { status: 'active', name: 'Acme', email: 'a@x.test' }]]);
    assert.deepEqual(errors.map(e => [e.row, e.field ?? '', e.message]), [
      [3, 'name', 'Name is missing'],
      [4, 'email', 'Email: "not-an-email" is not an email address'],
      [4, 'status', 'Status: "maybe" should be active or inactive'],
      [5, '', 'Same name as row 2'],
    ]);
  });

  test('items: prices in cents, whole quantities; accounts: the type sets the category unless a column gives one', () => {
    const items = prepareImport('items', [{ name: 'Widget', sku: 'W-1', unitPriceCents: '12.50', unitCostCents: '4', quantityAtHand: '3' }, { name: 'Half', quantityAtHand: '1.5' }]);
    assert.deepEqual(items.records[0].data, { sku: 'W-1', unitPriceCents: 1250, unitCostCents: 400, quantityAtHand: 3, reorderPoint: 0, name: 'Widget' });
    assert.equal(items.errors[0].message, 'Quantity on hand: "1.5" is not a whole number');

    const accounts = prepareImport('accounts', [
      { name: 'Checking', code: '1000', type: 'Bank' },
      { name: 'Savings', code: '1010', type: 'Bank', category: 'Current Assets' },
      { name: 'Other', code: '1000', type: 'Asset' },
    ]);
    assert.deepEqual(accounts.records[0].data, { name: 'Checking', code: '1000', type: 'asset', category: 'Cash', subtype: 'bank' });
    assert.equal(accounts.records[1].data.category, 'Current Assets');
    assert.equal(accounts.errors[0].message, 'Same name or code as row 2');
  });
});

const url = process.env.LF_TEST_DATABASE_URL;

describe('Importing records', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_imp_${crypto.randomBytes(4).toString('hex')}`;
  const id = (name: string) => `${ws}_${name}`;
  let server: Server;
  let base = '';
  let db: Firestore;

  const call = async (uid: string, path: string, body: Record<string, unknown> = {}) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const records = async (collection: string): Promise<DocumentData[]> => (await db.collection(collection).where('workspaceId', '==', ws).get()).docs.map(d => ({ ...d.data(), id: d.id }));
  const ledger = async () => (await records('transactions')) as Array<{ metadata?: { type?: string }; lines: Array<{ accountId: string; amountCents: number }> }>;

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Imports', currency: 'USD', members: ['owner-1', 'book-1', 'view-1'], roles: { 'book-1': 'bookkeeper', 'view-1': 'viewer' } });
    await db.collection('chartAccounts').doc(id('inv')).set({ workspaceId: ws, name: 'Inventory', type: 'asset', category: 'Inventory', code: '1300' });
    await db.collection('chartAccounts').doc(id('obe')).set({ workspaceId: ws, name: 'Opening Balance Equity', type: 'equity', category: 'Equity', code: '3200' });
    await db.collection('customers').doc(id('acme')).set({ workspaceId: ws, name: 'Acme' });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['customers', 'inventory', 'chartAccounts', 'transactions', 'invoices', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.terminate();
  });

  test('viewers cannot import; bookkeepers cannot import accounts', async () => {
    assert.equal((await call('view-1', '/import-records', { kind: 'customers', rows: [{ name: 'X' }] })).status, 403);
    assert.equal((await call('book-1', '/import-records', { kind: 'accounts', rows: [{ name: 'X', type: 'asset' }] })).status, 403);
  });

  test('one bad row: nothing is saved and every problem comes back with its row', async () => {
    const res = await call('book-1', '/import-records', { kind: 'customers', rows: [{ name: 'Good' }, { name: 'Bad', email: 'x' }] });
    assert.equal(res.status, 400);
    assert.deepEqual((res.body.details as Array<{ row: number }>).map(e => e.row), [3]);
    assert.equal((await records('customers')).length, 1);
  });

  test('a check run saves nothing; the import skips existing records and marks the rest', async () => {
    const rows = [{ name: 'Beta Ltd', email: 'ap@beta.test' }, { name: 'ACME' }, { name: 'Gamma' }];
    const check = await call('book-1', '/import-records', { kind: 'customers', rows, dryRun: true });
    assert.equal(check.status, 200, JSON.stringify(check.body));
    assert.equal(check.body.created, 2);
    assert.equal((await records('customers')).length, 1);

    const res = await call('book-1', '/import-records', { kind: 'customers', rows });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.created, 2);
    assert.deepEqual(res.body.skipped, [{ row: 3, message: 'ACME already exists' }]);
    const imported = (await records('customers')).filter(c => c.importBatchId === res.body.batchId);
    assert.deepEqual(imported.map(c => c.name).sort(), ['Beta Ltd', 'Gamma']);
    const log = (await records('auditLogs')).find(l => l.action === 'records_imported');
    assert.equal(log?.entityId, res.body.batchId);

    // Undo keeps a customer that is already used on an invoice.
    const beta = imported.find(c => c.name === 'Beta Ltd')!;
    await db.collection('invoices').doc(id('i1')).set({ workspaceId: ws, customerId: beta.id, amountCents: 100, status: 'draft' });
    const undo = await call('book-1', `/import-records/${res.body.batchId}/undo`);
    assert.equal(undo.status, 200, JSON.stringify(undo.body));
    assert.equal(undo.body.removed, 1);
    assert.deepEqual(undo.body.kept, ['Beta Ltd']);
    assert.deepEqual((await records('customers')).map(c => c.name).sort(), ['Acme', 'Beta Ltd']);
  });

  test('items with stock get one opening entry (DR Inventory, CR Opening Balance Equity); undo takes it back out', async () => {
    const rows = [
      { name: 'Widget', sku: 'W-1', unitPriceCents: '10', unitCostCents: '4.00', quantityAtHand: '3' },
      { name: 'Gadget', sku: 'G-1', unitCostCents: '2.50', quantityAtHand: '2' },
      { name: 'Service', sku: 'S-1', unitPriceCents: '50' },
    ];
    assert.equal((await call('book-1', '/import-records', { kind: 'items', rows })).status, 400, 'the opening date is required');
    await db.collection('workspaces').doc(ws).update({ lockDate: '2026-03-31' });
    assert.equal((await call('book-1', '/import-records', { kind: 'items', rows, openingDate: '2026-01-01' })).status, 409, 'locked period');
    assert.equal((await records('inventory')).length, 0);

    const res = await call('book-1', '/import-records', { kind: 'items', rows, openingDate: '2026-04-01' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.openingStockCents, 3 * 400 + 2 * 250);
    const [opening] = await ledger();
    assert.deepEqual(opening.lines.map(l => [l.accountId, l.amountCents]), [[id('inv'), 1700], [id('obe'), -1700]]);
    const items = await records('inventory');
    assert.equal(items.find(i => i.sku === 'W-1')?.quantityAtHand, 3);

    // Widget is on an invoice line, so it stays; the other two go, with Gadget's 500 reversed.
    const widget = items.find(i => i.sku === 'W-1')!;
    await db.collection('invoices').doc(id('i2')).set({ workspaceId: ws, customerId: 'x', status: 'draft', lines: [{ id: 'l1', itemId: widget.id, quantity: 1, amountCents: 1000 }] });
    const undo = await call('book-1', `/import-records/${res.body.batchId}/undo`);
    assert.equal(undo.status, 200, JSON.stringify(undo.body));
    assert.equal(undo.body.removed, 2);
    assert.deepEqual(undo.body.kept, ['Widget']);
    const reversal = (await ledger()).find(t => t.metadata?.type === 'opening-stock-import-undo');
    assert.deepEqual(reversal?.lines.map(l => [l.accountId, l.amountCents]), [[id('inv'), -500], [id('obe'), 500]]);
    assert.deepEqual((await records('inventory')).map(i => i.sku), ['W-1']);
  });

  test('accounts: the owner imports a chart of accounts; unknown import ids are refused', async () => {
    const res = await call('owner-1', '/import-records', { kind: 'accounts', rows: [{ name: 'Checking', code: '1000', type: 'Bank' }, { name: 'Inventory', type: 'Inventory' }] });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.created, 1, 'Inventory already exists');
    const checking = (await records('chartAccounts')).find(a => a.name === 'Checking');
    assert.equal(resolveAccountRole(checking as never), 'cash');
    assert.equal((await call('book-1', `/import-records/${res.body.batchId}/undo`)).status, 403);
    assert.equal((await call('owner-1', '/import-records/imp_0000000000000000/undo')).status, 404);
    assert.equal((await call('owner-1', '/import-records/nope/undo')).status, 400);
  });
});
