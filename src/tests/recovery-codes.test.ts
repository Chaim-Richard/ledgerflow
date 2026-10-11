/**
 * Recovery codes for two-step login (L-85): only someone with an authenticator makes them; ten,
 * shown once, only keyed hashes kept; a right code (any case, with or without the dash) is used up
 * and removes the authenticator; a used or wrong one is refused, five wrong in an hour lock the
 * step; if removing the authenticator fails the code is given back. The database part runs when
 * LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';

const url = process.env.LF_TEST_DATABASE_URL;
describe('Recovery codes (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  let db: Firestore;
  let server: Server;
  let base = '';
  let svc: typeof import('../server/services/recoveryCodeService');
  const users: string[] = [];
  const newUser = async (withFactor: boolean) => {
    const id = crypto.randomUUID();
    users.push(id);
    await db.pool.query('insert into auth.users (id, email) values ($1, $2)', [id, `${id}@example.test`]);
    if (withFactor) await db.pool.query("insert into auth.mfa_factors (id, user_id, factor_type, status) values ($1, $2, 'totp', 'verified')", [crypto.randomUUID(), id]);
    return id;
  };
  const factors = async (id: string) => (await db.pool.query('select count(*)::int as n from auth.mfa_factors where user_id = $1', [id])).rows[0].n as number;
  const call = async (uid: string, method: string, path: string, body?: unknown) => {
    const res = await fetch(`${base}/api/v1/account${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': uid }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json() as { codes?: string[]; left?: number; message?: string } };
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    process.env.SYSTEM_SALT = process.env.SYSTEM_SALT || 'test-salt';
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    svc = await import('../server/services/recoveryCodeService');
    const express = (await import('express')).default;
    const { accountRouter } = await import('../server/routes/accountRoutes');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: { uid: string } }).user = { uid: String(req.header('x-test-uid')) }; next(); });
    app.use('/api/v1/account', accountRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const id of users) {
      await db.pool.query('delete from public."recoveryCodes" where id = $1', [id]);
      await db.pool.query('delete from auth.mfa_factors where user_id = $1', [id]);
      await db.pool.query('delete from auth.users where id = $1', [id]);
    }
    await db.terminate();
  });

  test('without two-step login there is nothing to recover', async () => {
    const id = await newUser(false);
    assert.equal((await call(id, 'POST', '/recovery-codes')).status, 409);
  });

  test('ten codes shown once; only keyed hashes are stored', async () => {
    const id = await newUser(true);
    const made = await call(id, 'POST', '/recovery-codes');
    assert.equal(made.status, 200);
    assert.equal(made.body.codes!.length, 10);
    assert.ok(made.body.codes!.every(c => /^[a-z2-9]{5}-[a-z2-9]{5}$/.test(c)));
    const stored = JSON.stringify((await db.collection('recoveryCodes').doc(id).get()).data());
    assert.ok(made.body.codes!.every(c => !stored.includes(c) && !stored.includes(c.replace('-', ''))));
    assert.equal((await call(id, 'GET', '/recovery-codes')).body.left, 10);
  });

  test('a right code (any case, no dash) is used up and removes the authenticator; again it is refused', async () => {
    const id = await newUser(true);
    const code = (await call(id, 'POST', '/recovery-codes')).body.codes![3];
    const used = await call(id, 'POST', '/recovery-codes/use', { code: code.replace('-', '').toUpperCase() });
    assert.equal(used.status, 200);
    assert.equal(used.body.left, 9);
    assert.equal(await factors(id), 0);
    assert.equal((await call(id, 'POST', '/recovery-codes/use', { code })).status, 400);
  });

  test('five wrong codes in an hour lock the step, right code or not', async () => {
    const id = await newUser(true);
    const code = (await call(id, 'POST', '/recovery-codes')).body.codes![0];
    for (let i = 0; i < 5; i++) assert.equal((await call(id, 'POST', '/recovery-codes/use', { code: 'aaaaa-aaaaa' })).status, 400);
    assert.equal((await call(id, 'POST', '/recovery-codes/use', { code })).status, 429);
    assert.equal(await factors(id), 1);
    const inAnHour = new Date(Date.now() + 61 * 60 * 1000);
    assert.deepEqual(await svc.useRecoveryCode(db, id, code, inAnHour), { left: 9 });
  });

  test('if the authenticator cannot be removed, the code is given back', async () => {
    const id = await newUser(true);
    const code = (await call(id, 'POST', '/recovery-codes')).body.codes![1];
    svc.setFactorRemoverForTests(async () => { throw new Error('auth tables unavailable'); });
    try {
      await assert.rejects(svc.useRecoveryCode(db, id, code), /unavailable/);
    } finally {
      svc.setFactorRemoverForTests(async (d, uid, factorId) => { await d.pool.query('delete from auth.mfa_factors where id = $1::uuid and user_id = $2::uuid', [factorId, uid]); });
    }
    assert.equal((await call(id, 'GET', '/recovery-codes')).body.left, 10);
    assert.equal(await factors(id), 1);
  });
});
