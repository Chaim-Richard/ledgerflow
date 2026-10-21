/**
 * U-12 (AI #2 review, TOOL_REVIEW F13): the same time entry is never paid twice in one pay run. The review's own
 * case, in cents: two active hourly employees, Hana and Hugo, both at 2,500 an hour, both taking their pay from
 * member-h's time; one approved 60-minute entry.
 *   before: two lines of 60 × 2,500 ÷ 60 = 2,500 each → gross 5,000 for one hour of work
 *   now:    the pay run refuses (409) naming Hana and Hugo, and marks no time paid;
 *           once Hugo takes his pay from his own time, the run pays Hana 2,500 — gross 2,500
 *   and `hoursToPay` itself hands an entry to one employee only (2,500, not 5,000), as a second guard.
 *   A shared link does not block a run when the shared person has no time to pay, or when one of the two is not in
 *   the run (ended, or another pay schedule).
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import { hourlyGrossCents, hoursToPay, sharedTime, sharedTimeMessage, type PayableTime } from '../lib/hourlyPay';
import { payRunTotals } from '../lib/payRunPosting';
import type { Employee } from '../types';

const hourly = (extra: Partial<Employee> = {}): Employee => ({
  id: 'hana', uid: 'u', workspaceId: 'w', name: 'Hana', role: 'Staff', salaryCents: 0, payFrequency: 'Bi-Weekly', status: 'Active', filingStatus: 'Single', state: 'TX', createdAt: '2026-01-01',
  payType: 'hourly', hourlyRateCents: 2_500, timeUid: 'member-h', ...extra,
} as Employee);
const hana = hourly();
const hugo = hourly({ id: 'hugo', name: 'Hugo' });
const hour: PayableTime[] = [{ id: 't1', person: 'member-h', date: '2026-10-01', minutes: 60, status: 'approved' }];

describe('The rule', () => {
  test('one approved hour is handed to one employee only: gross 2,500, not 5,000', () => {
    const hours = hoursToPay([hana, hugo], hour, '2026-10-10');
    assert.deepEqual([hours.get('hana'), hours.get('hugo')], [{ minutes: 60, entryIds: ['t1'] }, { minutes: 0, entryIds: [] }]);
    assert.equal(hourlyGrossCents(hana, 60), 2_500);
    const totals = payRunTotals([hana, hugo], 2026, 'all', hours);
    assert.deepEqual(totals.employees.map(e => [e.employeeId ?? (e as { id?: string }).id, e.grossCents]), [['hana', 2_500]]);
  });

  test('the shared link is named when there is time to pay; harmless when there is none or one is not in the run', () => {
    assert.deepEqual(sharedTime([hana, hugo], hour, '2026-10-10').map(g => [g.person, g.employees.map(e => e.name)]), [['member-h', ['Hana', 'Hugo']]]);
    assert.match(sharedTimeMessage(sharedTime([hana, hugo], hour, '2026-10-10')), /^Hana and Hugo are paid from the same person's time, so it would be paid twice/);
    assert.deepEqual(sharedTime([hana, hugo], [], '2026-10-10'), [], 'no time to pay');
    assert.deepEqual(sharedTime([hana, hugo], [{ ...hour[0], paidRunId: 'r0' }], '2026-10-10'), [], 'already paid by an earlier run');
    assert.deepEqual(sharedTime([hana, { ...hugo, status: 'Terminated' } as Employee], hour, '2026-10-10'), [], 'Hugo has left');
    assert.deepEqual(sharedTime([hana, { ...hugo, payFrequency: 'Monthly' }], hour, '2026-10-10', 'Bi-Weekly'), [], 'Hugo is on another schedule');
    assert.equal(sharedTime([hana, hugo], [{ ...hour[0], date: '2026-10-11' }], '2026-10-10').length, 0, 'the hour is after the pay date');
  });
});

const url = process.env.LF_TEST_DATABASE_URL;

describe('A pay run refuses shared time (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_u12_${crypto.randomBytes(4).toString('hex')}`;
  const id = (n: string) => `${ws}_${n}`;
  let db: Firestore;
  let server: Server;
  let base = '';
  const call = async (method: string, path: string, data?: unknown) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': 'owner-1' }, ...(data ? { body: JSON.stringify(data) } : {}) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };
  const body = () => ({ date: '2026-10-10', bankAccountId: id('bank'), wagesAccountId: id('wages'), taxExpenseAccountId: id('ptax'), liabilitiesAccountId: id('liab') });

  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Shared Time Co', currency: 'USD', members: ['owner-1', 'member-h', 'member-u'], roles: { 'member-h': 'bookkeeper', 'member-u': 'bookkeeper' } });
    const acc = (n: string, fields: Record<string, unknown>) => db.collection('chartAccounts').doc(id(n)).set({ workspaceId: ws, uid: 'owner-1', balanceCents: 0, isActive: true, ...fields });
    await acc('bank', { code: '1000', name: 'Checking', type: 'asset', category: 'Cash' });
    await acc('wages', { code: '6000', name: 'Wages', type: 'expense' });
    await acc('ptax', { code: '6010', name: 'Payroll tax', type: 'expense' });
    await acc('liab', { code: '2100', name: 'Payroll liabilities', type: 'liability' });
    for (const e of [hana, hugo]) {
      const { id: eid, ...fields } = e;
      await db.collection('employees').doc(id(eid)).set({ ...fields, workspaceId: ws });
    }
    await db.collection('documents').doc(id('t1')).set({ kind: 'timeEntry', workspaceId: ws, person: 'member-h', date: '2026-10-01', minutes: 60, description: 'Work', billable: false, status: 'approved', createdAt: '2026-10-01T09:00:00Z' });
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
    for (const table of ['transactions', 'payRuns', 'employees', 'chartAccounts', 'documents', 'auditLogs', 'notifications', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]).catch(() => {});
    await db.terminate();
  });

  test('Hana and Hugo on the same time: refused, nothing paid; Hugo on his own time: Hana is paid 2,500 once', async () => {
    const refused = await call('POST', '/pay-runs', body());
    assert.equal(refused.status, 409, JSON.stringify(refused.body));
    assert.match(String(refused.body.message || refused.body.error), /Hana and Hugo are paid from the same person's time/);
    assert.equal((await db.collection('documents').doc(id('t1')).get()).data()?.paidRunId, undefined, 'no time marked paid');
    assert.equal((await db.collection('payRuns').where('workspaceId', '==', ws).get()).docs.length, 0, 'no pay run kept');

    await db.collection('employees').doc(id('hugo')).update({ timeUid: 'member-u' });
    const run = await call('POST', '/pay-runs', body());
    assert.equal(run.status, 200, JSON.stringify(run.body));
    const lines = run.body.employees as Array<{ name?: string; grossCents: number; minutes: number }>;
    assert.deepEqual(lines.map(l => [l.minutes, l.grossCents]), [[60, 2_500]], 'one line: 60 × 2,500 ÷ 60');
    assert.equal(run.body.grossCents ?? lines.reduce((s, l) => s + l.grossCents, 0), 2_500);
  });
});
