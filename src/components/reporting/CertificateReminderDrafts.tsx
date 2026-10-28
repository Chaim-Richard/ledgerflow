import { useMemo, useState } from 'react';
import { Mail, Copy } from 'lucide-react';
import { certificateReminderRows, type CertificateReminderRow, type ReminderLanguage } from '../../lib/tax/certificateReminder';

/**
 * C-83: the reminder drafts for the customers whose tax certificate expired, is about to expire, or
 * has no expiry recorded. Read-only text with a copy button and, when the customer has an email, the
 * reader's own mail app — nothing is sent from here, and the letter says it is a request, not a
 * decision about the customer's tax status.
 */
export default function CertificateReminderDrafts({ rows, today, entityName, emailsTrusted = false }: {
  rows: CertificateReminderRow[];
  today: string;
  entityName?: string;
  /**
   * True only for a confirmed, complete read of the customers. When the list has changed since the
   * last complete read, the addresses in it may be out of date, so the drafts are still offered for
   * copying but no mail link is built from them.
   */
  emailsTrusted?: boolean;
}) {
  const [language, setLanguage] = useState<ReminderLanguage>('en');
  // what was copied, per customer record; cleared when the letter's language changes
  const [copied, setCopied] = useState('');
  const [failed, setFailed] = useState('');
  const drafts = useMemo(
    () => certificateReminderRows(emailsTrusted ? rows : rows.map(row => ({ ...row, email: undefined })), language, { entityName, today }),
    [rows, language, entityName, today, emailsTrusted],
  );
  const hasEmail = drafts.some(draft => draft.mailto);

  const copy = async (id: string, text: string) => {
    setFailed('');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
    } catch {
      // no silent nothing: a reader whose clipboard is refused has to select the letter by hand
      setCopied('');
      setFailed(id);
    }
  };
  const changeLanguage = (next: ReminderLanguage) => {
    // the letters are rewritten, so a previous copy is no longer the one on the clipboard
    setLanguage(next); setCopied(''); setFailed('');
  };

  return (
    <section aria-labelledby="certificate-reminders-title" className="mt-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="certificate-reminders-title" className="text-sm font-bold">Reminder drafts</h2>
        <label className="text-xs">Letter language{' '}
          <select className="min-h-11 border rounded px-2 bg-[var(--panel)]" value={language} onChange={event => changeLanguage(event.target.value === 'he' ? 'he' : 'en')}>
            <option value="en">English</option>
            <option value="he">עברית</option>
          </select>
        </label>
      </div>
      <p className="text-xs text-[var(--muted)]">
        A draft only: copy it or open it in your own mail app. Nothing is sent, filed or changed here, and the letter does not decide the customer’s tax status. Customers whose saved certificate cannot be read are left out — fix the record on the customer first.
        {!emailsTrusted && !hasEmail && ' No saved email is used until the customers are read completely again: use Refresh complete customers above to open a letter in your mail app.'}
      </p>
      {!drafts.length && <p className="text-sm text-[var(--muted)]">No certificate needs a reminder: none is expired or expiring within 30 days, and every saved certificate has an expiry.</p>}
      <ul className="space-y-3">
        {drafts.map(draft => (
          <li key={draft.id} className="rounded-xl border border-[var(--line)] p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* the customer's name stays inside a sentence, so it is never a second bare label for the same record */}
              <h3 className="text-sm font-bold" dir="auto">Reminder for {draft.customer}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => void copy(draft.id, `${draft.subject}\n\n${draft.body}`)}
                  className="inline-flex items-center gap-1 min-h-11 px-3 text-xs border rounded-lg">
                  <Copy aria-hidden="true" size={14} /> Copy letter
                </button>
                {draft.mailto
                  ? <a className="inline-flex items-center gap-1 min-h-11 px-3 text-xs border rounded-lg" href={draft.mailto}>Open in mail app<span className="sr-only"> for {draft.customer}</span></a>
                  : <span className="text-xs text-[var(--muted)] inline-flex items-center gap-1"><Mail aria-hidden="true" size={14} /> No email saved — copy the letter</span>}
              </div>
            </div>
            <p className="text-xs font-semibold"><bdi dir="auto">{draft.subject}</bdi></p>
            <pre className="text-xs whitespace-pre-wrap break-words bg-[var(--ink)]/40 rounded-lg p-3" dir={draft.language === 'he' ? 'rtl' : 'ltr'}><bdi dir="auto">{draft.body}</bdi></pre>
            {copied === draft.id && <p role="status" className="text-xs text-emerald-700 dark:text-emerald-400">The letter is on the clipboard.</p>}
            {failed === draft.id && <p role="alert" className="text-xs text-[var(--neg)]">Your browser refused the clipboard: select the letter above and copy it by hand.</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
