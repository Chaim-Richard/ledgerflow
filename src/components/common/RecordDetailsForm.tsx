import React, { useEffect, useId, useRef, useState } from 'react';
import { RECORD_DETAIL_FIELDS, loadRecordDetails, saveRecordDetails } from '../../lib/recordDetails';
import { suggestionsFrom } from '../../lib/inlineEdit';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import type { DetailAdapter, DetailData, DetailTarget } from '../../lib/recordDetails';
const LABELS: Record<string, string> = { name: 'Name', email: 'Email', phone: 'Phone', address: 'Address', notes: 'Notes', category: 'Category', description: 'Description', sku: 'SKU' };
export function RecordDetailsForm({ target, adapter, onSaved }: { target: DetailTarget; adapter: DetailAdapter; onSaved?: (record: DetailData) => void }) {
  const suggestionId = useId();
  useLedgerCollections('customers', 'vendors', 'projects', 'inventory');
  const records = useLedgerStore(state => state[target.kind]);
  const suggestions = (field: string) => suggestionsFrom<object>(records.filter(record => record.workspaceId === adapter.session()?.workspaceId), record => (record as Record<string, unknown>)[field]);
  const [baseline, setBaseline] = useState<DetailData>();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const active = useRef(true), busy = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const focusOrigin = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const dialog = form.current?.closest<HTMLElement>('[role="dialog"]');
    if (pending) {
      // Disabling the focused field/button can move native focus to body.
      if (document.activeElement === document.body) dialog?.focus();
      return;
    }
    const element = focusOrigin.current;
    focusOrigin.current = null;
    if (element?.isConnected && (document.activeElement === document.body || document.activeElement === dialog)) {
      if (element.hasAttribute('disabled')) dialog?.focus(); else element.focus();
    }
  }, [pending]);
  useEffect(() => {
    active.current = true; let cancelled = false;
    loadRecordDetails(adapter, target).then(record => { if (cancelled) return; setBaseline(record); setDraft(Object.fromEntries(RECORD_DETAIL_FIELDS[target.kind].map(key => [key, String(record[key] ?? '')]))); }).catch(error => { if (!cancelled) setError(error instanceof Error ? error.message : 'Could not load details.'); });
    return () => { cancelled = true; active.current = false; };
  }, [adapter, target, attempt]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!baseline || busy.current) return;
    focusOrigin.current = document.activeElement instanceof HTMLElement && event.currentTarget.contains(document.activeElement) ? document.activeElement : null;
    busy.current = true; setPending(true); setError(''); setSaved(false);
    try { const record = await saveRecordDetails(adapter, target, baseline, draft); if (active.current) { setBaseline(record); setDraft(Object.fromEntries(RECORD_DETAIL_FIELDS[target.kind].map(key => [key, String(record[key] ?? '')]))); setSaved(true); onSaved?.(record); } }
    catch (error) { if (active.current) setError(error instanceof Error ? error.message : 'Could not save details.'); }
    finally { busy.current = false; if (active.current) setPending(false); }
  };
  return <form ref={form} onSubmit={submit} className="space-y-4">
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {!baseline && error && <button type="button" onClick={() => { setError(""); setAttempt(attempt + 1); }} className="min-h-11 underline">Retry loading details</button>}
    {!baseline && !error && <p role="status">Loading record details…</p>}
    {baseline && <>
      {RECORD_DETAIL_FIELDS[target.kind].map(key => <div key={key}><label className="block text-sm font-medium">{LABELS[key]}
        {['address', 'description', 'notes'].includes(key) ? <textarea aria-label={LABELS[key]} value={draft[key] ?? ''} disabled={pending || !adapter.session()?.writable} dir="auto" onChange={event => { setDraft({ ...draft, [key]: event.target.value }); setSaved(false); }} className="mt-1 w-full min-h-24 p-3 bg-[var(--panel)] border border-[var(--line)] rounded-lg" /> : <input aria-label={LABELS[key]} list={`${suggestionId}-${key}`} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} required={key === 'name'} value={draft[key] ?? ''} disabled={pending || !adapter.session()?.writable} dir="auto" onChange={event => { setDraft({ ...draft, [key]: event.target.value }); setSaved(false); }} className="mt-1 w-full p-3 bg-[var(--panel)] border border-[var(--line)] rounded-lg" />}
      </label>
        {!['address', 'description', 'notes'].includes(key) && <datalist id={`${suggestionId}-${key}`}>{suggestions(key).map(value => <option key={value} value={value} />)}</datalist>}
        {['address', 'description', 'notes'].includes(key) && suggestions(key).some(value => value !== draft[key]) && <details className="mt-1"><summary className="cursor-pointer text-xs">Suggestions for {LABELS[key]}</summary><ul>{suggestions(key).filter(value => value !== draft[key]).slice(0, 5).map(value => <li key={value}><button type="button" disabled={pending || !adapter.session()?.writable} onClick={() => { setDraft({ ...draft, [key]: value }); setSaved(false); }} className="min-h-11 text-start underline whitespace-pre-wrap"><bdi>{value}</bdi></button></li>)}</ul></details>}
      </div>)}
      <button type="submit" disabled={pending || !adapter.session()?.writable} className="min-h-11 px-4 rounded-lg bg-indigo-600 text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save details'}</button>
      {!adapter.session()?.writable && <p className="text-sm">Your workspace role has read-only access.</p>}
      {saved && <p role="status">Details saved for future use.</p>}
    </>}
  </form>;
}
