import React, { useState } from 'react';
import { MessageCircleQuestion } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUIStore } from '../../stores/useUIStore';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import { cn } from '../../lib/utils';
import { filterQueries, type QueryFilter } from '../../lib/clientQueries';
import { useClientQueries } from '../../services/clientQueryActions';
import { LoadingState } from '../ui/LoadingState';
import ClientQueryThread from './ClientQueryThread';

/**
 * Questions about entries (BD-07): every question asked about an entry in this workspace, the
 * waiting ones first. Answer, follow up or close right here; a question is asked from the entry's
 * edit window ("Ask about this entry").
 */
const FILTERS: Array<{ id: QueryFilter; label: string }> = [
  { id: 'waiting', label: 'Waiting' },
  { id: 'answered', label: 'Answered' },
  { id: 'closed', label: 'Closed' },
  { id: 'all', label: 'All' },
];

const EMPTY: Record<QueryFilter, string> = {
  waiting: 'Nothing is waiting for an answer.',
  answered: 'No answered questions to look at.',
  closed: 'No closed questions yet.',
  all: 'No questions yet. Open an entry and use "Ask about this entry" to ask the owner what it was.',
};

export default function ClientQueriesView() {
  const workspaceId = useAuthStore(s => s.currentWorkspaceId) || '';
  const uid = useAuthStore(s => s.user?.uid) || '';
  const role = useCurrentRole();
  const openRecord = useUIStore(s => s.openRecord);
  const { queries, loading, failed } = useClientQueries(workspaceId);
  const [filter, setFilter] = useState<QueryFilter>('waiting');
  const shown = filterQueries(queries, filter);
  const count = (f: QueryFilter) => filterQueries(queries, f).length;

  return (
    <div className="h-full overflow-auto p-6 md:p-8" id="client-queries-view">
      <div className="max-w-4xl mx-auto space-y-5">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-[var(--text)] flex items-center gap-2">
            <MessageCircleQuestion className="w-6 h-6" aria-hidden="true" /> Questions about entries
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Ask the owner what an entry was without leaving the books: open the entry and use "Ask about this entry".
            Answers, follow-ups and closed questions show here, and each side gets a notification.
          </p>
        </header>

        <div role="group" aria-label="Show questions" className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold',
                filter === f.id ? 'border-[var(--text)] bg-[var(--text)] text-[var(--surface)]' : 'border-[var(--line)] text-[var(--text)]')}
            >
              {f.label}{!loading && !failed ? ` (${count(f.id)})` : ''}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingState what="questions" />
        ) : failed ? (
          <p role="alert" className="text-sm text-[var(--muted)]">The questions could not be loaded. Check the connection and open this page again.</p>
        ) : shown.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted)]">{EMPTY[filter]}</p>
        ) : (
          <div className="space-y-3">
            {shown.map(q => (
              <ClientQueryThread key={q.id} query={q} workspaceId={workspaceId} uid={uid} role={role}
                onOpenEntry={id => openRecord({ type: 'transaction', id })} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
