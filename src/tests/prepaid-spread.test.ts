/**
 * Prepaid expenses spread over months (K-17): the bill's amount moves to Prepaid on the bill's date
 * and back to the expense one share per month end (whole cents, the remainder last), all in one
 * database transaction; a bill is spread once; undo voids the schedule unless a month is closed.
 * The database part runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import { addMonths, monthEnd, prepaidAccount, splitEvenly, spreadPlan, spreadProblem } from '../lib/prepaidSchedule';
import { makeChartAccount } from './fixtures';

describe('The spread plan', () => {
  test('months and month ends without time zones, leap years included', () => {
    assert.deepEqual([addMonths('2026-09', 0), addMonths('2026-09', 4), addMonths('2026-12', 1), addMonths('2026-01', 23)], ['2026-09', '2027-01', '2027-01', '2027-12']);
    assert.deepEqual(['2026-02', '2028-02', '2100-02', '2000-02', '2026-04', '2026-12'].map(monthEnd), ['2026-02-28', '2028-02-29', '2100-02-28', '2000-02-29', '2026-04-30', '2026-12-31']);
  });

  test('whole-cent shares that add up, the remainder in the last month', () => {
    const shares = splitEvenly(120011, 12);
    assert.deepEqual([shares[0], shares[10], shares[11]], [10000, 10000, 10011]);
    assert.equal(shares.reduce((a, b) => a + b, 0), 120011);
  });

  test('one share at each month end from the first month', () => {
    const plan = spreadPlan({ date: '2026-09-15', amountCents: 30000, months: 3, startMonth: '2026-12' });
    assert.deepEqual(plan, [
      { date: '2026-12-31', amountCents: 10000, installment: 1 },
      { date: '2027-01-31', amountCents: 10000, installment: 2 },
      { date: '2027-02-28', amountCents: 10000, installment: 3 },
    ]);
  });

  test('what is refused, and why', () => {
    const ok = { date: '2026-09-15', amountCents: 1200, months: 12, startMonth: '2026-09' };
    assert.equal(spreadProblem(ok, 1200), null);
    assert.equal(spreadProblem({ ...ok, amountCents: 1201 }, 1200), 'That is more than the bill');
    assert.equal(spreadProblem({ ...ok, amountCents: 0 }), 'Enter the amount to spread');
    assert.equal(spreadProblem({ ...ok, months: 1 }), 'Spread over 2 to 60 months');
    assert.equal(spreadProblem({ ...ok, months: 61 }), 'Spread over 2 to 60 months');
    assert.equal(spreadProblem({ ...ok, startMonth: '2026-08' }), 'The first month cannot be before the bill');
    assert.equal(spreadProblem({ ...ok, startMonth: '2026-13' }), 'Choose the first month');
    assert.equal(spreadProblem({ ...ok, date: '' }), 'The bill has no valid date');
  });

  test('the Prepaid Expenses account: the mapping, else a "prepaid" asset — not Vendor Prepayments', () => {
    const accounts = [
      makeChartAccount({ id: 'vp', name: 'Vendor Prepayments', type: 'asset', category: 'Current Assets' }),
      makeChartAccount({ id: 'pe', name: 'Prepaid Expenses', type: 'asset', category: 'Current Assets' }),
      makeChartAccount({ id: 'ins', name: 'Prepaid insurance (liability by mistake)', type: 'liability', category: 'Current Liabilities' }),
    ];
    assert.equal(prepaidAccount(accounts)?.id, 'pe');
    assert.equal(prepaidAccount(accounts, { 'prepaid expenses': 'vp' })?.id, 'vp', 'the Settings mapping wins');
    assert.equal(prepaidAccount(accounts, { 'prepaid expenses': 'ins' })?.id, 'pe', 'a mapped account that is not an asset is ignored');
    assert.equal(prepaidAccount(accounts.slice(0, 1)), undefined);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('Spreading a bill (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_pre_${crypto.randomBytes(4).toString('hex')}`;
  const bare = `${ws}_bare`;
  const id = (name: string) => `${ws}_${name}`;
  let server: Server;
  let base = '';
  let db: Firestore;
  const call = async (uid: string, path: string, body: Record<string, unknown> = {}, workspace = ws) => {
    const res = await fetch(`${base}/api/v1/workspaces/${workspace}/bills${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const data = async (coll: string, docId: string) => (await db.collection(coll).doc(docId).get()).data() || {};
  const entriesOf = async (scheduleId: string) => (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs
    .map(d => d.data()).filter(t => t.metadata?.prepaidScheduleId === scheduleId).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const balance = (entries: Record<string, unknown>[], accountId: string) => entries.filter(e => e.status !== 'void')
    .flatMap(e => e.lines as { accountId: string; amountCents: number }[]).filter(l => l.accountId === accountId).reduce((s, l) => s + l.amountCents, 0);

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { prepaidRouter } = await import('../server/routes/prepaidRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    for (const w of [ws, bare]) {
      await db.collection('workspaces').doc(w).set({ uid: 'owner-1', name: 'Pre', currency: 'USD', members: ['owner-1', 'view-1', 'book-1'], roles: { 'view-1': 'viewer', 'book-1': 'bookkeeper' } });
      const account = (name: string, fields: Record<string, unknown>) => db.collection('chartAccounts').doc(`${w}_${name}`).set({ workspaceId: w, ...fields });
      await account('ins', { name: 'Insurance', type: 'expense', category: 'Operating Expenses', code: '6100' });
      await account('ap', { name: 'Accounts Payable', type: 'liability', category: 'Payables', code: '2000' });
      if (w === ws) await account('pre', { name: 'Prepaid Expenses', type: 'asset', category: 'Current Assets', code: '1300' });
      await db.collection('bills').doc(`${w}_bill`).set({ workspaceId: w, vendorId: 'v1', vendorName: 'Shield Insurance', number: 'B-7', amountCents: 120011, status: 'open', date: '2026-09-15', dueDate: '2026-10-15' });
      await db.collection('bills').doc(`${w}_draft`).set({ workspaceId: w, vendorId: 'v1', number: 'B-8', amountCents: 5000, status: 'draft', date: '2026-09-15' });
    }
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces/:workspaceId/bills', prepaidRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'bills', 'chartAccounts', 'auditLogs', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = any($1) or id = any($1)`, [[ws, bare]]);
    }
    await db.terminate();
  });

  const spread = { expenseAccountId: id('ins'), amountCents: 120011, months: 12 };
  let scheduleId = '';

  test('a viewer cannot; a draft bill, a non-expense account, or a chart without Prepaid is refused', async () => {
    assert.equal((await call('view-1', `/${id('bill')}/spread`, spread)).status, 403);
    assert.equal((await call('owner-1', `/${id('draft')}/spread`, spread)).status, 409);
    const wrong = await call('owner-1', `/${id('bill')}/spread`, { ...spread, expenseAccountId: id('ap') });
    assert.deepEqual([wrong.status, wrong.body.message], [400, 'Choose the expense account to spread']);
    const none = await call('owner-1', `/${bare}_bill/spread`, { ...spread, expenseAccountId: `${bare}_ins` }, bare);
    assert.equal(none.status, 400);
    assert.match(String(none.body.message), /Prepaid Expenses/);
    assert.equal((await call('owner-1', `/${id('bill')}/spread`, { ...spread, amountCents: 120012 })).status, 400, 'more than the bill');
  });

  test('a bookkeeper spreads it: to Prepaid on the bill date, back one share each month end, nothing left at the end', async () => {
    const res = await call('book-1', `/${id('bill')}/spread`, spread);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const bill = await data('bills', id('bill'));
    scheduleId = String(bill.prepaidSchedule?.id);
    assert.deepEqual([bill.prepaidSchedule.months, bill.prepaidSchedule.startMonth, bill.prepaidSchedule.prepaidAccountId, bill.prepaidSchedule.transactionIds.length], [12, '2026-09', id('pre'), 13]);
    const entries = await entriesOf(scheduleId);
    assert.equal(entries.length, 13);
    assert.deepEqual([entries[0].date, entries[0].metadata.type], ['2026-09-15', 'prepaid-spread']);
    assert.deepEqual(entries[0].lines.map((l: { accountId: string; amountCents: number }) => [l.accountId, l.amountCents]), [[id('pre'), 120011], [id('ins'), -120011]]);
    assert.deepEqual(entries.slice(1).map(e => e.date), ['2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31', '2027-06-30', '2027-07-31', '2027-08-31']);
    assert.deepEqual([entries[1].metadata.scheduled, entries[1].metadata.installment, entries[12].metadata.installment], [true, 1, 12]);
    assert.deepEqual([...new Set(entries.map(e => [e.metadata.spreadOfBillId, e.metadata.billId].join('|')))], [`${id('bill')}|`], 'not tagged billId: re-posting the bill must not reverse them');
    assert.deepEqual([entries[1].lines[0].amountCents, entries[12].lines[0].amountCents], [10000, 10011], 'the remainder in the last month');
    assert.equal(balance(entries, id('pre')), 0, 'Prepaid is empty after the last month');
    assert.equal(balance(entries.slice(0, 2), id('ins')), -110011, 'September carries one month of it');
  });

  test('a bill is spread once', async () => {
    assert.equal((await call('owner-1', `/${id('bill')}/spread`, spread)).status, 409);
  });

  test('undo is refused once a month of it is closed; then it voids the schedule and the bill can be spread again', async () => {
    await db.collection('workspaces').doc(ws).update({ lockDate: '2026-09-30' });
    assert.equal((await call('owner-1', `/${id('bill')}/spread/undo`)).status, 409);
    await db.collection('workspaces').doc(ws).update({ lockDate: null });
    const res = await call('owner-1', `/${id('bill')}/spread/undo`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const entries = await entriesOf(scheduleId);
    assert.deepEqual([...new Set(entries.map(e => e.status))], ['void']);
    assert.equal((await data('bills', id('bill'))).prepaidSchedule, undefined);
    assert.equal((await call('owner-1', `/${id('bill')}/spread/undo`)).status, 409, 'nothing to undo twice');
  });

  test('a closed month refuses the spread; a later first month is accepted', async () => {
    await db.collection('workspaces').doc(ws).update({ lockDate: '2026-09-30' });
    assert.equal((await call('owner-1', `/${id('bill')}/spread`, spread)).status, 409, 'the bill date itself is closed');
    await db.collection('workspaces').doc(ws).update({ lockDate: null });
    const res = await call('owner-1', `/${id('bill')}/spread`, { ...spread, amountCents: 60000, months: 6, startMonth: '2026-10' });
    assert.equal(res.status, 200);
    const entries = await entriesOf(String((await data('bills', id('bill'))).prepaidSchedule.id));
    assert.deepEqual([entries[1].date, entries[6].date], ['2026-10-31', '2027-03-31']);
  });
});
