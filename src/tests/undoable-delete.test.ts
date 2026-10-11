/**
 * Delete with Undo (BO-08): off the screen at once, really deleted when the time is up; Undo cancels
 * the delete; a refused delete brings the record back; deleting the same record twice does nothing.
 */
import './helpers/dom';
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { deleteWithUndo, isDeletePending, undoDelete } from '../lib/undoableDelete';

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('Delete with Undo', () => {
  test('hidden now, deleted when the time is up; a second request for the same record is ignored', async () => {
    const log: string[] = [];
    const d = { key: 'items/a', label: 'Item "A"', hide: () => log.push('hide'), restore: () => log.push('restore'), commit: async () => { log.push('commit'); }, windowMs: 20 };
    deleteWithUndo(d);
    deleteWithUndo(d);
    assert.deepEqual(log, ['hide']);
    assert.equal(isDeletePending('items/a'), true);
    await wait(60);
    assert.deepEqual(log, ['hide', 'commit']);
    assert.equal(isDeletePending('items/a'), false);
  });

  test('Undo: back on screen, never deleted', async () => {
    const log: string[] = [];
    deleteWithUndo({ key: 'items/b', label: 'Item "B"', hide: () => log.push('hide'), restore: () => log.push('restore'), commit: async () => { log.push('commit'); }, windowMs: 20 });
    assert.equal(undoDelete('items/b'), true);
    await wait(60);
    assert.deepEqual(log, ['hide', 'restore']);
    assert.equal(undoDelete('items/b'), false, 'nothing left to undo');
  });

  test('a delete refused when it runs brings the record back', async () => {
    const log: string[] = [];
    deleteWithUndo({ key: 'items/c', label: 'Item "C"', hide: () => log.push('hide'), restore: () => log.push('restore'), commit: async () => { throw new Error('in use'); }, windowMs: 10 });
    await wait(50);
    assert.deepEqual(log, ['hide', 'restore']);
  });
});
