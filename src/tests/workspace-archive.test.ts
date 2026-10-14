import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildWorkspaceArchive, zipCrc32 } from '../lib/workspaceArchive';

function signedBackup() {
  const source = {
    schemaVersion: 1,
    exportedAt: '2026-10-13T17:00:00.000Z',
    workspace: { id: 'ws1', name: 'חברה' },
    transactions: [{ id: 't1', workspaceId: 'ws1', description: '=SUM(A1:A2)', amountCents: 12345 }],
    accounts: [{ id: 'a1', workspaceId: 'ws1', name: 'חשבון בנק' }],
    vendors: [],
    metadata: { counts: { transactions: 1, accounts: 1, vendors: 0 }, serverAuthoritative: true },
  };
  return {
    ...source,
    metadata: { ...source.metadata, checksum: createHash('sha256').update(JSON.stringify(source)).digest('hex') },
  };
}

function signedChangedBackup(value: Record<string, unknown>) {
  const metadata = { ...(value.metadata as Record<string, unknown>) };
  delete metadata.checksum;
  const unsigned = { ...value, metadata };
  return {
    ...unsigned,
    metadata: {
      ...metadata,
      checksum: createHash('sha256').update(JSON.stringify(unsigned)).digest('hex'),
    },
  };
}

async function inspectZip(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const entries = new Map<string, string>();
  const decode = new TextDecoder();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const count = view.getUint16(offset + 26, true);
    const size = view.getUint32(offset + 18, true);
    const name = decode.decode(bytes.subarray(offset + 30, offset + 30 + count));
    const data = bytes.subarray(offset + 30 + count, offset + 30 + count + size);
    assert.equal(view.getUint32(offset + 14, true), zipCrc32(data));
    entries.set(name, decode.decode(data));
    offset += 30 + count + size;
  }
  assert.equal(view.getUint32(offset, true), 0x02014b50);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(bytes.length - 12, true), entries.size);
  return entries;
}

test('E-21 archive holds original verified backup, every collection as JSON/CSV, manifest and Hebrew', async () => {
  const source = signedBackup();
  const { blob, collections, manifest } = await buildWorkspaceArchive(source, 'ws1');
  const entries = await inspectZip(blob);
  assert.equal(blob.type, 'application/zip');
  assert.equal(entries.size, 9);
  assert.deepEqual(JSON.parse(entries.get('backup.json') || ''), source);
  assert.deepEqual(JSON.parse(entries.get('collections/vendors.json') || ''), []);
  assert.deepEqual(JSON.parse(entries.get('collections/transactions.json') || ''), source.transactions);
  assert.ok(entries.get('collections/accounts.csv')?.includes('חשבון בנק'));
  assert.ok(entries.get('collections/transactions.csv')?.includes("'=SUM"));
  assert.equal(collections.length, 3);
  assert.equal(manifest.rowCount, 2);
});

test('E-21 altered checksum, wrong workspace and incomplete lists are refused', async () => {
  const valid = signedBackup();
  const altered = structuredClone(valid);
  altered.transactions[0].description = 'Changed';
  await assert.rejects(buildWorkspaceArchive(altered, 'ws1'), /checksum/);
  await assert.rejects(buildWorkspaceArchive(valid, 'another-workspace'), /different workspace/);
  // The checksum is re-signed so each test reaches the inventory/count validation,
  // rather than stopping earlier at the separate integrity check.
  const missing = signedChangedBackup({ ...valid, accounts: undefined });
  await assert.rejects(buildWorkspaceArchive(missing, 'ws1'), /inventory/);
  const wrongCount = signedChangedBackup({
    ...valid,
    metadata: { ...valid.metadata, counts: { transactions: 2, accounts: 1, vendors: 0 } },
  });
  await assert.rejects(buildWorkspaceArchive(wrongCount, 'ws1'), /count mismatch/);
});
