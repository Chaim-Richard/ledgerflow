import React, { useId, useState } from 'react';
import { toast } from 'sonner';
import { MessageCircleQuestion } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import { ASKER_ROLES, MAX_QUESTION, questionProblem } from '../../lib/clientQueries';
import { askAboutEntry, useClientQueries } from '../../services/clientQueryActions';
import ClientQueryThread from '../ledger/ClientQueryThread';

/**
 * "Ask about this entry" (BD-07) in the entry's edit window: the questions already asked about it,
 * with their answers, and a box for owners, accountants and bookkeepers to ask a new one. The owner
 * is notified and answers here or on the Questions screen.
 */
export default function EntryQuestions({ transactionId }: { transactionId: string }) {
  const workspaceId = useAuthStore(s => s.currentWorkspaceId) || '';
  const uid = useAuthStore(s => s.user?.uid) || '';
  const role = useCurrentRole();
  const { queries } = useClientQueries(workspaceId, transactionId);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const boxId = useId();
  const mayAsk = ASKER_ROLES.includes(role);

  if (!workspaceId || (!mayAsk && queries.length === 0)) return null;

  const ask = async () => {
    const problem = questionProblem(question);
    if (problem) { toast.error(problem); return; }
    setBusy(true);
    try {
      await askAboutEntry(workspaceId, transactionId, question);
      setQuestion('');
      setAsking(false);
      toast.success('Question sent. The owner gets a notification.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally { setBusy(false); }
  };

  return (
    <section aria-labelledby={`${boxId}-title`} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`${boxId}-title`} className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
          <MessageCircleQuestion className="w-4 h-4" aria-hidden="true" />
          Questions about this entry{queries.length ? ` (${queries.length})` : ''}
        </h3>
        {mayAsk && !asking && (
          <button type="button" onClick={() => setAsking(true)} className="rounded-xl border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] hover:bg-[var(--ink)]">
            Ask about this entry
          </button>
        )}
      </div>
      {asking && (
        <div className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--ink)] p-3">
          <label htmlFor={boxId} className="text-xs font-semibold text-[var(--muted)]">Your question for the owner (for example: what was this for, and which receipt goes with it?)</label>
          <textarea id={boxId} value={question} onChange={e => setQuestion(e.target.value)} maxLength={MAX_QUESTION} rows={3}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setAsking(false); setQuestion(''); }} className="px-3 py-1.5 text-xs font-semibold text-[var(--muted)]">Cancel</button>
            <button type="button" onClick={ask} disabled={busy || question.trim().length < 3} className="rounded-xl bg-[var(--text)] px-3 py-1.5 text-xs font-semibold text-[var(--surface)] disabled:opacity-50">
              {busy ? 'Sending…' : 'Send question'}
            </button>
          </div>
        </div>
      )}
      {queries.map(q => <ClientQueryThread key={q.id} query={q} workspaceId={workspaceId} uid={uid} role={role} />)}
    </section>
  );
}
