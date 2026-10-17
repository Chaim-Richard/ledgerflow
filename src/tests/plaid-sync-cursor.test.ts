import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncAllPages } from '../server/routes/plaidRoutes';

// AU-1: /transactions/sync is read page by page from the saved cursor; the new cursor comes back
// only when every page arrived, and a mid-read change restarts from the same starting cursor.
type Page = { added: unknown[]; modified: unknown[]; removed: { transaction_id?: string }[]; next_cursor: string; has_more: boolean };
const page = (p: Partial<Page>): { data: Page } => ({ data: { added: [], modified: [], removed: [], next_cursor: '', has_more: false, ...p } });

test('all pages are read, from the saved cursor, and the last cursor is returned', async () => {
  const seen: (string | undefined)[] = [];
  const pages = [page({ added: [{ id: 'a' }], next_cursor: 'c1', has_more: true }), page({ modified: [{ id: 'm' }], removed: [{ transaction_id: 'r' }], next_cursor: 'c2' })];
  const call = async (req: { cursor?: string }) => { seen.push(req.cursor); return pages.shift()!; };
  const out = await syncAllPages(call as never, 'tok', 'c0');
  assert.deepEqual(seen, ['c0', 'c1']);
  assert.deepEqual(out, { added: [{ id: 'a' }], modified: [{ id: 'm' }], removed: ['r'], cursor: 'c2' });
});

test('a change during paging throws the partial pages away and starts again from the same cursor', async () => {
  const seen: (string | undefined)[] = [];
  let calls = 0;
  const call = async (req: { cursor?: string }) => {
    seen.push(req.cursor);
    calls += 1;
    if (calls === 1) return page({ added: [{ id: 'old' }], next_cursor: 'x', has_more: true });
    if (calls === 2) throw Object.assign(new Error('mutation'), { response: { data: { error_code: 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' } } });
    return page({ added: [{ id: 'new' }], next_cursor: 'done' });
  };
  const out = await syncAllPages(call as never, 'tok', undefined);
  assert.deepEqual(seen, [undefined, 'x', undefined]);
  assert.deepEqual(out.added, [{ id: 'new' }], 'nothing from the half-read run');
  assert.equal(out.cursor, 'done');
});

test('another error is passed on and no cursor comes back', async () => {
  const call = async () => { throw Object.assign(new Error('x'), { response: { data: { error_code: 'ITEM_LOGIN_REQUIRED' } } }); };
  await assert.rejects(syncAllPages(call as never, 'tok', 'c0'));
});
