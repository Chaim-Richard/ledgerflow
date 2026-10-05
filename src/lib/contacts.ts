/**
 * Customer and vendor extras (Y-21 Y-22 Y-24 Y-25): the people to deal with at a company, tags,
 * and a notes timeline. Pure helpers shared by the contact form and the contact page.
 */

export interface ContactPerson {
  name: string;
  email?: string;
  phone?: string;
  /** e.g. "Accounts payable", "Owner" */
  role?: string;
}

export interface ContactNote {
  id: string;
  text: string;
  /** ISO time */
  at: string;
  /** who wrote it (email or name) */
  by?: string;
}

export const MAX_NOTES = 200;
export const MAX_NOTE_LENGTH = 2000;

/** "vip, wholesale , VIP" → ['vip', 'wholesale']: trimmed, no empties, no repeats (any case). */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(',')) {
    const tag = raw.trim().replace(/\s+/g, ' ').slice(0, 40);
    const key = tag.toLocaleLowerCase();
    if (tag && !seen.has(key)) { seen.add(key); out.push(tag); }
  }
  return out.slice(0, 20);
}

/** Contact people with a name, fields trimmed. */
export function cleanContacts(people: ContactPerson[]): ContactPerson[] {
  return people
    .map(p => ({ name: p.name.trim(), email: (p.email || '').trim().toLowerCase(), phone: (p.phone || '').trim(), role: (p.role || '').trim() }))
    .filter(p => p.name)
    .map(p => Object.fromEntries(Object.entries(p).filter(([, v]) => v)) as unknown as ContactPerson)
    .slice(0, 20);
}

/** The notes with a new one first (empty text: unchanged), at most MAX_NOTES kept. */
export function addNote(notes: ContactNote[] | undefined, text: string, by: string | undefined, now: string, id: string): ContactNote[] {
  const body = text.trim().slice(0, MAX_NOTE_LENGTH);
  if (!body) return notes || [];
  return [{ id, text: body, at: now, ...(by ? { by } : {}) }, ...(notes || [])].slice(0, MAX_NOTES);
}

/** Every tag used by these contacts, sorted, for the filter chips. */
export function allTags(parties: Array<{ tags?: string[] }>): string[] {
  const byKey = new Map<string, string>();
  for (const p of parties) for (const t of p.tags || []) if (!byKey.has(t.toLocaleLowerCase())) byKey.set(t.toLocaleLowerCase(), t);
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

/** True when the contact has the tag (any case); no tag chosen matches everyone. */
export const hasTag = (party: { tags?: string[] }, tag: string | null) =>
  !tag || (party.tags || []).some(t => t.toLocaleLowerCase() === tag.toLocaleLowerCase());

/** An archived customer or vendor (I-22): kept on its records, hidden from lists unless asked. */
export function isArchivedParty(party: { status?: string }): boolean {
  return party.status === 'inactive' || party.status === 'archived';
}
