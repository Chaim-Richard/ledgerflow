export interface Bookmark { tab: string; sub?: string }
export interface BookmarkRegistry { tabs: readonly string[]; reports: readonly string[]; settings: readonly string[] }
export const MAX_BOOKMARKS = 40;
export const bookmarkKey = (page: Bookmark) => JSON.stringify([page.tab, page.sub || '']);
export const bookmarkStorageKey = (uid: string, workspace: string) => `ledgerflow:bookmarks:v1:${JSON.stringify([uid, workspace])}`;
export function validBookmark(value: unknown, registry: BookmarkRegistry): Bookmark | null {
  if (!value || typeof value !== 'object') return null;
  const page = value as Partial<Bookmark>;
  if (typeof page.tab !== 'string' || !registry.tabs.includes(page.tab)) return null;
  if (page.sub !== undefined) {
    if (typeof page.sub !== 'string') return null;
    const subs = page.tab === 'reports' ? registry.reports : page.tab === 'settings' ? registry.settings : [];
    if (!subs.includes(page.sub)) return null;
  }
  return page.sub ? { tab: page.tab, sub: page.sub } : { tab: page.tab };
}
export function parseBookmarks(raw: string | null, registry: BookmarkRegistry): Bookmark[] {
  try {
    const data: unknown = JSON.parse(raw || 'null');
    if (!data || typeof data !== 'object' || (data as { version?: unknown }).version !== 1 || !Array.isArray((data as { pages?: unknown }).pages)) return [];
    const found = new Set<string>();
    return ((data as { pages: unknown[] }).pages).flatMap(item => {
      const page = validBookmark(item, registry);
      if (!page || found.has(bookmarkKey(page))) return [];
      found.add(bookmarkKey(page)); return [page];
    }).slice(0, MAX_BOOKMARKS);
  } catch { return []; }
}
export function reorderBookmark(pages: Bookmark[], key: string, delta: -1 | 1): Bookmark[] {
  const index = pages.findIndex(page => bookmarkKey(page) === key), target = index + delta;
  if (index < 0 || target < 0 || target >= pages.length) return pages;
  const next = [...pages]; [next[index], next[target]] = [next[target], next[index]]; return next;
}
