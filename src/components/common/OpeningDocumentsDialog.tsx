import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useDialog } from '../../hooks/useDialog';
import { useEntityOperations } from '../../hooks/useEntityOperations';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { isOpeningBalanceEquity } from '../../lib/openingBalances';
import { openingBalanceDocument, parseOpeningRows } from '../../lib/partyOpeningBalance';
import { formatCurrency } from '../../lib/utils';

/**
 * Opening invoices or bills (CA-08): paste the unpaid invoices (bills) of the old system from a
 * spreadsheet — contact, number, date, due date, amount still owed — check the preview, and add them.
 * Each becomes an open invoice (bill) against Opening Balance Equity, like a contact's opening balance
 * (BA-02), so aging and statements are right from day one and none counts as a sale or an expense.
 * Contacts not on the list yet are added; lines with a problem are left out and named.
 */
export default function OpeningDocumentsDialog({ side, onClose }: { side: 'customer' | 'vendor'; onClose: () => void }) {
  const workspace = useAuthStore(s => s.getCurrentWorkspace());
  const currency = workspace?.currency || 'USD';
  const startDate = workspace?.openingBalanceDate;
  const accounts = useLedgerStore(s => s.accounts);
  const customers = useLedgerStore(s => s.customers);
  const vendors = useLedgerStore(s => s.vendors);
  // the contacts must be in before adding: a contact not yet loaded would be added a second time
  const { loading } = useLedgerCollections('customers', 'vendors');
  const { addEntity } = useEntityOperations();
  const { dialogProps, titleId } = useDialog(onClose, true);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = useMemo(() => parseOpeningRows(text, startDate), [text, startDate]);
  const ok = rows.filter(r => !r.problem);
  const total = ok.reduce((s, r) => s + r.amountCents, 0);
  const word = side === 'customer' ? 'invoice' : 'bill';
  const parties = (side === 'customer' ? customers : vendors) || [];

  const add = async () => {
    if (!ok.length || busy || loading) return;
    setBusy(true);
    try {
      let equity: { id: string; name: string } | null = (accounts || []).find(a => !a.isArchived && isOpeningBalanceEquity(a)) || null;
      if (!equity) {
        const used = new Set((accounts || []).map(a => a.code));
        const code = ['3900', '3910', '3990', '3999'].find(c => !used.has(c)) || '';
        const ref = await addEntity('chartAccounts', { name: 'Opening Balance Equity', type: 'equity', category: 'Equity', code, description: 'Balances brought in when the books started' });
        equity = ref ? { id: ref.id, name: 'Opening Balance Equity' } : null;
      }
      if (!equity) return;
      const known = new Map(parties.map(p => [p.name.trim().toLowerCase(), { id: p.id, name: p.name }]));
      let added = 0;
      for (const row of ok) {
        let party = known.get(row.partyName.toLowerCase());
        if (!party) {
          const ref = await addEntity(side === 'customer' ? 'customers' : 'vendors', { name: row.partyName, status: 'active' });
          if (!ref) continue;
          party = { id: ref.id, name: row.partyName };
          known.set(row.partyName.toLowerCase(), party);
        }
        const detail = { number: row.number, dueDate: row.dueDate };
        const saved = side === 'customer'
          ? await addEntity('invoices', openingBalanceDocument('customer', party, equity, row.amountCents, row.date, currency, detail))
          : await addEntity('bills', openingBalanceDocument('vendor', party, equity, row.amountCents, row.date, currency, detail));
        if (saved) added++;
      }
      const skipped = rows.length - ok.length;
      toast.success(`${added} opening ${word}${added === 1 ? '' : 's'} added${skipped ? `; ${skipped} line${skipped === 1 ? '' : 's'} with a problem left out` : ''}`);
      if (added) onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div {...dialogProps} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[var(--surface)] rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-[var(--line)]">
        <div className="flex items-center justify-between p-5 border-b border-[var(--line)]">
          <h2 id={titleId} className="text-lg font-bold text-[var(--text)]">Opening {word}s</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--text)]"><X aria-hidden="true" className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 text-sm">
          <p className="text-xs text-[var(--muted)]">
            The {word}s still unpaid when you start with LedgerFlow, copied from a spreadsheet: one per line, columns
            {' '}{side === 'customer' ? 'customer' : 'vendor'} · number · date · due date (optional) · amount still owed. Dates as YYYY-MM-DD.
            {startDate ? ` Dated on or before ${startDate}, the day the books start.` : ''} They count towards {side === 'customer' ? 'what customers owe' : 'what you owe'}, not as {side === 'customer' ? 'sales' : 'expenses'}.
          </p>
          <label className="block">
            <span className="block text-xs font-semibold text-[var(--muted)] mb-1">Paste the {word}s</span>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={6} dir="auto"
              placeholder={side === 'customer' ? 'Acme Ltd\tINV-0912\t2026-08-14\t2026-09-13\t1,250.00' : 'Paper Co\tB-77\t2026-08-20\t2026-09-19\t310.00'}
              className="w-full px-3 py-2 font-mono text-xs bg-[var(--ink)] border border-[var(--line)] rounded-lg text-[var(--text)]" />
          </label>
          {rows.length > 0 && (
            <table className="w-full text-xs">
              <caption className="text-left text-xs font-semibold text-[var(--muted)] mb-1">Preview: {ok.length} to add · {formatCurrency(total, currency)}</caption>
              <thead><tr className="text-[var(--muted)]"><th scope="col" className="text-left">Line</th><th scope="col" className="text-left">{side === 'customer' ? 'Customer' : 'Vendor'}</th><th scope="col" className="text-left">Number</th><th scope="col" className="text-left">Date</th><th scope="col" className="text-left">Due</th><th scope="col" className="text-right">Owed</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.line} className={r.problem ? 'text-rose-700' : ''}>
                    <td>{r.line}</td>
                    <td><bdi>{r.partyName}</bdi>{!r.problem && !parties.some(p => p.name.trim().toLowerCase() === r.partyName.toLowerCase()) && <span className="text-[var(--muted)]"> (new)</span>}</td>
                    <td>{r.number}</td>
                    <td>{r.date}</td>
                    <td>{r.dueDate}</td>
                    <td className="text-right tabular-nums">{r.problem ? r.problem : formatCurrency(r.amountCents, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-[var(--muted)] hover:underline">Cancel</button>
            <button type="button" onClick={() => void add()} disabled={!ok.length || busy || loading}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold disabled:opacity-50">
              {busy ? 'Adding…' : loading ? 'Loading contacts…' : `Add ${ok.length} opening ${word}${ok.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
