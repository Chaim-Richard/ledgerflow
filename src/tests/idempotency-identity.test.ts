/**
 * INT-3 (AUD-07b): executeIdempotent — the mechanism the admin routes, commandExecutor and others use —
 * replays only for the same actor, operation and canonical request; against real Postgres.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';

const url = process.env.LF_TEST_DATABASE_URL;
describe('idempotency identity (database)', { skip: !url && 'LF_TEST_DATABASE_URL not set' }, () => {
  const ws = `ws_idem_${crypto.randomBytes(4).toString('hex')}`;
  let db: import('../server/db/pgFirestore').Firestore;
  let mod: typeof import('../server/utils/idempotency');
  const counter = () => db.collection('workspaces').doc(ws);
  /** the "operation": add 1 to a counter, inside the idempotent transaction */
  const bump = (t: import('../server/db/firestore').Transaction) => t.get(counter()).then(snap => {
    const n = Number(snap.data()?.n || 0) + 1;
    t.set(counter(), { n }, { merge: true });
    return { n };
  });
  const count = async () => Number((await counter().get()).data()?.n || 0);

  before(async () => {
    process.env.DATABASE_URL = url;
    mod = await import('../server/utils/idempotency');
    db = (await import('../server/db/firestore')).getDb();
    await counter().set({ uid: 'admin', name: 'idem', n: 0 });
  });
  after(async () => {
    for (const table of ['idempotencyKeys', 'workspaces']) await db.pool.query(`delete from public."${table}" where id like $1 or workspace_id = $2`, [`${ws}%`, ws]);
    await db.terminate();
  });

  const run = (key: string, actor: string, body: unknown) => mod.executeIdempotent(`${ws}:ADMIN_TEST:${key}`, { actor, workspaceId: ws, operationType: 'ADMIN_TEST', payloadHash: mod.requestPayloadHash(body) }, bump);

  test('same key, same actor, same request: the effect happens once and the first answer comes back', async () => {
    const a = await run('k1', 'admin-1', { plan: 'pro' });
    const b = await run('k1', 'admin-1', { plan: 'pro' });
    assert.deepEqual(a, b);
    assert.equal(await count(), 1);
  });

  test('same key with a different request is refused (409) and changes nothing', async () => {
    await assert.rejects(run('k1', 'admin-1', { plan: 'enterprise' }), (e: { status?: number }) => e.status === 409);
    assert.equal(await count(), 1);
  });

  test('same key from another actor is refused (409)', async () => {
    await assert.rejects(run('k1', 'admin-2', { plan: 'pro' }), (e: { status?: number }) => e.status === 409);
    assert.equal(await count(), 1);
  });

  test('keys in a different order of fields are the same request', async () => {
    assert.equal(mod.requestPayloadHash({ a: 1, b: { c: 2, d: 3 } }), mod.requestPayloadHash({ b: { d: 3, c: 2 }, a: 1 }));
  });

  test('two identical requests at the same moment: one effect', async () => {
    const results = await Promise.allSettled([run('k2', 'admin-1', { x: 1 }), run('k2', 'admin-1', { x: 1 })]);
    assert.ok(results.some(r => r.status === 'fulfilled'));
    assert.equal(await count(), 2, 'one more effect, not two');
  });
});
