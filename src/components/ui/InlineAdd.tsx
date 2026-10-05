import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

interface InlineAddProps {
  /** e.g. "Add a customer: type a name and press Enter" */
  placeholder: string;
  /** Accessible name, e.g. "New customer name". */
  label: string;
  /** Creates the record from the typed name; throw to keep the text. */
  onAdd: (name: string) => Promise<unknown> | unknown;
  /** Names already used: a repeat is pointed out before creating a duplicate. */
  existing?: string[];
  suggestions?: string[];
  className?: string;
}

/**
 * Add in place (I-22): type a name where the list is and press Enter; the new record appears in
 * the list, ready to edit in place. No form to open.
 */
export default function InlineAdd({ placeholder, label, onAdd, existing, suggestions, className }: InlineAddProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const listId = React.useId();

  const submit = async () => {
    const name = text.trim();
    if (!name || busy) return;
    const repeat = existing?.find(e => e.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
    if (repeat && notice !== name) { setNotice(name); return; }
    setBusy(true);
    try {
      await onAdd(name);
      setText('');
      setNotice('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2">
        <Plus aria-hidden="true" className="w-4 h-4 text-[var(--muted)] shrink-0" />
        <input aria-label={label} value={text} placeholder={placeholder} disabled={busy}
          list={suggestions?.length ? listId : undefined}
          onChange={e => { setText(e.target.value); setNotice(''); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } if (e.key === 'Escape') { setText(''); setNotice(''); } }}
          className="flex-1 min-w-0 px-2 py-1.5 text-sm bg-transparent border-b border-dashed border-[var(--line)] focus:border-[var(--brass)] focus:outline-none text-[var(--text)] placeholder:text-[var(--faint)]" />
        {suggestions?.length ? <datalist id={listId}>{suggestions.map(s => <option key={s} value={s} />)}</datalist> : null}
      </div>
      {notice && <p role="status" className="text-xs text-amber-600 pl-6">&quot;{notice}&quot; already exists. Press Enter again to add another one anyway.</p>}
    </div>
  );
}
