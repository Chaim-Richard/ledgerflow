/**
 * Sales reps and commission (P-13): the rules for the reps; commission on what a rep's customers
 * paid against invoices in the period, before tax, at the payment's rate; owners and accountants
 * keep the reps through the server; Settings → Sales reps and the Sales commission report.
 */
import './helpers/dom';
import test, { after, afterEach, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import React from 'react';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { commissionLines, repForCustomer, salesRepsProblem, type SalesRep } from '../lib/salesReps';
import SalesRepsSettings from '../components/platform/settings/SalesRepsSettings';
import CommissionReportView from '../components/reporting/CommissionReportView';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { getSupabase } from '../lib/db/client';
import { stubFetch, stubFetchWithBodies } from './helpers/dom';
import { setComponentWorkspace } from './helpers/componentFixtures';
import { makeCustomer, makeInvoice, makePayment } from './fixtures';

const dana: SalesRep = { id: 'sr_aaaaaaaa', name: 'Dana', commissionPercent: 5, customerIds: ['c1'] };
const omer: SalesRep = { id: 'sr_bbbbbbbb', name: 'Omer', commissionPercent: 2.5, customerIds: ['c2'] };
// 1,170.00 with 170.00 tax; 500.00 with no tax; one for a customer with no rep
const inv1 = makeInvoice({ id: 'i1', number: 'INV-1', customerId: 'c1', customerName: 'Acme Ltd', amountCents: 117000, taxAmountCents: 17000 });
const inv2 = makeInvoice({ id: 'i2', number: 'INV-2', customerId: 'c2', customerName: 'Bolt Inc', amountCents: 50000, taxAmountCents: 0 });
const inv3 = makeInvoice({ id: 'i3', number: 'INV-3', customerId: 'c3', customerName: 'Walk-in', amountCents: 10000, taxAmountCents: 0 });
const paid = (id: string, date: string, allocations: Array<[string, number]>, extra: Record<string, unknown> = {}) =>
  makePayment({ id, date, direction: 'received', allocations: allocations.map(([documentId, amountCents]) => ({ documentId, documentType: 'invoice', amountCents })) as never, ...extra });

describe('The reps and their commission', () => {
  test('what the reps need', () => {
    assert.equal(salesRepsProblem([dana, omer]), null);
    assert.match(String(salesRepsProblem({})), /a list/);
    assert.match(String(salesRepsProblem([{ ...dana, name: 'D' }])), /2 to 80/);
    assert.match(String(salesRepsProblem([dana, { ...omer, name: ' dana ' }])), /twice/);
    assert.match(String(salesRepsProblem([{ ...dana, commissionPercent: 0 }])), /above 0/);
    assert.match(String(salesRepsProblem([{ ...dana, commissionPercent: 101 }])), /at most 100/);
    assert.match(String(salesRepsProblem([{ ...dana, commissionPercent: 1.234 }])), /two decimals/);
    assert.match(String(salesRepsProblem([{ ...dana, commissionPercent: NaN }])), /percentage/);
    assert.match(String(salesRepsProblem([dana, { ...omer, customerIds: ['c1'] }])), /both "Dana" and "Omer"/);
    assert.match(String(salesRepsProblem([{ ...dana, id: 'nope' }])), /id is not/);
    assert.equal(repForCustomer([dana, omer], 'c2')?.name, 'Omer');
    assert.equal(repForCustomer([dana, omer], 'c3'), undefined);
  });

  test('commission on what was paid in the period, before tax, at the payment\'s rate; void payments, other periods and customers with no rep leave nothing', () => {
    const payments = [
      paid('p1', '2026-10-03', [['i1', 58500], ['i3', 10000]]), // half of INV-1, all of INV-3
      paid('p2', '2026-10-05', [['i2', 10000]], { exchangeRate: 1.5 }), // 100.00 in another currency = 150.00
      paid('p3', '2026-09-30', [['i1', 58500]]), // before the period
      paid('p4', '2026-10-06', [['i1', 58500]], { status: 'void' }),
    ];
    const lines = commissionLines([dana, omer], [inv1, inv2, inv3], payments, '2026-10-01', '2026-10-31');
    assert.deepEqual(lines.map(l => [l.repId, l.invoiceNumber, l.paidCents, l.netCents, l.commissionCents]), [
      ['sr_aaaaaaaa', 'INV-1', 58500, 50000, 2500], // 585.00 less its 85.00 tax = 500.00, 5% = 25.00
      ['sr_bbbbbbbb', 'INV-2', 15000, 15000, 375], // 2.5% of 150.00
    ]);
    assert.deepEqual(commissionLines([], [inv1], payments, '2026-10-01', '2026-10-31'), []);
  });
});

describe('Against the database', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_reps_${crypto.randomBytes(4).toString('hex')}`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;
  const put = async (uid: string, reps: unknown) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}/sales-reps`, { method: 'PUT', headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify({ reps }) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  before(async () => {
    process.env.DATABASE_URL = process.env.LF_TEST_DATABASE_URL;
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Reps', members: ['owner-1', 'acct-1', 'book-1'], roles: { 'acct-1': 'accountant', 'book-1': 'bookkeeper' } });
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: 'x@example.test' }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => {
    server?.close();
    for (const table of ['auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('owners and accountants keep the reps; new ones get ids, known ids stay; a bookkeeper and a bad rep are refused', async () => {
    const { id: _id, ...fresh } = dana;
    assert.equal((await put('book-1', [fresh])).status, 403);
    assert.equal((await put('owner-1', [{ ...fresh, commissionPercent: 150 }])).status, 400);
    const saved = await put('owner-1', [fresh]);
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const id = (saved.body.reps as SalesRep[])[0].id;
    assert.match(id, /^sr_[0-9a-f]{12}$/);
    assert.equal((await put('acct-1', [{ ...fresh, id, name: 'Dana Levi', commissionPercent: 6 }])).status, 200);
    const reps = (await db.collection('workspaces').doc(ws).get()).data()?.salesReps as SalesRep[];
    assert.deepEqual(reps, [{ id, name: 'Dana Levi', commissionPercent: 6, customerIds: ['c1'] }]);
    const audit = await db.pool.query(`select count(*)::int as n from public."auditLogs" where workspace_id = $1 and data->>'action' = 'SALES_REPS_SET'`, [ws]);
    assert.equal(audit.rows[0].n, 2);
  });
});

describe('On screen', () => {
  afterEach(async () => { cleanup(); getSupabase().realtime.disconnect(); await getSupabase().auth.dispose(); });

  test('Settings → Sales reps: an owner adds a rep for a customer; the problem is said until the commission is right', async () => {
    const ws = setComponentWorkspace('owner');
    useAuthStore.setState({ workspaces: [{ ...ws, currency: 'USD', salesReps: [omer] }] });
    useLedgerStore.setState({ customers: [makeCustomer({ id: 'c1', name: 'Acme Ltd' }), makeCustomer({ id: 'c2', name: 'Bolt Inc' })] });
    const calls = stubFetchWithBodies(200, { status: 'success', reps: [omer, dana] });
    render(<SalesRepsSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'New sales rep' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Dana' } });
    assert.match(screen.getByRole('status').textContent || '', /percentage/);
    fireEvent.change(screen.getByLabelText('Commission, %'), { target: { value: '5' } });
    assert.ok(screen.getByText(/now/), 'a customer another rep has says so');
    fireEvent.click(screen.getByRole('checkbox', { name: /Bolt Inc/ }));
    assert.match(screen.getByRole('status').textContent || '', /both "Omer" and "Dana"/);
    fireEvent.click(screen.getByRole('checkbox', { name: /Bolt Inc/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Acme Ltd' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save sales rep' })); });
    const sent = calls.find(c => c.url === `/api/v1/workspaces/${ws.id}/sales-reps`)!;
    assert.deepEqual(sent.body, { reps: [omer, { name: 'Dana', commissionPercent: 5, customerIds: ['c1'] }] });
    await waitFor(() => assert.ok(screen.getByText(/for Acme Ltd/)));
  });

  test('Sales commission: each rep\'s payments and total for the period', async () => {
    stubFetch(404);
    const ws = setComponentWorkspace('owner');
    useAuthStore.setState({ workspaces: [{ ...ws, currency: 'USD', salesReps: [dana, omer] }] });
    useLedgerStore.setState({ invoices: [inv1, inv2, inv3], payments: [paid('p1', '2026-10-03', [['i1', 58500]])] });
    render(<CommissionReportView />);
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-31' } });
    const captions = () => [...document.querySelectorAll('caption')].map(c => c.textContent);
    await waitFor(() => assert.deepEqual(captions(), ['Dana (5%): $25.00', 'Omer (2.5%): $0.00']));
    assert.ok(screen.getByText('Nothing paid by their customers in this period.'));
    assert.ok(screen.getByRole('rowheader', { name: 'INV-1' }));
  });
});
