import { useId, useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import { useEntityOperations } from '../../hooks/useEntityOperations';
import { isOpeningBalanceEquity } from '../../lib/openingBalances';
import { isOpeningBalanceDocument, openingBalanceDocument } from '../../lib/partyOpeningBalance';
import { parseInlineValue } from '../../lib/inlineEdit';
import { formatCurrency, getLocalDateISO } from '../../lib/utils';
import type { PartySide } from './PartyModal';

/**
 * A customer's or vendor's opening balance (BA-02), right on their page: type what they owed on
 * the day the books start and press Add. It becomes one open invoice (bill) against Opening
 * Balance Equity, so aging, statements and balances include it and it is paid like any other.
 */
export default function PartyOpeningBalance({ side, party }: { side: PartySide; party: { id: string; name: string } }) {
  const id = useId();
  useLedgerCollections(side === 'customer' ? 'invoices' : 'bills');
  const docs = useLedgerStore(s => (side === 'customer' ? s.invoices : s.bills)) as Array<{ id: string; customerId?: string; vendorId?: string; amountCents: number; date?: string; status?: string; metadata?: Record<string, unknown> }>;
  const accounts = useLedgerStore(s => s.accounts);
  const workspace = useAuthStore(s => s.getCurrentWorkspace());
  const canEdit = useCurrentRole() !== 'viewer';
  const { addEntity } = useEntityOperations();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => workspace?.openingBalanceDate || getLocalDateISO());
  const [busy, setBusy] = useState(false);
  const currency = workspace?.currency || 'USD';
  const existing = docs.find(d => (side === 'customer' ? d.customerId : d.vendorId) === party.id && isOpeningBalanceDocument(d) && d.status !== 'void');

  if (existing) {
    return <span>{formatCurrency(existing.amountCents, currency)} on {existing.date} <span className="text-[var(--muted)]">({existing.status})</span></span>;
  }
  if (!canEdit) return <span className="text-[var(--muted)]">None</span>;

  const add = async () => {
    const cents = parseInlineValue('money', amount);
    if (typeof cents !== 'number' || cents <= 0) { toast.error('Enter an amount above 0'); return; }
    setBusy(true);
    try {
      let equity: { id: string; name: string } | null = accounts.find(a => !a.isArchived && isOpeningBalanceEquity(a)) || null;
      if (!equity) {
        const used = new Set(accounts.map(a => a.code));
        const code = ['3900', '3910', '3990', '3999'].find(c => !used.has(c)) || '';
        const ref = await addEntity('chartAccounts', { name: 'Opening Balance Equity', type: 'equity', category: 'Equity', code, description: 'Balances brought in when the books started' });
        equity = ref ? { id: ref.id, name: 'Opening Balance Equity' } : null;
      }
      if (!equity) return;
      const message = `Opening balance of ${formatCurrency(cents, currency)} added for ${party.name}`;
      if (side === 'customer') await addEntity('invoices', openingBalanceDocument('customer', party, equity, cents, date, currency), message);
      else await addEntity('bills', openingBalanceDocument('vendor', party, equity, cents, date, currency), message);
      setAmount('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field = 'px-2 py-1 rounded-md border border-[var(--line)] bg-[var(--panel)] text-[var(--text)] text-xs';
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <label htmlFor={`${id}-amount`} className="sr-only">Opening balance of {party.name}</label>
      <input id={`${id}-amount`} inputMode="decimal" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') void add(); }} className={`${field} w-24 text-right`} />
      <label htmlFor={`${id}-date`} className="sr-only">Opening balance date</label>
      <input id={`${id}-date`} type="date" value={date} onChange={e => setDate(e.target.value)} className={field} />
      <button type="button" disabled={busy || !amount.trim()} onClick={add} className="px-2 py-1 rounded-md border border-[var(--line)] font-semibold text-indigo-600 dark:text-indigo-400 disabled:opacity-50">
        {busy ? 'Adding…' : 'Add'}
      </button>
    </span>
  );
}
