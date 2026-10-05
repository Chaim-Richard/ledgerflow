import test from 'node:test';
import assert from 'node:assert/strict';
import { saveInlineRecordField, type InlineRecordAdapter } from '../lib/inlineRecordFields';
const target = { collection: 'projects', id: 'p' } as const;
function fixture(record: Record<string, unknown> = { workspaceId: 'w', name: 'ישן', budgetCents: 0 }) {
  const writes: unknown[] = [];
  const session = { uid: 'u', workspaceId: 'w', writable: true };
  const adapter: InlineRecordAdapter = { session: () => session, read: async () => record, update: async (target, fields) => { writes.push({ target, fields }); } };
  return { adapter, session, writes };
}
test('inline metadata preserves Hebrew and writes just the allowed field', async () => {
  const { adapter, writes } = fixture();
  await saveInlineRecordField(adapter, target, 'name', 'ישן', 'שלום Supply');
  assert.deepEqual(writes, [{ target, fields: { name: 'שלום Supply' } }]);
});
test('refuses stale, cross-workspace, viewer and forbidden financial edits', async () => {
  for (const record of [{ workspaceId: 'w', name: 'newer' }, { workspaceId: 'other', name: 'ישן' }]) {
    const { adapter, writes } = fixture(record);
    await assert.rejects(saveInlineRecordField(adapter, target, 'name', 'ישן', 'new')); assert.equal(writes.length, 0);
  }
  const f = fixture(); f.session.writable = false;
  await assert.rejects(saveInlineRecordField(f.adapter, target, 'name', 'ישן', 'new'));
  await assert.rejects(saveInlineRecordField(f.adapter, target, 'balanceCents', 0, 100));
});
test('rechecks permissions after reading and refuses converted estimates and invalid dates', async () => {
  const f = fixture(); f.adapter.read = async () => { f.session.writable = false; return { workspaceId: 'w', name: 'ישן' }; };
  await assert.rejects(saveInlineRecordField(f.adapter, target, 'name', 'ישן', 'new')); assert.equal(f.writes.length, 0);
  const est = fixture({ workspaceId: 'w', status: 'converted', number: '1' });
  await assert.rejects(saveInlineRecordField(est.adapter, { collection: 'estimates', id: 'e' }, 'number', '1', '2'));
  await assert.rejects(saveInlineRecordField(est.adapter, { collection: 'estimates', id: 'e' }, 'date', '2026-01-01', '2026-02-30'));
});
test('planning amounts require nonnegative integer cents and backend failure rejects', async () => {
  const f = fixture();
  for (const amount of [-1, 1.2, Number.MAX_SAFE_INTEGER + 1]) await assert.rejects(saveInlineRecordField(f.adapter, target, 'budgetCents', 0, amount));
  f.adapter.update = async () => { throw new Error('offline'); };
  await assert.rejects(saveInlineRecordField(f.adapter, target, 'budgetCents', 0, 1250), /offline/);
});
