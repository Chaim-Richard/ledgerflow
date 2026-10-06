/**
 * Cheque printing (BE-13): the amount written out in words the way banks expect, the cheque's
 * layout (payee, date, number, the amount behind asterisks, the bills it pays on both vouchers), and
 * the PDF through the documents route: only for a payment made to a vendor, only for owners,
 * accountants and bookkeepers, never another workspace's payment. The route part runs when
 * LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import { amountInWords, numberInWords } from '../lib/amountInWords';
import { generateChequePdf, layoutCheque } from '../server/services/chequePdf';
import { pdfText } from './helpers/pdfText';

describe('The amount in words', () => {
  test('as on a cheque', () => {
    assert.equal(amountInWords(123456), 'One thousand two hundred thirty-four and 56/100');
    assert.equal(amountInWords(0), 'Zero and 00/100');
    assert.equal(amountInWords(1500), 'Fifteen and 00/100');
    assert.equal(amountInWords(2100005), 'Twenty-one thousand and 05/100');
    assert.equal(amountInWords(100000000), 'One million and 00/100');
    assert.equal(amountInWords(9999), 'Ninety-nine and 99/100');
    assert.equal(numberInWords(1001001), 'one million one thousand one');
    assert.throws(() => amountInWords(-1));
    assert.throws(() => amountInWords(1.5));
  });
});

describe('The cheque', () => {
  const payment = {
    direction: 'made', status: 'posted', amountCents: 123456, date: '2026-10-06', reference: '1042', contactName: 'Paper Supply Co', memo: 'September invoices',
    currency: 'USD', allocations: [{ documentId: 'b1', documentType: 'bill', amountCents: 100000 }, { documentId: 'b2', documentType: 'bill', amountCents: 20000 }], unappliedCents: 3456,
  };

  test('says what to pay whom, and lists what it pays', () => {
    const layout = layoutCheque(payment, { name: 'Acme Books' }, { b1: 'B-77' });
    assert.deepEqual(layout, {
      company: 'Acme Books', chequeNumber: '1042', date: '2026-10-06', payee: 'Paper Supply Co', figures: '**1,234.56',
      words: 'One thousand two hundred thirty-four and 56/100', memo: 'September invoices',
      stub: [{ label: 'Bill B-77', amount: '1,000.00' }, { label: 'Bill b2', amount: '200.00' }, { label: 'Paid in advance (not yet billed)', amount: '34.56' }],
      total: '1,234.56', unit: 'DOLLARS',
    });
    assert.equal(layoutCheque({ ...payment, currency: 'EUR' }, {}).unit, 'EUR');
  });

  test('only a payment made to a vendor, not voided, with an amount', () => {
    assert.throws(() => layoutCheque({ ...payment, direction: 'received' }, {}), /payment made to a vendor/);
    assert.throws(() => layoutCheque({ ...payment, status: 'void' }, {}), /voided/);
    assert.throws(() => layoutCheque({ ...payment, amountCents: 0 }, {}), /no amount/);
  });

  test('the PDF has the payee, the amount both ways and the vouchers', async () => {
    const text = pdfText(await generateChequePdf(layoutCheque(payment, { name: 'Acme Books' }, { b1: 'B-77' })));
    for (const expected of ['Paper Supply Co', '**1,234.56', 'One thousand two hundred thirty-four and 56/100', 'Bill B-77', 'Vendor copy', 'For your records', 'No. 1042']) {
      assert.ok(text.includes(expected), `missing "${expected}"`);
    }
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('Printing through the documents route (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_chq_${crypto.randomBytes(4).toString('hex')}`;
  const other = `${ws}_other`;
  const id = (name: string) => `${ws}_${name}`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const download = (uid: string, paymentId: string) => fetch(`${base}/api/v1/documents/cheque/${paymentId}/pdf?workspaceId=${ws}`, { headers: { 'x-test-uid': uid } });

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { documentRouter } = await import('../server/routes/documentRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Cheque Books', currency: 'USD', members: ['owner-1', 'view-1', 'book-1'], roles: { 'view-1': 'viewer', 'book-1': 'bookkeeper' } });
    await db.collection('bills').doc(id('bill')).set({ workspaceId: ws, vendorId: 'v1', vendorName: 'Paper Supply Co', number: 'B-77', amountCents: 5000, status: 'paid', date: '2026-10-01' });
    await db.collection('payments').doc(id('paid')).set({ workspaceId: ws, direction: 'made', status: 'posted', amountCents: 5000, date: '2026-10-06', reference: '1042', contactName: 'Paper Supply Co', currency: 'USD', allocations: [{ documentId: id('bill'), documentType: 'bill', amountCents: 5000 }], unappliedCents: 0 });
    await db.collection('payments').doc(id('received')).set({ workspaceId: ws, direction: 'received', status: 'posted', amountCents: 5000, date: '2026-10-06', contactName: 'Acme', allocations: [] });
    await db.collection('payments').doc(id('elsewhere')).set({ workspaceId: other, direction: 'made', status: 'posted', amountCents: 5000, date: '2026-10-06', contactName: 'X', allocations: [] });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/documents', documentRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['payments', 'bills', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = any($1) or id = any($1)`, [[ws, other]]);
    }
    await db.terminate();
  });

  test('a bookkeeper prints a vendor payment as a cheque, with the bill number on the vouchers', async () => {
    const res = await download('book-1', id('paid'));
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    const text = pdfText(Buffer.from(await res.arrayBuffer()));
    assert.ok(text.includes('Fifty and 00/100'));
    assert.ok(text.includes('Bill B-77'));
  });

  test('a viewer cannot; a money-in payment and another workspace\'s payment are refused', async () => {
    assert.equal((await download('view-1', id('paid'))).status, 403);
    const received = await download('owner-1', id('received'));
    assert.deepEqual([received.status, (await received.json()).message], [400, 'A cheque is printed for a payment made to a vendor']);
    assert.equal((await download('owner-1', id('elsewhere'))).status, 404);
  });
});
