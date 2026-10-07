import React, { useId, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, ExternalLink, MessageCircleQuestion, Send } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { MAX_REPLY, STATUS_LABEL, replyProblem, type ClientQuery } from '../../lib/clientQueries';
import { closeQuery, replyToQuery } from '../../services/clientQueryActions';

/**
 * One question about an entry (BD-07) as a short conversation: who asked, the answers and
 * follow-ups, a box to answer (or follow up, for the asker) and Close. Used on the Questions screen
 * and in the entry's edit window.
 */
interface Props {
  query: ClientQuery;
  workspaceId: string;
  uid: string;
  role: string;
  /** The Questions screen shows which entry; the entry's own window does not need to. */
  onOpenEntry?: (transactionId: string) => void;
  /** Called after an answer or a close (a list that is not live reads again). */
  onChanged?: () => void;
}

const STATUS_STYLE: Record<ClientQuery['status'], string> = {
  open: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200',
  answered: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200',
  closed: 'bg-[var(--ink)] text-[var(--muted)]',
};

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

export default function ClientQueryThread({ query, workspaceId, uid, role, onOpenEntry, onChanged }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'' | 'reply' | 'close'>('');
  const boxId = useId();
  const isAsker = query.askedBy === uid;
  const mayClose = isAsker || role === 'owner' || role === 'accountant';
  const who = (m: { uid: string; email?: string }) => (m.uid === uid ? 'You' : m.email || 'A team member');

  const send = async () => {
    const problem = replyProblem(text);
    if (problem) { toast.error(problem); return; }
    setBusy('reply');
    try {
      await replyToQuery(workspaceId, query.id, text);
      setText('');
      onChanged?.();
      toast.success(isAsker ? 'Follow-up sent' : 'Answer sent');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally { setBusy(''); }
  };

  const close = async () => {
    setBusy('close');
    try {
      await closeQuery(workspaceId, query.id);
      onChanged?.();
      toast.success('Question closed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally { setBusy(''); }
  };

  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3" aria-label={`Question about ${query.entry?.description || 'an entry'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {onOpenEntry && (
            <p className="text-sm font-semibold text-[var(--text)] flex flex-wrap items-center gap-x-2">
              <MessageCircleQuestion className="w-4 h-4 text-[var(--muted)] shrink-0" aria-hidden="true" />
              <span className="tabular-nums">{query.entry?.date}</span>
              <bdi className="truncate">{query.entry?.description || 'Entry'}</bdi>
              <span className="tabular-nums">{formatCurrency(query.entry?.amountCents || 0, query.entry?.currency || 'USD')}</span>
            </p>
          )}
          <p className="text-xs text-[var(--muted)]">Asked by {who({ uid: query.askedBy, email: query.askedByEmail })} · {when(query.askedAt)}</p>
        </div>
        <span className={cn('text-xs font-semibold rounded-full px-2.5 py-1', STATUS_STYLE[query.status])}>{STATUS_LABEL[query.status]}</span>
      </div>

      <ol className="space-y-2" aria-label="Conversation">
        {(query.messages || []).map(m => (
          <li key={`${m.at}-${m.uid}`} className={cn('rounded-xl px-3 py-2 text-sm', m.uid === query.askedBy ? 'bg-[var(--ink)]' : 'bg-indigo-50 dark:bg-indigo-500/10')}>
            <p className="text-xs text-[var(--muted)]">{who(m)} · {when(m.at)}</p>
            <p className="whitespace-pre-wrap break-words text-[var(--text)]"><bdi>{m.text}</bdi></p>
          </li>
        ))}
      </ol>

      {query.status !== 'closed' && (
        <div className="space-y-2">
          <label htmlFor={boxId} className="text-xs font-semibold text-[var(--muted)]">{isAsker ? 'Add a follow-up' : 'Your answer'}</label>
          <textarea
            id={boxId}
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={MAX_REPLY}
            rows={2}
            className="w-full rounded-xl border border-[var(--line)] bg-[var(--ink)] px-3 py-2 text-sm text-[var(--text)]"
          />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {onOpenEntry && (
              <button type="button" onClick={() => onOpenEntry(query.transactionId)} className="mr-auto inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Open the entry
              </button>
            )}
            {mayClose && (
              <button type="button" onClick={close} disabled={busy !== ''} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-1.5 text-xs font-semibold text-[var(--text)] disabled:opacity-50">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> {busy === 'close' ? 'Closing…' : 'Close the question'}
              </button>
            )}
            <button type="button" onClick={send} disabled={busy !== '' || !text.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--text)] px-3 py-1.5 text-xs font-semibold text-[var(--surface)] disabled:opacity-50">
              <Send className="w-3.5 h-3.5" aria-hidden="true" /> {busy === 'reply' ? 'Sending…' : isAsker ? 'Send follow-up' : 'Send answer'}
            </button>
          </div>
        </div>
      )}
      {query.status === 'closed' && onOpenEntry && (
        <button type="button" onClick={() => onOpenEntry(query.transactionId)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Open the entry
        </button>
      )}
    </article>
  );
}
