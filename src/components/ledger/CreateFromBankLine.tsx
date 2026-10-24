import React, { useState } from 'react';
import type { BankStatementLine, ChartAccount } from '../../types';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { isCashAccount } from '../../lib/txFilters';
import { reconcileCreateDefaults, type ReconcileCreateChoice } from '../../lib/bankRules';

/**
 * EG-9: "Create entry" from a bank line, pre-filled with what the bank rules suggested for it
 * (account, contact, labels). The person can change any of it; nothing is posted until they choose
 * Create entry. Remount it per line (key = line id) so each line starts from its own suggestion.
 */
export function CreateFromBankLine({ line, accounts, onCreate }: {
  line: BankStatementLine;
  accounts: ChartAccount[];
  onCreate: (choice: ReconcileCreateChoice) => Promise<void> | void;
}) {
  useLedgerCollections('customers', 'vendors');
  const customers = useLedgerStore(s => s.customers);
  const vendors = useLedgerStore(s => s.vendors);
  const defaults = reconcileCreateDefaults(line, accounts);
  const [accountId, setAccountId] = useState(defaults.accountId || '');
  const [contact, setContact] = useState(defaults.contactId ? `${defaults.contactKind || ''}:${defaults.contactId}` : '');
  const [labels, setLabels] = useState((defaults.tags || []).join(', '));
  const [busy, setBusy] = useState(false);
  const choices = accounts.filter(a => !isCashAccount(a) && !a.archived && a.isActive !== false);
  const contacts = [
    ...(customers || []).map(c => ({ key: `customer:${c.id}`, id: c.id, kind: 'customer' as const, name: c.name || c.id })),
    ...(vendors || []).map(v => ({ key: `vendor:${v.id}`, id: v.id, kind: 'vendor' as const, name: v.name || v.id })),
  ];
  // a suggested contact not loaded on this screen is still kept (shown by its id)
  const known = contacts.find(c => c.key === contact || (contact.endsWith(`:${c.id}`) && contact.startsWith(':')));
  const suggested = !!line.suggestion?.ruleIds?.length;

  const submit = async () => {
    const [kind, ...rest] = contact.split(':');
    const contactId = rest.join(':');
    const tags = labels.split(',').map(t => t.trim()).filter(Boolean);
    setBusy(true);
    try {
      await onCreate({
        accountId: accountId || undefined,
        contactId: contactId || undefined,
        contactKind: known?.kind || (kind === 'customer' || kind === 'vendor' ? kind : undefined),
        contactName: known?.name,
        tags,
        dimensions: defaults.dimensions,
      });
    } finally { setBusy(false); }
  };

  const field = 'w-full min-h-10 rounded-lg bg-white/10 border border-white/15 px-2 text-xs text-white';
  return (
    <div className="flex flex-col gap-2 w-full" aria-label="Create an entry from this bank line" role="group">
      {suggested && <p className="text-[11px] text-emerald-300">Suggested by your bank rules. Check it, change anything, then create the entry.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="text-[10px] text-zinc-400 flex flex-col gap-1">Account
          <select className={field} value={accountId} onChange={e => setAccountId(e.target.value)}>
            {choices.map(a => <option key={a.id} value={a.id}>{a.code ? `${a.code} ` : ''}{a.name}</option>)}
            {accountId && !choices.some(a => a.id === accountId) && <option value={accountId}>{accounts.find(a => a.id === accountId)?.name || accountId}</option>}
          </select>
        </label>
        <label className="text-[10px] text-zinc-400 flex flex-col gap-1">Contact
          <select className={field} value={contact} onChange={e => setContact(e.target.value)}>
            <option value="">No contact</option>
            {contacts.map(c => <option key={c.key} value={c.key}>{c.name} ({c.kind})</option>)}
            {contact && !contacts.some(c => c.key === contact) && <option value={contact}>{contact.split(':').slice(1).join(':')}</option>}
          </select>
        </label>
        <label className="text-[10px] text-zinc-400 flex flex-col gap-1">Labels
          <input className={field} value={labels} onChange={e => setLabels(e.target.value)} placeholder="comma separated" />
        </label>
      </div>
      <button type="button" disabled={busy || !accountId} onClick={submit}
        className="self-end px-5 py-2.5 bg-[var(--surface)]/10 hover:bg-[var(--surface)]/20 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all cursor-pointer border border-white/10 hover:border-white/20 shadow-sm whitespace-nowrap disabled:opacity-50">
        Create entry
      </button>
    </div>
  );
}
