import React, { useMemo, useState, useId } from 'react';
import { toast } from 'sonner';
import { Mail, RotateCcw } from 'lucide-react';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useCurrentRole } from '../../../hooks/useCurrentRole';
import { db } from '../../../firebase';
import { doc, updateDoc } from '../../../lib/db/firestore';
import {
  DEFAULT_TEMPLATES, EMAIL_TEMPLATE_KEYS, MAX_BODY, MAX_SUBJECT, PLACEHOLDERS, TEMPLATE_LABELS,
  renderEmail, resolveTemplate, unknownPlaceholders,
} from '../../../lib/emailTemplates';
import type { EmailTemplateKey, EmailTemplates } from '../../../lib/emailTemplates';
import { normalizeReminderSettings } from '../../../lib/reminders';
import { approvalLimitUnits, normalizeInvoiceApproval, parseApprovalLimit } from '../../../lib/invoiceApproval';
import { formatCurrency } from '../../../lib/utils';

/**
 * Settings → Emails & Reminders: the texts of the emails sent to customers (K-08), with a live
 * preview, the automatic payment reminder schedule (BE-01, K-26) and the invoice approval limit
 * (BE-04). Owners and accountants edit; the server uses them when it sends
 * (documentEmailService.ts, reminderService.ts).
 */

const SAMPLE = {
  company: 'Your Company', customer: 'Acme Ltd', number: 'INV-1042', amount: '$1,250.00', amount_due: '$750.00',
  due_date: '2026-10-15', days_overdue: '14', link: 'https://example.com/i/sample',
};

const inputClass = 'w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] text-sm text-[var(--text)]';

