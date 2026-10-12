/**
 * A-36 (tracker CD-06, CF-08): notes on any record — a customer, a vendor, an item, an invoice, a
 * bill, an estimate, a transaction or a project. Simple, appended notes (who, when) with a search
 * across everything recorded, so "why did we…" can be answered later.
 *
 * The notes are stored by the caller (the notes panel's own store); this module is the record's
 * rules: plain-word refusals, ordering and search. Comments with threads and mentions are A-21's
 * `commentThreads.ts`; this is the lighter note. Pure.
 */

export type NoteableType = 'customer' | 'vendor' | 'item' | 'invoice' | 'bill' | 'estimate' | 'transaction' | 'project';

export interface RecordNote {
  id: string;
  workspaceId: string;
  entityType: NoteableType;
  entityId: string;
  body: string;
  authorUid: string;
  authorName?: string;
  createdAt: string;
  editedAt?: string;
}

export const NOTE_MAX_LENGTH = 4000;

/** Why this text cannot be a note, in plain words, or null when it can. */
export function noteProblem(body: string): string | null {
  const text = String(body ?? '').trim();
  if (!text) return 'Write something first.';
  if (text.length > NOTE_MAX_LENGTH) return `A note can be up to ${NOTE_MAX_LENGTH} characters.`;
  return null;
}

/** A new note on a record. */
export function addRecordNote(
  input: { id: string; workspaceId: string; entityType: NoteableType; entityId: string; body: string; authorUid: string; authorName?: string },
  now: string = new Date().toISOString(),
): RecordNote {
  return {
    id: input.id, workspaceId: input.workspaceId, entityType: input.entityType, entityId: input.entityId,
    body: String(input.body).trim(), authorUid: input.authorUid,
    ...(input.authorName ? { authorName: input.authorName } : {}),
    createdAt: now,
  };
}

/** The note with its text changed; the first change time stands. */
export function editRecordNote(note: RecordNote, body: string, now: string = new Date().toISOString()): RecordNote {
  return { ...note, body: String(body).trim(), editedAt: note.editedAt || now };
}

/** One record's notes, newest first (what a panel shows). */
export function notesForEntity(notes: RecordNote[], entityType: NoteableType, entityId: string, workspaceId?: string): RecordNote[] {
  return notes
    .filter(n => n.entityType === entityType && n.entityId === entityId && (!workspaceId || n.workspaceId === workspaceId))
    .sort((a, b) => (a.createdAt === b.createdAt ? b.id.localeCompare(a.id) : b.createdAt.localeCompare(a.createdAt)));
}

/**
 * Search every note (newest first). The words are matched against the note's text, the author's
 * name and the record it is on; every word must appear somewhere — a phrase with two words finds
 * notes that have both, in any order. An empty query finds every note.
 */
export function searchRecordNotes(notes: RecordNote[], query: string): RecordNote[] {
  const words = String(query ?? '').toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const haystack = (n: RecordNote) => `${n.body} ${n.authorName || ''} ${n.entityType} ${n.entityId}`.toLocaleLowerCase();
  return notes
    .filter(n => words.every(w => haystack(n).includes(w)))
    .sort((a, b) => (a.createdAt === b.createdAt ? b.id.localeCompare(a.id) : b.createdAt.localeCompare(a.createdAt)));
}

/** The first line of a note, shortened for a list (the panel's own preview). */
export function notePreview(note: Pick<RecordNote, 'body'>, max = 80): string {
  const firstLine = String(note.body).split('\n')[0].trim();
  return firstLine.length > max ? `${firstLine.slice(0, max - 1).trimEnd()}…` : firstLine;
}

/** How many notes a set of records has, by type — the little counts a notes panel shows. */
export function noteCountsByType(notes: RecordNote[]): Record<NoteableType, number> {
  const counts = { customer: 0, vendor: 0, item: 0, invoice: 0, bill: 0, estimate: 0, transaction: 0, project: 0 } as Record<NoteableType, number>;
  for (const note of notes) counts[note.entityType] += 1;
  return counts;
}
