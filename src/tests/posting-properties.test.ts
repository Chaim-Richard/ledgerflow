/** AU-3: generated tests on posting. (1) Thousands of random entries: every balanced one passes the
 * ledger door, every unbalanced or fractional one is refused. (2) Against the database: the same
 * payment sent 20 times at once (same operation id) is recorded exactly once. */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { checkLedgerEntry } from '../server/services/ledgerDoor';

/** Small deterministic random generator, so a failure can be reproduced from its seed. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

function balancedEntry(r: () => number) {
  const debits = Array.from({ length: int(r, 1, 6) }, () => int(r, 1, 5_000_000));
  const total = debits.reduce((a, b) => a + b, 0);
  // split the credit side into 1–4 parts that add up exactly
  const parts = int(r, 1, 4);
  const credits: number[] = [];
  let left = total;
  for (let i = 0; i < parts - 1 && left > 1; i++) { const c = int(r, 1, left - 1); credits.push(c); left -= c; }
  credits.push(left);
  const lines = [...debits.map((c, i) => ({ accountId: `d${i}`, amountCents: c })), ...credits.map((c, i) => ({ accountId: `c${i}`, amountCents: -c }))];
  return { workspaceId: 'w', totalAmountCents: total, lines };
}

describe('posting properties (generated)', () => {
  test('5,000 random balanced entries all pass the ledger door', () => {
    const r = rng(20261014);
    for (let i = 0; i < 5000; i++) {
      const e = balancedEntry(r);
      assert.doesNotThrow(() => checkLedgerEntry(e), `seed 20261014, case ${i}: ${JSON.stringify(e)}`);
    }
  });

  test('5,000 random entries made unbalanced by 1 cent or more are all refused', () => {
    const r = rng(7);
    for (let i = 0; i < 5000; i++) {
      const e = balancedEntry(r);
      const k = int(r, 0, e.lines.length - 1);
      e.lines[k] = { ...e.lines[k], amountCents: e.lines[k].amountCents + (r() < 0.5 ? -1 : 1) * int(r, 1, 1000) };
      assert.throws(() => checkLedgerEntry(e), Error, `seed 7, case ${i} should be refused: ${JSON.stringify(e)}`);
    }
  });

  test('fractional cents and a wrong total are always refused', () => {
    const r = rng(99);
    for (let i = 0; i < 1000; i++) {
      const e = balancedEntry(r);
      assert.throws(() => checkLedgerEntry({ ...e, lines: e.lines.map((l, j) => (j === 0 ? { ...l, amountCents: l.amountCents + 0.5 } : l)) }));
      assert.throws(() => checkLedgerEntry({ ...e, totalAmountCents: e.totalAmountCents + int(r, 1, 100) }));
    }
  });
});

const url = process.env.LF_TEST_DATABASE_URL;
describe('the same payment posted 20 times at once (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = 'ws_prop_' + crypto.randomBytes(5).toString('hex');
  let db: import('../server/db/pgFirestore').Firestore;
  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', members: ['owner-1'], roles: {}, currency: 'USD', name: 'Props' });
    await db.collection('chartAccounts').doc(`${ws}_bank`).set({ workspaceId: ws, name: 'Bank', type: 'asset', category: 'Cash', code: '1000' });
    await db.collection('chartAccounts').doc(`${ws}_ap`).set({ workspaceId: ws, name: 'Accounts Payable', type: 'liability', category: 'Payables', code: '2000' });
  });
  after(async () => {
    if (!db) return;
    for (const table of ['transactions', 'payments', 'auditLogs', 'numberingSeries', 'idempotencyKeys', 'chartAccounts', 'workspaces']) {
      await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    }
    await db.terminate();
  });

  test('20 concurrent sends with one operation id make one payment and one journal', async () => {
    const { createPaymentIdempotent } = await import('../server/services/paymentService');
    const payload = { workspaceId: ws, uid: 'owner-1', paymentDate: '2026-10-14', amountCents: 4321, paymentMethod: 'bank_transfer', vendorId: 'v1', entityName: 'Vendor', cashAccountId: `${ws}_bank`, offsetAccountId: `${ws}_ap`, allocations: [] };
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => createPaymentIdempotent(db as never, payload as never, 'same-click')));
    const ok = results.filter(r => r.status === 'fulfilled');
    assert.ok(ok.length >= 1, 'at least one send succeeds');
    const payments = (await db.pool.query(`select count(*)::int as n from public."payments" where workspace_id = $1`, [ws])).rows[0].n;
    const journals = (await db.pool.query(`select count(*)::int as n from public."transactions" where workspace_id = $1`, [ws])).rows[0].n;
    assert.equal(payments, 1, 'exactly one payment');
    assert.equal(journals, 1, 'exactly one journal entry');
  });
});
