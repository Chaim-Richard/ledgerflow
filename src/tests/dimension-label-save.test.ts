import test from 'node:test';
import assert from 'node:assert/strict';
import { saveDimensionAxisLabel, type DimensionAxisAdapter } from '../lib/dimensionAxisLabel';
import { mergeDimensionDrafts } from '../lib/dimensionDrafts';
test('axis names preserve fresh unrelated axis changes and reject observed conflicts or role loss', async () => {
 const session = { uid: 'u', workspaceId: 'w', writable: true }; let name = 'Projects'; const writes: unknown[] = [];
 const adapter: DimensionAxisAdapter = { session: () => session, readWorkspace: async () => ({ id: 'w', dimensions: [{ id: 'project', name }, { id: 'world', name: 'Recently renamed' }] }), updateWorkspace: async (_id, dimensions) => { writes.push(dimensions); } };
 await saveDimensionAxisLabel(adapter, 'project', 'Projects', 'פרויקטים'); assert.deepEqual(writes[0], [{ id: 'project', name: 'פרויקטים' }, { id: 'world', name: 'Recently renamed' }]);
 name = 'Changed elsewhere'; await assert.rejects(saveDimensionAxisLabel(adapter, 'project', 'Projects', 'Mine'), /changed/);
 session.writable = false; await assert.rejects(saveDimensionAxisLabel(adapter, 'project', name, 'Mine'), /role/); assert.equal(writes.length, 1);
});
test('a confirmed label refresh retains unrelated alias/status edits and new draft nodes', () => {
 const old = { id: 'P1', dimensionId: 'project', description: 'Old', aliases: ['Original'], status: 'active' as const };
 const draft = { ...old, aliases: ['Unfinished alias'], status: 'archived' as const };
 const added = { id: 'P2', dimensionId: 'project', description: 'Unfinished new node' };
 const saved = { ...old, description: 'New', aliases: ['Original', 'Old'] };
 assert.deepEqual(mergeDimensionDrafts([saved], [draft, added], [old]), [{ ...saved, aliases: ['Unfinished alias'], status: 'archived' }, added]);
 assert.deepEqual(mergeDimensionDrafts([], [old], [old]), []);
});
