/**
 * The workspace switcher (K-34): find and enter the right books in seconds. Type to filter (any
 * part of the name, Hebrew too, vowel marks ignored), the most recently opened first, then by name,
 * each with the person's role there. Only the workspaces the person belongs to (the list they
 * already have). Which were opened last is kept in this browser only.
 */
import { normalizeSearchText } from './textNormalization';
import { workspaceRole } from './periodLock';

export interface SwitcherRow { id: string; name: string; role: string; currency?: string; current: boolean }

const KEY = 'lf_recent_workspaces';
const KEEP = 20;

/** The workspace ids opened most recently, newest first (empty when the browser keeps nothing). */
export function recentWorkspaceIds(): string[] {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Remember that a workspace was opened now. */
export function rememberWorkspace(id: string): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify([id, ...recentWorkspaceIds().filter(x => x !== id)].slice(0, KEEP)));
  } catch {
    // private window or storage blocked: the order falls back to names
  }
}

export function switcherRows(
  workspaces: Array<{ id: string; name?: string; uid?: string; roles?: Record<string, string>; currency?: string }>,
  opts: { uid: string; query?: string; recent?: string[]; currentId?: string | null },
): SwitcherRow[] {
  const q = normalizeSearchText(opts.query || '').trim();
  const recent = opts.recent || [];
  const rank = (id: string) => { const i = recent.indexOf(id); return i === -1 ? Number.MAX_SAFE_INTEGER : i; };
  return workspaces
    .filter(w => !q || normalizeSearchText(w.name || w.id).includes(q))
    .map(w => ({ id: w.id, name: w.name || w.id, role: workspaceRole(w as Parameters<typeof workspaceRole>[0], opts.uid), ...(w.currency ? { currency: w.currency } : {}), current: w.id === opts.currentId }))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
}
