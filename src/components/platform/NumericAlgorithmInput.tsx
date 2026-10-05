import React, { useId, useState } from 'react';
import type { AlgoInput } from '../../lib/algorithms/types';
type NumberInput = Extract<AlgoInput, { kind?: 'number' }>;
export function NumericAlgorithmInput({ input, value, onChange }: { input: NumberInput; value: number; onChange: (value: number) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  const [previous, setPrevious] = useState(value);
  const [error, setError] = useState('');
  if (previous !== value) { setPrevious(value); setDraft(String(value)); setError(''); }
  const commit = (field: HTMLInputElement) => {
    if (!draft.trim() || !Number.isFinite(Number(draft)) || (!field.validity.valid && Number(draft) !== input.defaultValue)) { setError(`Enter a value from ${input.min} to ${input.max}, in steps of ${input.step ?? 1}.`); return; }
    setError(''); onChange(Number(draft));
  };
  return <div className="space-y-2">
    <input type="range" aria-label={`${input.label} slider`} min={input.min} max={input.max} step={input.step} value={value} onChange={event => { setDraft(event.target.value); setError(''); onChange(Number(event.target.value)); }} className="w-full accent-ledger-ink" />
    <label htmlFor={id} className="sr-only">{input.label}</label>
    <input id={id} type="number" required min={input.min} max={input.max} step={input.step} value={draft} onChange={event => setDraft(event.target.value)} onBlur={event => commit(event.currentTarget)} onKeyDownCapture={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDraft(String(value)); setError(''); } }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(event.currentTarget); } if (event.key === 'Escape') { setDraft(String(value)); setError(''); } }} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} className="w-full p-2 border border-[var(--line)] rounded-lg bg-[var(--panel)] text-[var(--text)]" />
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-red-600">{error}</p>}
  </div>;
}
