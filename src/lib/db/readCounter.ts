/**
 * Rows read from the database by this browser tab (C-17), per table: counted where every list and
 * document read goes through (firestore.ts `fetchRows` and `getDoc`), and shown under the developer
 * switch (Settings → Developer), so a screen that reads far more than it shows stands out. Counting
 * is a few additions per read; nothing leaves the browser.
 */
const counts = new Map<string, { rows: number; reads: number }>();
const listeners = new Set<() => void>();
let version = 0;
const changed = () => { version += 1; for (const l of listeners) l(); };

/** Changes whenever a count does (for React's useSyncExternalStore). */
export const readVersion = () => version;

export function recordRead(table: string, rows: number): void {
  const c = counts.get(table) || { rows: 0, reads: 0 };
  c.rows += rows;
  c.reads += 1;
  counts.set(table, c);
  changed();
}

/** Each table read from, the most rows first. */
export function readCounts(): Array<{ table: string; rows: number; reads: number }> {
  return [...counts].map(([table, c]) => ({ table, ...c })).sort((a, b) => b.rows - a.rows || a.table.localeCompare(b.table));
}

export function resetReadCounts(): void {
  counts.clear();
  changed();
}

export function onReadCounts(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
