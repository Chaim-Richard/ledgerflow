/**
 * A checklist per client (BD-10): the workspace's own month-end steps are checked (2 to 120
 * characters, no name twice, how often, at most 30), due every month, at fiscal quarter ends or at
 * the fiscal year end, and each one due needs a sign-off before the month is ready to close. Owners
 * and accountants save the list through the server (new steps get ids, kept ones keep theirs);
 * bookkeepers sign steps off but do not change them; a step from elsewhere is refused. The database
 * part runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';
import { closeStepItems, closeStepsProblem, stepDue, type CloseStep } from '../lib/closeSteps';
import { readyToClose } from '../lib/closeChecklist';

describe('Close step rules', () => {
  test('a list is refused with the reason: short or doubled names, no frequency, too many, bad ids', () => {
    assert.equal(closeStepsProblem([{ title: 'Get the payroll report', frequency: 'monthly' }]), null);
    assert.match(String(closeStepsProblem([{ title: 'x', frequency: 'monthly' }])), /2 to 120/);
    assert.match(String(closeStepsProblem([{ title: 'File VAT', frequency: 'monthly' }, { title: ' file vat ', frequency: 'yearly' }])), /twice/);
    assert.match(String(closeStepsProblem([{ title: 'File VAT', frequency: 'weekly' }])), /how often/);
    assert.match(String(closeStepsProblem(Array.from({ length: 31 }, (_, i) => ({ title: `Step ${i}`, frequency: 'monthly' })))), /At most 30/);
    assert.match(String(closeStepsProblem([{ id: 'nope', title: 'File VAT', frequency: 'monthly' }])), /bad id/);
    assert.match(String(closeStepsProblem([{ id: 'cs_abcdef', title: 'A1', frequency: 'monthly' }, { id: 'cs_abcdef', title: 'B1', frequency: 'monthly' }])), /bad id/);
    assert.match(String(closeStepsProblem('steps')), /list/);
  });

  test('due every month, at the fiscal quarter ends, or at the fiscal year end', () => {
    const months = (frequency: CloseStep['frequency'], start = 1) =>
      Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`).filter(m => stepDue({ frequency }, m, start)).map(m => m.slice(5));
    assert.equal(months('monthly').length, 12);
    assert.deepEqual(months('quarterly'), ['03', '06', '09', '12']);
    assert.deepEqual(months('yearly'), ['12']);
    // a fiscal year starting in April: quarters end in June, September, December and March
    assert.deepEqual(months('quarterly', 4), ['03', '06', '09', '12']);
    assert.deepEqual(months('yearly', 4), ['03']);
    // starting in July: the year ends in June
    assert.deepEqual(months('quarterly', 7), ['03', '06', '09', '12']);
    assert.deepEqual(months('yearly', 7), ['06']);
    assert.deepEqual(months('quarterly', 2), ['01', '04', '07', '10']);
  });

  test('the steps due become checklist items that need a sign-off before the month is ready', () => {
    const steps: CloseStep[] = [
      { id: 'cs_payroll1', title: 'Get the payroll report', frequency: 'monthly' },
      { id: 'cs_vatfile1', title: 'File the VAT return', frequency: 'quarterly' },
    ];
    assert.deepEqual(closeStepItems(steps, '2026-05').map(i => i.id), ['step:cs_payroll1']);
    const june = closeStepItems(steps, '2026-06');
    assert.deepEqual(june.map(i => i.title), ['Get the payroll report', 'File the VAT return']);
    assert.match(String(readyToClose(june).reason), /Review and sign off: Get the payroll report, File the VAT return/);
    const signed = { by: 'a@x.test', at: '2026-07-01T00:00:00Z' };
    assert.deepEqual(readyToClose(june, { 'step:cs_payroll1': signed, 'step:cs_vatfile1': signed }), { ready: true });
    assert.deepEqual(closeStepItems(undefined, '2026-06'), []);
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('Close steps (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_steps_${crypto.randomBytes(4).toString('hex')}`;
  let db: Firestore;
  let server: Server;
  let base = '';
  const call = async (uid: string, method: string, path: string, body: unknown) => {
    const res = await fetch(`${base}/api/v1/workspaces/${ws}/periods${path}`, {
      method, headers: { 'Content-Type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() as { message?: string; closeSteps?: CloseStep[]; signOffs?: Record<string, unknown> } };
  };
  const stored = async () => ((await db.collection('workspaces').doc(ws).get()).data()?.closeSteps || []) as CloseStep[];

  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Steps Co', members: ['owner-1', 'acct-1', 'book-1'], roles: { 'acct-1': 'accountant', 'book-1': 'bookkeeper' } });
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string; email: string } }).user = { uid: String(req.header('x-test-uid')), email: `${req.header('x-test-uid')}@example.test` }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['periods', 'auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  let payroll = '';
  test('a bookkeeper may not change the steps; an accountant saves them and new ones get ids', async () => {
    const steps = [{ title: ' Get the payroll report ', frequency: 'monthly' }, { title: 'File the VAT return', frequency: 'quarterly' }];
    assert.equal((await call('book-1', 'PUT', '/close-steps', { steps })).status, 403);
    assert.deepEqual(await stored(), []);
    const res = await call('acct-1', 'PUT', '/close-steps', { steps });
    assert.equal(res.status, 200);
    const saved = await stored();
    assert.deepEqual(saved.map(s => [s.title, s.frequency]), [['Get the payroll report', 'monthly'], ['File the VAT return', 'quarterly']]);
    assert.ok(saved.every(s => /^cs_[a-f0-9]{12}$/.test(s.id)));
    assert.deepEqual(res.body.closeSteps, saved);
    payroll = saved[0].id;
  });

  test('a bad list is refused and nothing changes; saving again keeps the ids of kept steps', async () => {
    const bad = await call('owner-1', 'PUT', '/close-steps', { steps: [{ title: 'x', frequency: 'monthly' }] });
    assert.equal(bad.status, 400);
    assert.match(String(bad.body.message), /2 to 120/);
    assert.equal((await stored()).length, 2);
    const res = await call('owner-1', 'PUT', '/close-steps', { steps: [{ id: payroll, title: 'Get the payroll report', frequency: 'monthly' }, { title: 'Count the cash box', frequency: 'yearly' }] });
    assert.equal(res.status, 200);
    const saved = await stored();
    assert.equal(saved[0].id, payroll);
    assert.deepEqual(saved.map(s => s.title), ['Get the payroll report', 'Count the cash box']);
    const auditLine = (await db.pool.query(`select data->'details'->>'description' as d from public."auditLogs" where workspace_id = $1 and data->>'action' = 'CLOSE_STEPS_SAVED' order by created_at desc limit 1`, [ws])).rows[0].d;
    assert.match(auditLine, /added "Count the cash box"; removed "File the VAT return"/);
  });

  test('a bookkeeper signs a step off for the month; a step that is not this workspace\'s is refused', async () => {
    const signed = await call('book-1', 'POST', '/2026-09/sign-off', { itemId: `step:${payroll}` });
    assert.equal(signed.status, 200);
    assert.ok(signed.body.signOffs?.[`step:${payroll}`]);
    assert.equal((await call('book-1', 'POST', '/2026-09/sign-off', { itemId: 'step:cs_notours123' })).status, 400);
    // removing the step leaves the sign-off with its month; it can still be taken back
    await call('owner-1', 'PUT', '/close-steps', { steps: [] });
    const undo = await call('book-1', 'POST', '/2026-09/sign-off', { itemId: `step:${payroll}`, remove: true });
    assert.equal(undo.status, 200);
    assert.equal(undo.body.signOffs?.[`step:${payroll}`], undefined);
  });
});
