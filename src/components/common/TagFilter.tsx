import React from 'react';
import { Tag } from 'lucide-react';

/** Filter a contact list by one of its tags (Y-24); nothing shows when no contact has tags. */
export default function TagFilter({ tags, value, onChange, label }: { tags: string[]; value: string | null; onChange: (tag: string | null) => void; label: string }) {
  if (tags.length === 0) return null;
  const chip = (active: boolean) => `px-3 py-1 rounded-full text-xs font-semibold border ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]'}`;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2 px-4 pt-4">
      <Tag aria-hidden="true" className="w-4 h-4 text-[var(--muted)]" />
      <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={chip(value === null)}>All</button>
      {tags.map(t => (
        <button key={t} type="button" aria-pressed={value === t} onClick={() => onChange(value === t ? null : t)} className={chip(value === t)}>{t}</button>
      ))}
    </div>
  );
}
