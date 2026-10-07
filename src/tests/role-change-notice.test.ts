/**
 * "Your role changed" (S-15): when an owner changes someone's role, that person (and only that
 * person) is told the new and the old role; changing it to the same role tells nobody. The
 * database part runs when LF_TEST_DATABASE_URL is set.
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Firestore } from '../server/db/pgFirestore';

const url = process.env.LF_TEST_DATABASE_URL;
describe('Role change notice (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_role_${crypto.randomBytes(4).toString('hex')}`;
  let db: Firestore;
  let server: Server;
  let base = '';
  const change = (uid: string, target: string, role: string) => fetch(`${base}/api/v1/workspaces/${ws}/roles/${target}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json', 'x-test-uid': uid }, body: JSON.stringify({ role }),
  });
  const told = async () => (await db.pool.query(
    `select data->>'uid' as uid, data->>'title' as title, data->>'message' as message from public.notifications where workspace_id = $1 and data->>'kind' = 'member.role_changed'`, [ws])).rows;

  before(async () => {
    process.env.DATABASE_URL = url;
    const { getDb } = await import('../server/db/firestore');
    db = getDb();
    await db.collection('workspaces').doc(ws).set({ uid: 'owner-1', name: 'Roles Co', members: ['owner-1', 'acct-1', 'book-1'], roles: { 'owner-1': 'owner', 'acct-1': 'accountant', 'book-1': 'bookkeeper' } });
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
    for (const table of ['notifications', 'auditLogs', 'workspaces']) await db.pool.query(`delete from public."${table}" where workspace_id = $1 or id = $1`, [ws]);
    await db.terminate();
  });

  test('the person whose role changed is told, and nobody else', async () => {
    assert.equal((await change('owner-1', 'book-1', 'accountant')).status, 200);
    assert.deepEqual(await told(), [{ uid: 'book-1', title: 'Your role is now Accountant',
      message: 'In this workspace you are now Accountant (before: Bookkeeper). What you can see and change follows the new role.' }]);
  });

  test('the same role again tells nobody', async () => {
    assert.equal((await change('owner-1', 'book-1', 'accountant')).status, 200);
    assert.equal((await told()).length, 1);
  });
});