export default function EmailSettings() {
  const formId = useId();
  const workspace = useAuthStore(s => s.getCurrentWorkspace());
  const workspaces = useAuthStore(s => s.workspaces);
  const setWorkspaces = useAuthStore(s => s.setWorkspaces);
  const role = useCurrentRole();
  const canEdit = role === 'owner' || role === 'accountant';

  const [key, setKey] = useState<EmailTemplateKey>('invoice');
  const [drafts, setDrafts] = useState<EmailTemplates>(() => workspace?.emailTemplates || {});
  const [reminders, setReminders] = useState(() => normalizeReminderSettings(workspace?.reminderSettings));
  const [approval, setApproval] = useState(() => normalizeInvoiceApproval(workspace?.invoiceApproval));
  const [limitText, setLimitText] = useState(() => approvalLimitUnits(normalizeInvoiceApproval(workspace?.invoiceApproval).thresholdCents));
  const [daysText, setDaysText] = useState(() => normalizeReminderSettings(workspace?.reminderSettings).daysAfterDue.join(', '));
  const [saving, setSaving] = useState(false);

  const current = resolveTemplate(key, drafts);
  const preview = useMemo(() => renderEmail(current, SAMPLE), [current]);
  const unknown = unknownPlaceholders(`${current.subject} ${current.body}`);

  const save = async (fields: Record<string, unknown>, message: string) => {
    if (!workspace?.id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'workspaces', workspace.id), { ...fields, updatedAt: new Date().toISOString() });
      setWorkspaces(workspaces.map(w => (w.id === workspace.id ? { ...w, ...fields } : w)));
      toast.success(message);
    } catch {
      toast.error('Could not save (owners and accountants can change these settings).');
    } finally {
      setSaving(false);
    }
  };

  const editTemplate = (field: 'subject' | 'body', value: string) => setDrafts(d => ({ ...d, [key]: { ...(d[key] || {}), [field]: value } }));
  const resetTemplate = () => setDrafts(d => {
    const next = { ...d };
    delete next[key];
    return next;
  });

  /**
   * BE-04: the approval rule. A limit that is not a number leaves the rule off — the app never
   * invents a threshold, the same way it never invents an exchange rate.
   */
  const saveApproval = () => {
    const settings = normalizeInvoiceApproval({ enabled: approval.enabled, thresholdCents: parseApprovalLimit(limitText) });
    setApproval(settings);
    setLimitText(approvalLimitUnits(settings.thresholdCents));
    save({ invoiceApproval: settings }, settings.enabled
      ? `Invoices over ${formatCurrency(settings.thresholdCents, workspace?.currency)} now wait for an owner's or an accountant's approval before they are emailed.`
      : 'Invoice approval is off: every saved invoice can be emailed straight away.');
  };

  const saveReminders = () => {
    const days = daysText.split(/[,\s]+/).filter(Boolean).map(Number);
    const settings = normalizeReminderSettings({ enabled: reminders.enabled, daysAfterDue: days, thankYou: reminders.thankYou, monthlyStatements: reminders.monthlyStatements });
    setReminders(settings);
    setDaysText(settings.daysAfterDue.join(', '));
    save({ reminderSettings: settings }, `${settings.enabled ? `Reminders on: ${settings.daysAfterDue.join(', ')} days after the due date.` : 'Automatic reminders are off.'} ${settings.thankYou ? 'Thank-you emails on.' : 'No thank-you emails.'} ${settings.monthlyStatements ? 'Monthly statements on.' : ''}`.trim());
  };

  return (
    <div className="space-y-8">
      <section className="ledger-card p-6 md:p-8 bg-[var(--surface)] border border-[var(--line)] rounded-2xl space-y-5" aria-labelledby={`${formId}-email-templates`}>
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-[var(--brass)]" aria-hidden="true" />
          <div>
            <h2 id={`${formId}-email-templates`} className="text-lg font-bold text-[var(--text)]">Email templates</h2>
            <p className="text-xs text-[var(--muted)]">The text of the emails your customers receive. A plain-text version is always sent with it.</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Email templates">
          {EMAIL_TEMPLATE_KEYS.map(k => (
            <button key={k} type="button" role="tab" aria-selected={key === k} onClick={() => setKey(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${key === k ? 'border-[var(--brass)] bg-[var(--brass-soft)] text-[var(--text)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>
              {TEMPLATE_LABELS[k]}{drafts[k] ? ' ·' : ''}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div>
              <label htmlFor={`${formId}-tpl-subject`} className="block text-xs font-semibold text-[var(--text)] mb-1">Subject</label>
              <input id={`${formId}-tpl-subject`} maxLength={MAX_SUBJECT} disabled={!canEdit} value={drafts[key]?.subject ?? DEFAULT_TEMPLATES[key].subject}
                onChange={e => editTemplate('subject', e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor={`${formId}-tpl-body`} className="block text-xs font-semibold text-[var(--text)] mb-1">Text</label>
              <textarea id={`${formId}-tpl-body`} rows={12} maxLength={MAX_BODY} disabled={!canEdit} value={drafts[key]?.body ?? DEFAULT_TEMPLATES[key].body}
                onChange={e => editTemplate('body', e.target.value)} className={`${inputClass} font-mono text-xs`} />
            </div>
            <p className="text-[11px] text-[var(--muted)]">You can use: {PLACEHOLDERS.map(p => `{{${p}}}`).join(' ')}</p>
            {unknown.length > 0 && <p className="text-xs text-[var(--neg)]" role="alert">Unknown: {unknown.map(p => `{{${p}}}`).join(', ')} (it will be sent as written)</p>}
            {canEdit && (
              <div className="flex gap-2">
                <button type="button" disabled={saving} onClick={() => save({ emailTemplates: drafts }, 'Email templates saved.')}
                  className="px-4 py-2 rounded-lg bg-[var(--brass)] text-[var(--ink)] text-sm font-bold disabled:opacity-50">Save templates</button>
                <button type="button" onClick={resetTemplate} className="px-3 py-2 rounded-lg border border-[var(--line)] text-sm text-[var(--text)] inline-flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4" aria-hidden="true" /> Use the default
                </button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--muted)]">Preview (sample invoice)</p>
            <div className="rounded-xl border border-[var(--line)] bg-white text-slate-800 overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-200 text-xs"><strong>Subject:</strong> {preview.subject}</div>
              {/* The preview HTML is built from escaped text by renderEmail */}
              <div className="text-sm" dangerouslySetInnerHTML={{ __html: preview.html }} />
            </div>
          </div>
        </div>
      </section>

      <section className="ledger-card p-6 md:p-8 bg-[var(--surface)] border border-[var(--line)] rounded-2xl space-y-4" aria-labelledby={`${formId}-reminders`}>
        <div>
          <h2 id={`${formId}-reminders`} className="text-lg font-bold text-[var(--text)]">Automatic payment reminders</h2>
          <p className="text-xs text-[var(--muted)]">Customers with an overdue invoice get the "Payment reminder" email on these days after the due date (checked every morning).</p>
        </div>
        <label htmlFor={`${formId}-enabled`} className="flex items-center gap-2 text-sm text-[var(--text)]">
          <input id={`${formId}-enabled`} type="checkbox" disabled={!canEdit} checked={reminders.enabled} onChange={e => setReminders({ ...reminders, enabled: e.target.checked })} />
          Send reminders automatically
        </label>
        <div className="max-w-sm">
          <label htmlFor={`${formId}-reminder-days`} className="block text-xs font-semibold text-[var(--text)] mb-1">Days after the due date</label>
          <input id={`${formId}-reminder-days`} disabled={!canEdit} value={daysText} onChange={e => setDaysText(e.target.value)} placeholder="3, 14, 30" className={inputClass} />
        </div>
        <label htmlFor={`${formId}-thanks`} className="flex items-start gap-2 text-sm text-[var(--text)] pt-2 border-t border-[var(--line)]">
          <input id={`${formId}-thanks`} type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(reminders.thankYou)} onChange={e => setReminders({ ...reminders, thankYou: e.target.checked })} />
          <span>
            Email a thank-you when a customer pays
            <span className="block text-xs text-[var(--muted)]">Uses the &quot;Payment received (thank you)&quot; email above, for payments recorded by hand, from a bank line or online.</span>
          </span>
        </label>
        <label htmlFor={`${formId}-statements`} className="flex items-start gap-2 text-sm text-[var(--text)]">
          <input id={`${formId}-statements`} type="checkbox" className="mt-1" disabled={!canEdit} checked={Boolean(reminders.monthlyStatements)} onChange={e => setReminders({ ...reminders, monthlyStatements: e.target.checked })} />
          <span>
            Email each customer their statement on the 1st of every month
            <span className="block text-xs text-[var(--muted)]">Customers with something open, using the &quot;Customer statement&quot; email above. A customer can be left out on their page.</span>
          </span>
        </label>
        {canEdit && (
          <button type="button" disabled={saving} onClick={saveReminders} className="px-4 py-2 rounded-lg bg-[var(--brass)] text-[var(--ink)] text-sm font-bold disabled:opacity-50">Save automatic emails</button>
        )}
        {!canEdit && <p className="text-xs text-[var(--muted)]">Owners and accountants change these settings.</p>}
      </section>

      <section className="ledger-card p-6 md:p-8 bg-[var(--surface)] border border-[var(--line)] rounded-2xl space-y-4" aria-labelledby={`${formId}-approval`}>
        <div>
          <h2 id={`${formId}-approval`} className="text-lg font-bold text-[var(--text)]">Approval before an invoice goes out</h2>
          <p className="text-xs text-[var(--muted)]">
            A larger invoice is not emailed until an owner or an accountant has said yes. The invoice is saved,
            posted and counted as it always was — only the customer receiving it waits.
          </p>
        </div>
        <label htmlFor={`${formId}-approval-on`} className="flex items-center gap-2 text-sm text-[var(--text)]">
          <input id={`${formId}-approval-on`} type="checkbox" disabled={!canEdit} checked={approval.enabled}
            onChange={e => setApproval({ ...approval, enabled: e.target.checked })} />
          Require approval on invoices over a set amount
        </label>
        <div className="max-w-xs">
          <label htmlFor={`${formId}-approval-limit`} className="block text-xs font-semibold text-[var(--text)] mb-1">
            The amount, in {workspace?.currency || 'the workspace currency'}
          </label>
          <input id={`${formId}-approval-limit`} inputMode="decimal" disabled={!canEdit || !approval.enabled}
            value={limitText} onChange={e => setLimitText(e.target.value)} placeholder="2000" className={inputClass} />
        </div>
        <p className="text-xs text-[var(--muted)]">
          {approval.enabled && approval.thresholdCents > 0
            ? `Invoices above ${formatCurrency(approval.thresholdCents, workspace?.currency)} wait for a signature. Their payment reminders wait too.`
            : 'Turn this on and name an amount to hold big invoices back; leaving the amount empty keeps it off.'}
        </p>
        {canEdit && (
          <button type="button" disabled={saving} onClick={saveApproval} className="px-4 py-2 rounded-lg bg-[var(--brass)] text-[var(--ink)] text-sm font-bold disabled:opacity-50">Save approval rule</button>
        )}
        {!canEdit && <p className="text-xs text-[var(--muted)]">Owners and accountants change these settings.</p>}
      </section>
    </div>
  );
}
