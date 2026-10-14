/**
 * A-36 (tracker CD-06, CF-08): the notes panel — who wrote what, when, on one record. Notes are
 * plain and appended (threads and mentions are A-21's commentThreads); they live in the record's
 * own `metadata.recordNotes` and are saved through the existing updateEntity path, so a note
 * never changes an amount, a quantity or a posting. A note on a document in a locked period is
 * refused by the period lock like any other change to that document.
 */
import React, { useMemo, useState } from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useEntityOperations } from '../../hooks/useEntityOperations';
import {
  addRecordNote, editRecordNote, noteProblem, notePreview, notesForEntity, recordNotesFromMetadata,
  RECORD_NOTES_METADATA_KEY, searchRecordNotes,
  type NoteableType, type RecordNote,
} from '../../lib/recordNotes';

/** The store collection each kind of noteable record lives in (src/lib/ledgerCollections.ts). */
export const NOTE_COLLECTIONS = {
  customer: 'customers',
  vendor: 'vendors',
  item: 'inventory',
  invoice: 'invoices',
  bill: 'bills',
  estimate: 'estimates',
  transaction: 'transactions',
  project: 'projects',
} as const satisfies Record<NoteableType, string>;

export type NoteCollection = (typeof NOTE_COLLECTIONS)[NoteableType];

export interface RecordNotesPanelProps {
  entityType: NoteableType;
  entityId: string;
  /** The record's name, for labels and messages. */
  entityName: string;
  /** The record's loaded metadata (its `recordNotes` are the notes shown). */
  metadata?: Record<string, unknown> | null;
  /** False: the panel shows the notes but takes none (a viewer or a guest). */
  canEdit?: boolean;
}

function newNoteId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  return c?.randomUUID ? c.randomUUID() : `note_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
};

/** Notes on one record: newest first, with add and edit-own. */
export default function RecordNotesPanel({ entityType, entityId, entityName, metadata, canEdit = true }: RecordNotesPanelProps) {
  const workspaceId = useAuthStore(s => s.currentWorkspaceId) || '';
  const user = useAuthStore(s => s.user);
  const { updateEntity } = useEntityOperations();
  const collection = NOTE_COLLECTIONS[entityType];
  const [saved, setSaved] = useState<RecordNote[] | null>(null);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editDraft, setEditDraft] = useState('');
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');

  const notes = useMemo(
    () => (saved ?? recordNotesFromMetadata(metadata)).filter(n => n.entityType === entityType && n.entityId === entityId),
    [saved, metadata, entityType, entityId],
  );
  const shown = filter ? searchRecordNotes(notes, filter) : notes;
  const authorUid = user?.uid || '';
  const authorName = user?.displayName || user?.email || undefined;

  const save = async (next: RecordNote[], message: string): Promise<boolean> => {
    setBusy(true);
    try {
      await updateEntity(collection, entityId, {
        metadata: { ...(metadata || {}), [RECORD_NOTES_METADATA_KEY]: next },
      }, message);
      setSaved(next);
      return true;
    } catch {
      // the refusal was reported; the note is not shown as saved
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const text = draft;
    const refusal = noteProblem(text);
    if (refusal) { setProblem(refusal); return; }
    setProblem('');
    const note = addRecordNote({
      id: newNoteId(), workspaceId, entityType, entityId, body: text, authorUid, ...(authorName ? { authorName } : {}),
    });
    if (await save([...notes, note], `Note saved on ${entityName}`)) setDraft('');
  };

  const edit = async (note: RecordNote) => {
    const refusal = noteProblem(editDraft);
    if (refusal) { setProblem(refusal); return; }
    setProblem('');
    if (await save(notes.map(n => (n.id === note.id ? editRecordNote(note, editDraft) : n)), `Note updated on ${entityName}`)) {
      setEditingId('');
      setEditDraft('');
    }
  };

  return (
    <section aria-label={`Notes on ${entityName}`} className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text)]">Notes</h3>
      <p className="text-xs text-[var(--muted)]">
        Who wrote what, when, on <bdi>{entityName}</bdi>. Notes are kept on this record and never change an amount.
        Card numbers in a note are masked before it is saved.
      </p>

      {canEdit && (
        <div className="space-y-2" data-print-hide>
          <label className="flex flex-col gap-1 text-sm">
            New note
            <textarea
              aria-label={`New note on ${entityName}`}
              rows={3}
              value={draft}
              onChange={e => { setDraft(e.target.value); if (problem) setProblem(''); }}
              placeholder="What should someone know about this record?"
              className="w-full border rounded px-3 py-2 bg-[var(--panel)] text-[var(--text)]"
              dir="auto"
            />
          </label>
          {problem && <p role="alert" className="text-xs text-red-600">{problem}</p>}
          <button type="button" onClick={add} disabled={busy}
            className="min-h-11 px-4 rounded border border-[var(--line)] disabled:opacity-50">
            {busy ? 'Saving…' : 'Add note'}
          </button>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm max-w-sm">
        Search these notes
        <input type="search" aria-label={`Search notes on ${entityName}`} value={filter}
          onChange={e => setFilter(e.target.value)} placeholder="A word in the note or its author"
          className="min-h-11 border rounded px-3 bg-[var(--panel)] text-[var(--text)]" dir="auto" />
      </label>

      {shown.length === 0 && (
        <p className="text-sm text-[var(--muted)]">
          {notes.length === 0 ? 'No notes on this record yet.' : 'No note matches this search.'}
        </p>
      )}
      <ul className="space-y-2">
        {shown.map(note => (
          <li key={note.id} className="border border-[var(--line)] rounded p-2">
            <p className="text-xs text-[var(--muted)]">
              <bdi>{note.authorName || 'Someone'}</bdi>
              {' · '}
              <time dateTime={note.createdAt}>{when(note.createdAt)}</time>
              {note.editedAt ? ' · edited' : ''}
            </p>
            {editingId === note.id ? (
              <div className="space-y-2">
                <textarea aria-label={`Change note on ${entityName}`} rows={3} value={editDraft}
                  onChange={e => setEditDraft(e.target.value)}
                  className="w-full border rounded px-3 py-2 bg-[var(--panel)] text-[var(--text)]" dir="auto" />
                {problem && <p role="alert" className="text-xs text-red-600">{problem}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => edit(note)} disabled={busy}
                    className="min-h-11 px-3 rounded border border-[var(--line)] disabled:opacity-50">Save note</button>
                  <button type="button" onClick={() => { setEditingId(''); setProblem(''); }}
                    className="min-h-11 px-3 rounded border border-[var(--line)]">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm whitespace-pre-wrap" dir="auto">{note.body}</p>
                {canEdit && authorUid && note.authorUid === authorUid && (
                  <button type="button" data-print-hide
                    aria-label={`Change note on ${entityName}: ${notePreview(note)}`}
                    onClick={() => { setEditingId(note.id); setEditDraft(note.body); setProblem(''); }}
                    className="text-xs text-[var(--muted)] hover:underline">
                    Change
                  </button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
