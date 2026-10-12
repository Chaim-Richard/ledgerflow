import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import { attachmentRecord } from '../lib/attachments';

/** Real migrated Postgres/RLS, not a mock successful update response. No schema changes needed. */
describe('Asset maintenance metadata persistence', { skip: !process.env.LF_TEST_DATABASE_URL && 'LF_TEST_DATABASE_URL not set' }, () => {
  const workspaceId = `asset_metadata_${crypto.randomBytes(5).toString('hex')}`;
  const assetId = `${workspaceId}_van`;
  const fileId = `${workspaceId}_file`;
  let client: pg.Client;
  const original = {
    workspaceId, uid: 'asset-owner', name: 'ציוד', purchaseDate: '2026-01-01', purchasePriceCents: 1200000,
    salvageValueCents: 10000, accumulatedDepreciationCents: 20000, usefulLifeYears: 5,
    depreciationMethod: 'straight-line', status: 'active', assetAccountId: 'equipment',
  };
  const saved = async () => (await client.query<{ data: Record<string, unknown> }>('select data from public.assets where id = $1', [assetId])).rows[0].data;
  async function asUser(uid: string, operation: () => Promise<void>) {
    await client.query('begin');
    try {
      await client.query('set local role authenticated');
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: 'authenticated', aal: 'aal1' })]);
      await operation();
      await client.query('commit');
    } catch (error) { await client.query('rollback'); throw error; }
  }
  before(async () => {
    client = new pg.Client({ connectionString: process.env.LF_TEST_DATABASE_URL });
    await client.connect();
    await client.query('insert into public.workspaces (id, data) values ($1, $2)', [workspaceId, {
      uid: 'asset-owner', name: 'Asset metadata tests', currency: 'USD', members: ['asset-owner', 'asset-book', 'asset-viewer'],
      roles: { 'asset-book': 'bookkeeper', 'asset-viewer': 'viewer' },
    }]);
    await client.query('insert into public.assets (id, data) values ($1, $2)', [assetId, original]);
  });
  after(async () => {
    if (!client) return;
    await client.query('delete from public.documents where workspace_id = $1', [workspaceId]);
    await client.query('delete from public.assets where workspace_id = $1', [workspaceId]);
    await client.query('delete from public.workspaces where id = $1', [workspaceId]);
    await client.end();
  });

  test('bookkeeper saves and removes maintenance notes, sets the tag and service day, without changing depreciation or posting', async () => {
    const entry = { id: 'service', date: '2026-10-11', description: 'בדיקת ציוד', by: 'Dana', costCents: 12025 };
    await asUser('asset-book', async () => {
      await client.query('select public.lf_update($1, $2, $3)', ['assets', assetId, { maintenance: [entry], nextServiceDue: '2027-04-11', assetTag: 'AT-0001' }]);
    });
    const record = await saved();
    assert.deepEqual(record.maintenance, [entry]); assert.equal(record.nextServiceDue, '2027-04-11'); assert.equal(record.assetTag, 'AT-0001');
    for (const [key, value] of Object.entries(original)) assert.deepEqual(record[key], value, `${key} unchanged`);
    await asUser('asset-book', async () => {
      await client.query('select public.lf_update($1, $2, $3)', ['assets', assetId, { maintenance: [] }]);
    });
    assert.deepEqual((await saved()).maintenance, []);
    assert.equal((await client.query('select count(*)::int as count from public.transactions where workspace_id = $1', [workspaceId])).rows[0].count, 0);
  });

  test('viewer/non-member updates are refused and leave the saved asset untouched', async () => {
    const before = await saved();
    for (const uid of ['asset-viewer', 'not-a-member']) {
      await assert.rejects(asUser(uid, async () => {
        await client.query('select public.lf_update($1, $2, $3)', ['assets', assetId, { maintenance: [{ id: 'forbidden', date: '2026-10-11', description: 'Forbidden' }] }]);
      }));
      assert.deepEqual(await saved(), before);
    }
  });

  test('maintenance files persist under the existing documents RLS with the real asset link', async () => {
    const record = attachmentRecord({ name: 'קבלה.txt', size: 7, type: 'text/plain' }, 'data:text/plain;base64,c2VydmljZQ==',
      { collection: 'assets', id: assetId, label: 'Asset maintenance: ציוד' },
      { uid: 'asset-book', workspaceId }, '2026-10-11T10:00:00Z');
    await asUser('asset-book', async () => {
      await client.query('select public.lf_set($1, $2, $3, false)', ['documents', fileId, record]);
    });
    const file = (await client.query<{ data: Record<string, unknown> }>('select data from public.documents where id = $1', [fileId])).rows[0].data;
    assert.deepEqual(file, record);
    assert.equal(file.linkedCollection, 'assets'); assert.equal(file.linkedId, assetId);
    const before = await saved();
    assert.equal(before.purchasePriceCents, 1200000); assert.equal(before.accumulatedDepreciationCents, 20000);
  });

  test('the database refuses a second asset with the same tag in the workspace, trimmed and case-folded; other workspaces may reuse it', async () => {
    await client.query("update public.assets set data = data || '{\"assetTag\": \"VAN-1\"}'::jsonb where id = $1", [assetId]);
    await assert.rejects(
      client.query('insert into public.assets (id, data) values ($1, $2)', [`${assetId}_2`, { ...original, assetTag: ' van-1 ' }]),
      /assets_workspace_tag_uq/,
    );
    await client.query('insert into public.assets (id, data) values ($1, $2)', [`${assetId}_3`, { ...original, assetTag: '' }]);
    await client.query('insert into public.assets (id, data) values ($1, $2)', [`${assetId}_4`, { ...original, workspaceId: `${workspaceId}_other`, assetTag: 'VAN-1' }]);
    await client.query('delete from public.assets where id = $1', [`${assetId}_4`]);
  });
});
