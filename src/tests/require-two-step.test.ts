/**
 * Two-step login for everyone in a workspace (Y-30): only an owner, from a session that passed
 * two-step login, turns it on; then a password-only session of anyone in the workspace is refused
 * with "set up two-step login" (people in other workspaces are not); the status check stays open so
 * the app can say why; turning it off lets them in again at once. Runs with LF_TEST_DATABASE_URL.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { SignJWT } from 'jose';
import type { JWTPayload } from 'jose';
import type { Firestore } from '../server/db/pgFirestore';

const url = process.env.LF_TEST_DATABASE_URL;
process.env.SUPABASE_URL = 'https://example-project.supabase.co';
process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret-with-at-least-32-characters-long';

const token = (claims: JWTPayload) => new SignJWT({ role: 'authenticated', app_metadata: { provider: 'email' }, ...claims })
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setIssuer('https://example-project.supabase.co/auth/v1').setAudience('authenticated')
  .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET));

describe('Two-step login required by a workspace (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_2fa_${crypto.randomBytes(4).toString('hex')}`;
  const [owner, member, outsider] = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  let db: Firestore;
  let server: Server;
  let base = '';
  let auth: typeof import('../server/auth/supabaseAuth');
  let policy: typeof import('../server/services/twoStepPolicyService');
  const call = async (uid: string, aal: string, method: string, path: string, data?: unknown) => {
    const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json', 'x-test-uid': uid, 'x-test-aal': aal }, ...(data ? { body: JSON.stringify(data) } : {}) });
    return { status: res.status, body: await res.json() as Record<string, unknown> };
  };

  before(async () => {
    process.env.DATABASE_URL = url;
    db = (await import('../server/db/firestore')).getDb();
    auth = await import('../server/auth/supabaseAuth');
    policy = await import('../server/services/twoStepPolicyService');
    for (const id of [owner, member, outsider]) {
      await db.pool.query('insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())', [id, `${id.slice(0, 8)}@example.com`]);
    }
    await db.collection('workspaces').doc(ws).set({ uid: owner, name: 'Strict Books', members: [owner, member], roles: { [member]: 'accountant' } });
    const express = (await import('express')).default;
    const { workspaceRouter } = await import('../server/routes/workspaceRoutes');
    const { accountRouter } = await import('../server/routes/accountRoutes');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { (req as unknown as { user: Record<string, string> }).user = { uid: String(req.header('x-test-uid')), aal: String(req.header('x-test-aal')) }; next(); });
    app.use('/api/v1/workspaces', workspaceRouter);
    app.use('/api/v1/account', accountRouter);
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server?.close();
    for (const table of ['auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.pool.query('delete from auth.users where id = any($1::uuid[])', [[owner, member, outsider]]);
    await db.terminate();
  });

  test('only an owner turns it on, and only from a session that passed two-step login', async () => {
    await assert.rejects(policy.setRequireTwoStep(db, { workspaceId: ws, uid: owner, aal: 'aal1', required: true }), (e: unknown) => (e as { status?: number }).status === 409);
    await assert.rejects(policy.setRequireTwoStep(db, { workspaceId: ws, uid: member, aal: 'aal2', required: true }), (e: unknown) => (e as { status?: number }).status === 403);
    assert.equal((await call(member, 'aal2', 'PUT', `/api/v1/workspaces/${ws}/security/two-step`, { required: true })).status, 403, 'the route is for owners');
    const on = await call(owner, 'aal2', 'PUT', `/api/v1/workspaces/${ws}/security/two-step`, { required: true });
    assert.equal(on.status, 200);
    assert.equal((await db.collection('workspaces').doc(ws).get()).data()?.requireTwoStep, true);
  });

  test('a password-only session of anyone in it is refused with "set up two-step login"; others are not', async () => {
    const memberAal1 = await token({ sub: member, aal: 'aal1' });
    await assert.rejects(auth.verifyIdToken(memberAal1), (e: unknown) => (e as { code?: string }).code === 'auth/two-step-setup-required');
    await assert.rejects(auth.verifyIdToken(await token({ sub: owner, aal: 'aal1' })), (e: unknown) => (e as { code?: string }).code === 'auth/two-step-setup-required');
    assert.equal((await auth.verifyIdToken(memberAal1, { setupCheck: true })).uid, member, 'asking why is allowed');
    assert.equal((await auth.verifyIdToken(await token({ sub: member, aal: 'aal2' }))).uid, member);
    assert.equal((await auth.verifyIdToken(await token({ sub: outsider, aal: 'aal1' }))).uid, outsider, 'someone in no such workspace');
  });

  test('the status check says which workspace; turning it off lets members in again at once', async () => {
    const status = await call(member, 'aal1', 'GET', '/api/v1/account/two-step');
    assert.deepEqual([status.body.setupRequired, status.body.workspaces], [true, [{ id: ws, name: 'Strict Books' }]]);
    assert.equal((await call(member, 'aal2', 'GET', '/api/v1/account/two-step')).body.setupRequired, false, 'a code-verified session needs nothing');
    assert.equal((await call(owner, 'aal1', 'PUT', `/api/v1/workspaces/${ws}/security/two-step`, { required: false })).status, 200, 'turning it off needs no code');
    assert.equal((await auth.verifyIdToken(await token({ sub: member, aal: 'aal1' }))).uid, member);
  });
});
