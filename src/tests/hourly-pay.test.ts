/**
 * Timesheet-driven pay (U-11): an hourly employee is paid for the approved time of their linked
 * person, up to the pay date, not paid before, at their rate; the engine is handed the period's pay
 * as a yearly salary and pays exactly that gross; the run marks the time paid (locked on Time) and
 * undoing the run frees it. Runs with LF_TEST_DATABASE_URL for the database part.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import { asPaidFor, hourlyGrossCents, hourlyProblem, hoursToPay } from '../lib/hourlyPay';
import { payRunTotals } from '../lib/payRunPosting';
import { computePeriodPayroll } from '../lib/payroll-engine';
import type { Employee } from '../types';

const hourly = (extra: Partial<Employee> = {}): Employee => ({
  id: 'h1', uid: 'u', workspaceId: 'w', name: 'Hana', role: 'Staff', salaryCents: 0, payFrequency: 'Bi-Weekly', status: 'Active', filingStatus: 'Single', state: 'TX', createdAt: '2026-01-01',
  payType: 'hourly', hourlyRateCents: 2550, timeUid: 'member-h', ...extra,
} as Employee);

describe('The rules', () => {
  test('the period\'s gross is exactly minutes × rate ÷ 60; the engine pays that gross', () => {
    assert.equal(hourlyGrossCents(hourly(), 61), 2593, '61/60 × 25.50 = 25.925 → 25.93');
    for (const minutes of [1, 61, 2400, 4799]) {
      const e = hourly();
      assert.equal(computePeriodPayroll(asPaidFor(e, minutes), 2026).grossPayCents, hourlyGrossCents(e, minutes));
      assert.equal(computePeriodPayroll(asPaidFor({ ...e, payFrequency: 'Weekly' }, minutes), 2026).grossPayCents, hourlyGrossCents(e, minutes));
    }
    assert.equal(hourlyProblem(hourly()), null);
    assert.match(String(hourlyProblem(hourly({ hourlyRateCents: 0 }))), /rate/);
    assert.match(String(hourlyProblem(hourly({ timeUid: undefined }))), /whose time/);
  });

  test('which time is paid: theirs, approved or invoiced, up to the pay date, not paid before', () => {
    const e = hourly();
    const time = [
      { id: 'a', person: 'member-h', date: '2026-10-01', minutes: 120, status: 'approved' },
      { id: 'b', person: 'member-h', date: '2026-10-02', minutes: 60, status: 'invoiced' },
      { id: 'c', person: 'member-h', date: '2026-10-03', minutes: 30, status: 'submitted' },
      { id: 'd', person: 'member-h', date: '2026-10-20', minutes: 30, status: 'approved' },
      { id: 'e', person: 'member-h', date: '2026-10-01', minutes: 30, status: 'approved', paidRunId: 'earlier' },
      { id: 'f', person: 'someone', date: '2026-10-01', minutes: 30, status: 'approved' },
    ];
    assert.deepEqual(hoursToPay([e], time, '2026-10-15').get('h1'), { minutes: 180, entryIds: ['a', 'b'] });
    const totals = payRunTotals([e, hourly({ id: 'h2', timeUid: 'idle' })], 2026, 'all', hoursToPay([e, hourly({ id: 'h2', timeUid: 'idle' })], time, '2026-10-15'));
    assert.deepEqual(totals.employees.map(l => [l.employeeId, l.grossCents, l.minutes, l.timeEntryIds]), [['h1', 7650, 180, ['a', 'b']]], 'nobody is paid for no time');
  });
});

const url = process.env.LF_TEST_DATABASE_URL;

describe('A pay run pays approved time (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_hourly_${crypto.randomBytes(4).toString('hex')}`;
  const id = (n: string) => `${ws}_${n}`;
  let db: Firestore;
  let server: Server;
  let base = '';
  const call = async (uid: string, method: string, path: string, data?: unknown) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': uid }, ...(data ? { body: JSON.stringify(data) } : {}) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Hourly Co', currency: 'USD', members: ['owner-1', 'member-h'], roles: { 'member-h': 'bookkeeper' } });
    const acc = (n: string, fields: Record<string, unknown>) => db.collection('chartAccounts').doc(id(n)).set({ workspaceId: ws, uid: 'owner-1', balanceCents: 0, isActive: true, ...fields });
    await acc('bank', { code: '1000', name: 'Checking', type: 'asset', category: 'Cash' });
    await acc('wages', { code: '6000', name: 'Wages', type: 'expense' });
    await acc('ptax', { code: '6010', name: 'Payroll tax', type: 'expense' });
    await acc('liab', { code: '2100', name: 'Payroll liabilities', type: 'liability' });
    const { id: _id, ...fields } = hourly();
    await db.collection('employees').doc(id('hana')).set({ ...fields, workspaceId: ws });
    const entry = (n: string, date: string, minutes: number, status: string) => db.collection('documents').doc(id(n)).set({ kind: 'timeEntry', workspaceId: ws, person: 'member-h', date, minutes, description: 'Work', billable: false, status, createdAt: `${date}T09:00:00Z` });
    await entry('t1', '2026-10-01', 480, 'approved');
    await entry('t2', '2026-10-02', 450, 'approved');
    await entry('t3', '2026-10-03', 60, 'submitted');
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  after(async () => {
    server?.close();
    for (const table of ['transactions', 'payRuns', 'employees', 'chartAccounts', 'documents', 'auditLogs', 'notifications', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('paid once, locked on Time, freed by undo', async () => {
    const body = { date: '2026-10-10', bankAccountId: id('bank'), wagesAccountId: id('wages'), taxExpenseAccountId: id('ptax'), liabilitiesAccountId: id('liab') };
    const run = await call('owner-1', 'POST', '/pay-runs', body);
    assert.equal(run.status, 200, JSON.stringify(run.body));
    const line = (run.body.employees as Array<{ grossCents: number; minutes: number }>)[0];
    assert.deepEqual([line.minutes, line.grossCents], [930, hourlyGrossCents(hourly(), 930)], '15:30 h at 25.50 = 395.25');
    const paid = async (n: string) => (await db.collection('documents').doc(id(n)).get()).data()?.paidRunId;
    assert.deepEqual([await paid('t1'), await paid('t2'), await paid('t3')], [run.body.payRunId, run.body.payRunId, undefined]);
    assert.equal((await call('owner-1', 'DELETE', `/time/${id('t1')}`)).status, 403, 'paid time is locked');
    const again = await call('owner-1', 'POST', '/pay-runs', { ...body, date: '2026-10-11' });
    assert.equal(again.status, 400, 'no unpaid time: nobody to pay');
    assert.equal((await call('owner-1', 'DELETE', `/pay-runs/${run.body.payRunId}`)).status, 200);
    assert.deepEqual([await paid('t1'), await paid('t2')], [null, null], 'undone: the time is free again');
  });
});
