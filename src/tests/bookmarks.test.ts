import test from 'node:test';
import assert from 'node:assert/strict';
import { bookmarkKey, bookmarkStorageKey, parseBookmarks, reorderBookmark, validBookmark } from '../lib/bookmarks';
const registry = { tabs: ['dashboard', 'reports', 'settings'], reports: ['pnl', 'ar-aging'], settings: ['security'] };
test('bookmarks validate destinations, deduplicate and strip extra data without normalizing IDs', () => {
  const pages = parseBookmarks(JSON.stringify({ version: 1, pages: [{ tab: 'reports', sub: 'pnl', token: 'discard' }, { tab: 'reports', sub: 'pnl' }, { tab: 'https://outside' }, { tab: 'reports', sub: 'security' }, { tab: 'dashboard', sub: 'pnl' }, { tab: 'settings', sub: 'security' }] }), registry);
  assert.deepEqual(pages, [{ tab: 'reports', sub: 'pnl' }, { tab: 'settings', sub: 'security' }]);
  assert.deepEqual(parseBookmarks('{broken', registry), []); assert.deepEqual(parseBookmarks('[]', registry), []);
  assert.equal(validBookmark({ tab: 'reports', sub: 'unknown' }, registry), null);
  assert.notEqual(bookmarkStorageKey('אדם', 'books'), bookmarkStorageKey('person', 'books'));
  assert.notEqual(bookmarkStorageKey('same', 'books-1'), bookmarkStorageKey('same', 'books-2'));
});
test('keyboard reorder preserves exact page targets and does not mutate saved input', () => {
  const original = [{ tab: 'dashboard' }, { tab: 'reports', sub: 'ar-aging' }, { tab: 'settings', sub: 'security' }];
  const next = reorderBookmark(original, bookmarkKey(original[1]), -1);
  assert.deepEqual(next, [original[1], original[0], original[2]]);
  assert.equal(original[0].tab, 'dashboard');
  assert.equal(reorderBookmark(original, 'missing', 1), original);
  assert.equal(reorderBookmark(original, bookmarkKey(original[0]), -1), original);
});
