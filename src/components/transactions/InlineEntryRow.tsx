import { useId, useMemo, useRef, useState } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import { useTransactionActions } from '../../hooks/useTransactionActions';
import { categoryChoices, descriptionSuggestions } from '../../lib/accountChoices';
import { defaultBankAccount, defaultDirection, inlineEntry, suggestCategory } from '../../lib/entrySuggestions';
import { resolveAccountRole } from '../../lib/accountUtils';
import { parseInlineValue } from '../../lib/inlineEdit';
import { getLocalDateISO } from '../../lib/utils';

/**
 * Add an entry right at the top of the transaction list (I-22): type what it was and how much,
 * the category comes from your own past entries with a similar description (I-23), Enter saves it
 * through the normal posting path. Bank account and date stay for the next one.
 */
export default function InlineEntryRow() {
  const id = useId();
  const accounts = useLedgerStore(s => s.accounts);
  const transactions = useLedgerStore(s => s.transactions);
  const canEdit = useCurrentRole() !== 'viewer';
  const { handleQuickAdd } = useTransactionActions();
  const choices = useLedgerStore(s => categoryChoices(s.accounts, s.transactions));
  const descriptions = useLedgerStore(s => descriptionSuggestions(s.transactions));
  const banks = useMemo(() => accounts.filter(a => !a.isArchived && resolveAccountRole(a) === 'cash'), [accounts]);
  const [date, setDate] = useState(getLocalDateISO());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [direction, setDirection] = useState<'in' | 'out'>('out');
  const [directionTouched, setDirectionTouched] = useState(false);
  const [bankId, setBankId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const descriptionRef = useRef<HTMLInputElement>(null);

  if (!canEdit || banks.length === 0) return null;
  const bank = banks.find(b => b.id === bankId) || defaultBankAccount(transactions, accounts);
  const category = accounts.find(a => a.id === categoryId) || null;

  const describe = (text: string) => {
    setDescription(text);
    setError('');
    if (categoryTouched) return;
    const suggested = suggestCategory(text, transactions, accounts);
    setCategoryId(suggested?.id || '');
    if (!directionTouched) setDirection(defaultDirection(suggested));
  };

  const save = async () => {
    const cents = parseInlineValue('money', amount);
    if (!description.trim()) { setError('What was it?'); return; }
    if (typeof cents !== 'number' || cents <= 0) { setError('Enter an amount above 0'); return; }
    if (!category) { setError('Pick a category'); return; }
    if (!bank) { setError('Pick a bank account'); return; }
    setSaving(true);
    try {
      await handleQuickAdd(inlineEntry({ date, description, amountCents: Math.abs(cents), direction, category, bank }));
      setDescription(''); setAmount(''); setCategoryId(''); setCategoryTouched(false); setDirectionTouched(false); setError('');
      descriptionRef.current?.focus();
    } finally {
      setSaving(false);
    }
  };
  const onKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); void save(); } };
  const field = 'px-2 py-1.5 text-xs bg-[var(--ink)] border border-[var(--line)] rounded-md text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--brass)]';

  return (
    <div role="group" aria-label="Add an entry" className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[var(--line)] bg-[var(--surface)]">
      <label htmlFor={`${id}-date`} className="sr-only">Entry date</label>
      <input id={`${id}-date`} type="date" value={date} onChange={e => setDate(e.target.value)} onKeyDown={onKeyDown} className={field} />
      <label htmlFor={`${id}-desc`} className="sr-only">What was it</label>
      <input id={`${id}-desc`} ref={descriptionRef} value={description} onChange={e => describe(e.target.value)} onKeyDown={onKeyDown}
        placeholder="Add an entry: what was it?" list={`${id}-descs`} className={`${field} flex-1 min-w-[12rem]`} />
      <datalist id={`${id}-descs`}>{descriptions.map(d => <option key={d} value={d} />)}</datalist>
      <label htmlFor={`${id}-amount`} className="sr-only">Amount</label>
      <input id={`${id}-amount`} inputMode="decimal" value={amount} onChange={e => { setAmount(e.target.value); setError(''); }} onKeyDown={onKeyDown}
        placeholder="0.00" className={`${field} w-24 text-right tabular-nums`} />
      <label htmlFor={`${id}-dir`} className="sr-only">Money in or out</label>
      <select id={`${id}-dir`} value={direction} onChange={e => { setDirection(e.target.value as 'in' | 'out'); setDirectionTouched(true); }} onKeyDown={onKeyDown} className={field}>
        <option value="out">Money out</option>
        <option value="in">Money in</option>
      </select>
      <label htmlFor={`${id}-cat`} className="sr-only">Category</label>
      <select id={`${id}-cat`} value={categoryId} onChange={e => { setCategoryId(e.target.value); setCategoryTouched(true); setError(''); }} onKeyDown={onKeyDown} className={`${field} max-w-[14rem]`}>
        <option value="">Category…</option>
        {choices.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      <label htmlFor={`${id}-bank`} className="sr-only">Bank account</label>
      <select id={`${id}-bank`} value={bank?.id || ''} onChange={e => setBankId(e.target.value)} onKeyDown={onKeyDown} className={`${field} max-w-[12rem]`}>
        {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <button type="button" disabled={saving} onClick={() => { void save(); }} aria-label="Add the entry"
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-[var(--brass)] text-[var(--ink)] text-xs font-bold disabled:opacity-50">
        <CornerDownLeft aria-hidden="true" className="w-3.5 h-3.5" /> Add
      </button>
      {error && <span role="alert" className="w-full text-[11px] text-[var(--neg)]">{error}</span>}
    </div>
  );
}
