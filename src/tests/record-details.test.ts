import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRecordDetails, saveRecordDetails } from '../lib/recordDetails';
import type { DetailAdapter, DetailData, DetailSession } from '../lib/recordDetails';
function fixture() {
  let session: DetailSession | null = { uid: 'user', workspaceId: 'workspace', writable: true };
  let record: DetailData | undefined = { name: 'ספק Supply', address: 'Old', workspaceId: 'workspace', balanceCents: 4500, category: 'Supplier' };
  const writes: Record<string, string>[] = [];
  const adapter: DetailAdapter = { session: () => session, read: async () => record, update: async (_target, changes) => { writes.push(changes); record = { ...record, ...changes }; } };
  return { adapter, writes, setSession: (next: DetailSession | null) => { session = next; }, setRecord: (next: DetailData | undefined) => { record = next; } };
}
const target = { kind: 'vendors' as const, id: 'supplier' };
test('related record edits preserve Hebrew multiline text and save only changed allowed metadata', async () => {
  const f = fixture(), baseline = await loadRecordDetails(f.adapter, target);
  const result = await saveRecordDetails(f.adapter, target, baseline, { name: 'ספק Supply', address: 'ירושלים\nStreet 7', balanceCents: '0', workspaceId: 'other' });
  assert.deepEqual(f.writes, [{ address: 'ירושלים\nStreet 7' }]); assert.equal(result.balanceCents, 4500); assert.equal(result.workspaceId, 'workspace');
});
test('viewers, foreign/missing records, concurrent changed fields and workspace switches cannot save', async () => {
  const f = fixture(), baseline = await loadRecordDetails(f.adapter, target);
  f.setSession({ uid: 'user', workspaceId: 'workspace', writable: false });
  await assert.rejects(saveRecordDetails(f.adapter, target, baseline, { name: 'New' }), /role/);
  f.setSession({ uid: 'user', workspaceId: 'workspace', writable: true });
  f.setRecord({ ...baseline, address: 'Someone else changed this' });
  await assert.rejects(saveRecordDetails(f.adapter, target, baseline, { name: 'ספק Supply', address: 'Mine' }), /Someone changed/);
  f.setRecord({ ...baseline, workspaceId: 'foreign' });
  await assert.rejects(loadRecordDetails(f.adapter, target), /unavailable/);
  f.setRecord(undefined); await assert.rejects(loadRecordDetails(f.adapter, target), /unavailable/);
  f.adapter.read = async () => { f.setSession({ uid: 'user', workspaceId: 'changed', writable: true }); return baseline; };
  await assert.rejects(saveRecordDetails(f.adapter, target, baseline, { name: 'New' }), /Workspace/);
  assert.equal(f.writes.length, 0);
});
test('server refusal propagates, empty names are refused, and unrelated latest changes are preserved', async () => {
  const f = fixture(), baseline = await loadRecordDetails(f.adapter, target);
  await assert.rejects(saveRecordDetails(f.adapter, target, baseline, { name: ' ' }), /required/);
  f.setRecord({ ...baseline, balanceCents: 6500 });
  const result = await saveRecordDetails(f.adapter, target, baseline, { name: 'New' }); assert.equal(result.balanceCents, 6500);
  f.adapter.update = async () => { throw new Error('Server refused'); };
  await assert.rejects(saveRecordDetails(f.adapter, target, { ...baseline, name: 'New' }, { name: 'Again' }), /Server refused/);
});
test('project names require a checked reference history while descriptions remain ordinary metadata', async () => {
 const f = fixture(), baseline = await loadRecordDetails(f.adapter, target), project = { kind: 'projects' as const, id: 'project' };
 await assert.rejects(saveRecordDetails(f.adapter, project, baseline, { name: 'New project' }), /checked reference/);
 f.adapter.guardProjectRename = () => { throw new Error('Older entries use this project name'); };
 await assert.rejects(saveRecordDetails(f.adapter, project, baseline, { name: 'New project' }), /Older entries/);
 await saveRecordDetails(f.adapter, project, baseline, { name: String(baseline.name), description: 'New description' });
 assert.deepEqual(f.writes, [{ description: 'New description' }]);
});
