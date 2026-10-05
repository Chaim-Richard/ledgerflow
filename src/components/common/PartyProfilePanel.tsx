import React, { useId, useState } from 'react';
import { Mail, Pencil, Phone, StickyNote, Tag, UserRound } from 'lucide-react';
import { useEntityOperations } from '../../hooks/useEntityOperations';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import { addNote, MAX_NOTE_LENGTH } from '../../lib/contacts';
import { formatDate } from '../../lib/utils';
import PartyModal from './PartyModal';
import type { PartySide } from './PartyModal';
import type { Customer, Vendor } from '../../types';

/**
 * On a customer's or vendor's page: address, default currency, tags and the people to contact,
 * an Edit button (the shared contact form), and a notes timeline (Y-21 Y-22 Y-24 Y-25). Viewers
 * read; other roles edit and add notes.
 */
export default function PartyProfilePanel({ side, party }: { side: PartySide; party: Customer | Vendor }) {
  const id = useId();
  const { updateEntity } = useEntityOperations();
  const user = useAuthStore(s => s.user);
  const workspaceCurrency = useAuthStore(s => s.getCurrentWorkspace()?.currency) || 'USD';
  const canEdit = useCurrentRole() !== 'viewer';
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const path = side === 'customer' ? 'customers' : 'vendors';
  const notes = party.noteLog || [];

  const saveNote = async () => {
    if (!note.trim()) return;
    const next = addNote(notes, note, user?.email || undefined, new Date().toISOString(), crypto.randomUUID());
    await updateEntity(path, party.id, { noteLog: next }, 'Note added');
    setNote('');
  };

  return (
    <section aria-labelledby={`${id}-title`} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <h2 id={`${id}-title`} className="font-bold text-slate-900 dark:text-white text-sm">Details</h2>
        {canEdit && (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            <Pencil aria-hidden="true" className="w-3.5 h-3.5" /> Edit {side}
          </button>
        )}
      </div>

      <dl className="grid gap-3 sm:grid-cols-3 text-xs">
        <div>
          <dt className="text-[var(--muted)] font-semibold">Address</dt>
          <dd className="whitespace-pre-line text-slate-900 dark:text-white">{party.address || '—'}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)] font-semibold">New {side === 'customer' ? 'invoices' : 'bills'} in</dt>
          <dd className="text-slate-900 dark:text-white">{party.currency || `${workspaceCurrency} (home)`}</dd>
        </div>
        <div>
          <dt className="text-[var(--muted)] font-semibold">Tags</dt>
          <dd className="flex flex-wrap gap-1">
            {(party.tags || []).length === 0 ? '—' : (party.tags || []).map(t => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <Tag aria-hidden="true" className="w-3 h-3" />{t}
              </span>
            ))}
          </dd>
        </div>
      </dl>

      {(party.contacts || []).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[var(--muted)] mb-2">People to contact</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {(party.contacts || []).map(p => (
              <li key={`${p.name}|${p.email || ''}|${p.phone || ''}|${p.role || ''}`} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1"><UserRound aria-hidden="true" className="w-3.5 h-3.5" />{p.name}{p.role ? <span className="text-[var(--muted)] font-normal"> · {p.role}</span> : null}</div>
                {p.email && <a href={`mailto:${p.email}`} className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400"><Mail aria-hidden="true" className="w-3 h-3" />{p.email}</a>}
                {p.phone && <div className="flex items-center gap-1 text-[var(--muted)]"><Phone aria-hidden="true" className="w-3 h-3" />{p.phone}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold text-[var(--muted)] mb-2 flex items-center gap-1"><StickyNote aria-hidden="true" className="w-3.5 h-3.5" /> Notes</h3>
        {canEdit && (
          <div className="flex gap-2 mb-3">
            <label htmlFor={`${id}-note`} className="sr-only">New note</label>
            <textarea id={`${id}-note`} rows={2} maxLength={MAX_NOTE_LENGTH} value={note} onChange={e => setNote(e.target.value)} placeholder="Called about the late invoice; promised payment Friday" className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white" />
            <button type="button" onClick={saveNote} disabled={!note.trim()} className="self-start px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white disabled:opacity-50">Add note</button>
          </div>
        )}
        {notes.length === 0 ? <p className="text-xs text-[var(--muted)]">No notes yet.</p> : (
          <ol className="space-y-2">
            {notes.map(n => (
              <li key={n.id} className="text-xs border-l-2 border-indigo-300 pl-3">
                <p className="whitespace-pre-line text-slate-900 dark:text-white">{n.text}</p>
                <p className="text-[var(--muted)]">{formatDate(n.at)} {new Date(n.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{n.by ? ` · ${n.by}` : ''}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <PartyModal
        side={side}
        isOpen={editing}
        initial={party}
        onClose={() => setEditing(false)}
        onSave={async ({ id: partyId, ...changes }) => {
          setEditing(false);
          await updateEntity(path, partyId || party.id, changes, `${side === 'customer' ? 'Customer' : 'Vendor'} updated`);
        }}
      />
    </section>
  );
}
