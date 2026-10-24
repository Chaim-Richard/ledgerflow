/**
 * EG-9: the bank rules run on the server, from one pure function shared with the browser
 * (src/lib/bankRules.ts). Imported lines get the rules' suggestion (account, contact, labels) and stay
 * pending; re-importing or re-running never applies or counts a rule twice; the re-run route is for
 * owners and accountants.
 *
 * Hand-worked figures. Rules (priority, lower first; ties by id):
 *   R3 p5  minAmountCents 100000 (≥ 1,000.00)      → tag "large"
 *   R1 p10 contains "office depot"                  → account 6000 Office, contact V1, tag "supplies", dept=ops
 *   R2 p20 contains "depot"                         → account 7000 Retail (ignored: R1 gave one), tag "retail", dept=sales, region=north
 *   R4 p1  contains "office", paused                → never
 *   R5 p1  contains "depot", its group paused       → never
 * Lines:
 *   A "OFFICE DEPOT #12"  −250.00  : R3 no (250.00 < 1,000.00); R1, R2 → 6000, V1, [supplies, retail], {dept: ops, region: north}, rules [R1, R2]
 *   B "PAYROLL TRANSFER" −1,500.00 : R3 only → no account, [large], rules [R3]
 *   C "COFFEE"              −4.50  : nothing → no suggestion
 * Hits after the import: R1 1, R2 1, R3 1. Re-run with nothing changed: 0 lines changed, hits unchanged.
 * Add R6 p1 contains "coffee" → 6000: re-run changes 1 line (C), R6 1, the others unchanged; again: 0.
 * Ledger entries written for the workspace throughout: 0.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { suggestFromRules, sameSuggestion } from '../lib/bankRules';
import type { AutoRule, ChartAccount } from '../types';
import { commitAsServer } from './helpers/serverCommit';

const rule = (id: string, priority: number, condition: AutoRule['condition'], action: AutoRule['action'], extra: Partial<AutoRule> = {}): AutoRule =>
  ({ id, uid: 'someone-else', priority, condition, action, confidence: 1, isHardened: true, isActive: true, createdAt: '2026-10-01', ...extra });

const accounts = [
  { id: 'a6000', name: 'Office', code: '6000', type: 'expense' },
  { id: 'a7000', name: 'Retail', code: '7000', type: 'expense' },
  { id: 'aOld', name: 'Old', code: '6999', type: 'expense', archived: true },
] as unknown as ChartAccount[];

const RULES = [
  rule('R3', 5, { minAmountCents: 100000 }, { addTags: ['large'] }),
  rule('R1', 10, { descriptionContains: 'office depot' }, { targetAccountId: 'a6000', contactId: 'V1', addTags: ['supplies'], targetDimensions: { dept: 'ops' } }),
  rule('R2', 20, { descriptionContains: 'depot' }, { targetNodeId: 'a7000', targetTags: ['retail'], targetDimensions: { dept: 'sales', region: 'north' } }),
  rule('R4', 1, { descriptionContains: 'office' }, { targetAccountId: 'a7000' }, { isActive: false }),
  rule('R5', 1, { descriptionContains: 'depot' }, { targetAccountId: 'a7000' }, { groupName: 'Paused', groupIsActive: false }),
];
const LINE_A = { description: 'OFFICE DEPOT #12', amountCents: -25000, date: '2026-10-20' };
const LINE_B = { description: 'PAYROLL TRANSFER', amountCents: -150000, date: '2026-10-21' };
const LINE_C = { description: 'COFFEE', amountCents: -450, date: '2026-10-22' };
const EXPECT_A = { accountId: 'a6000', accountName: 'Office', contactId: 'V1', contactKind: 'vendor', tags: ['supplies', 'retail'], dimensions: { dept: 'ops', region: 'north' }, ruleIds: ['R1', 'R2'] };
const EXPECT_B = { tags: ['large'], dimensions: {}, ruleIds: ['R3'] };

describe('EG-9 the bank rule function (shared by server and browser)', () => {
  const context = { accounts, contacts: [{ id: 'V1', kind: 'vendor' as const }] };
  test('line A: R1 gives account and contact, R2 adds labels, paused rules never match', () => {
    assert.deepEqual(suggestFromRules(RULES, LINE_A, context), EXPECT_A);
  });
  test('line B: only the amount rule (1,500.00 ≥ 1,000.00); line C: nothing', () => {
    assert.deepEqual(suggestFromRules(RULES, LINE_B, context), EXPECT_B);
    assert.equal(suggestFromRules(RULES, LINE_C, context), null);
  });
  test('the order of the rules as read does not matter; the function is pure', () => {
    assert.deepEqual(suggestFromRules([...RULES].reverse(), LINE_A, context), EXPECT_A);
    assert.ok(sameSuggestion(suggestFromRules(RULES, LINE_A, context), suggestFromRules(RULES, LINE_A, context)));
  });
  test('stopProcessingOnMatch ends the run; an archived account or unknown contact is not suggested', () => {
    const stop = [rule('S', 1, { descriptionContains: 'depot' }, { targetAccountId: 'aOld', contactId: 'nobody', addTags: ['s'] }, { stopProcessingOnMatch: true }), ...RULES];
    assert.deepEqual(suggestFromRules(stop, LINE_A, context), { tags: ['s'], dimensions: {}, ruleIds: ['S'] });
  });
});

const url = process.env.LF_TEST_DATABASE_URL;

describe('EG-9 bank rules on the server', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const suffix = crypto.randomBytes(4).toString('hex');
  const ws = `ws_eg9_${suffix}`;
  const OWNER = 'eg9-owner', ACC = 'eg9-acc', BK = 'eg9-bk', VIEW = 'eg9-view';
  const id = (s: string) => `${ws}_${s}`;
  let server: Server;
  let base = '';
  let db: import('../server/db/pgFirestore').Firestore;

  const send = async (uid: string, body: unknown) => {
    const res = await fetch(`${base}/api/v1/transactions/bank-lines/apply-rules`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json().catch(() => ({})) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  const line = async (key: string) => (await db.collection('bankLines').doc(id(key)).get()).data()!;
  const hits = async () => Object.fromEntries((await db.collection('autoRules').where('workspaceId', '==', ws).get()).docs.map(d => [d.id.slice(ws.length + 1), d.data().hitCount ?? 0]));
  const entries = async () => (await db.collection('transactions').where('workspaceId', '==', ws).get()).docs.length;

  before(async () => {
    process.env.DATABASE_URL = url;
    const express = (await import('express')).default;
    const { transactionRouter } = await import('../server/routes/transactionRoutes');
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: OWNER, name: 'EG-9', currency: 'USD', members: [OWNER, ACC, BK, VIEW], roles: { [ACC]: 'accountant', [BK]: 'bookkeeper', [VIEW]: 'viewer' } });
    for (const a of accounts) await db.collection('chartAccounts').doc(id(a.id)).set({ ...a, id: id(a.id), workspaceId: ws });
    await db.collection('vendors').doc(id('V1')).set({ workspaceId: ws, name: 'Office Depot' });
    const scoped = (r: AutoRule): AutoRule => ({
      ...r, id: id(r.id), workspaceId: ws,
      action: { ...r.action, ...(r.action.targetAccountId ? { targetAccountId: id(r.action.targetAccountId) } : {}), ...(r.action.targetNodeId ? { targetNodeId: id(r.action.targetNodeId) } : {}), ...(r.action.contactId ? { contactId: id(r.action.contactId) } : {}) },
    });
    for (const r of RULES) await db.collection('autoRules').doc(id(r.id)).set(scoped(r) as never);
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/transactions', transactionRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['transactions', 'bankLines', 'autoRules', 'chartAccounts', 'vendors', 'idempotencyKeys', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    const { getSupabase } = await import('../lib/db/client');
    getSupabase().realtime.disconnect();
    await getSupabase().auth.dispose();
    await db.terminate();
  });

  test('an import stores the suggestions, keeps the lines pending and posts nothing', async () => {
    const res = await commitAsServer(db as never, OWNER, { workspaceId: ws, transactions: [], bankLines: [
      { id: id('A'), ...LINE_A, status: 'pending', matchedTransactionId: null },
      { id: id('B'), ...LINE_B, status: 'pending', matchedTransactionId: null },
      { id: id('C'), ...LINE_C, status: 'pending', matchedTransactionId: null },
    ] } as never);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const a = await line('A');
    assert.equal(a.status, 'pending');
    assert.equal(a.matchedTransactionId, null);
    assert.deepEqual(a.suggestion, { ...EXPECT_A, accountId: id('a6000'), contactId: id('V1'), ruleIds: [id('R1'), id('R2')] });
    assert.deepEqual((await line('B')).suggestion, { ...EXPECT_B, ruleIds: [id('R3')] });
    assert.equal((await line('C')).suggestion, null);
    assert.deepEqual(await hits(), { R1: 1, R2: 1, R3: 1, R4: 0, R5: 0 });
    assert.equal(await entries(), 0);
  });

  test('re-importing the same line is refused and counts no hit', async () => {
    const res = await commitAsServer(db as never, OWNER, { workspaceId: ws, transactions: [], bankLines: [{ id: id('A'), ...LINE_A, status: 'pending' }] } as never);
    assert.equal(res.status, 409);
    assert.deepEqual(await hits(), { R1: 1, R2: 1, R3: 1, R4: 0, R5: 0 });
  });

  test('the re-run route: owners and accountants only', async () => {
    assert.equal((await send(BK, { workspaceId: ws })).status, 403);
    assert.equal((await send(VIEW, { workspaceId: ws })).status, 403);
    assert.equal((await send('stranger', { workspaceId: ws })).status, 403);
    const owner = await send(OWNER, { workspaceId: ws });
    assert.equal(owner.status, 200, JSON.stringify(owner.body));
    assert.deepEqual(owner.body, { checked: 3, changed: 0, suggested: 2, truncated: false });
    assert.deepEqual(await hits(), { R1: 1, R2: 1, R3: 1, R4: 0, R5: 0 });
  });

  test('a new rule: the re-run suggests for line C once, and never twice', async () => {
    await db.collection('autoRules').doc(id('R6')).set({ ...rule(id('R6'), 1, { descriptionContains: 'coffee' }, { targetAccountId: id('a6000') }), workspaceId: ws } as never);
    const first = await send(ACC, { workspaceId: ws });
    assert.deepEqual(first.body, { checked: 3, changed: 1, suggested: 3, truncated: false });
    const c = await line('C');
    assert.equal(c.status, 'pending');
    assert.deepEqual(c.suggestion, { accountId: id('a6000'), accountName: 'Office', tags: [], dimensions: {}, ruleIds: [id('R6')] });
    assert.deepEqual(await hits(), { R1: 1, R2: 1, R3: 1, R4: 0, R5: 0, R6: 1 });
    const again = await send(OWNER, { workspaceId: ws });
    assert.deepEqual(again.body, { checked: 3, changed: 0, suggested: 3, truncated: false });
    assert.deepEqual(await hits(), { R1: 1, R2: 1, R3: 1, R4: 0, R5: 0, R6: 1 });
    assert.deepEqual((await line('A')).ruleIdsApplied, [id('R1'), id('R2')]);
    assert.equal(await entries(), 0);
  });

  test('a line matched to an entry is left alone by the re-run', async () => {
    await db.collection('bankLines').doc(id('A')).update({ status: 'matched', matchedTransactionId: 'tx-elsewhere' });
    const res = await send(OWNER, { workspaceId: ws });
    assert.deepEqual(res.body, { checked: 2, changed: 0, suggested: 2, truncated: false });
  });
});
