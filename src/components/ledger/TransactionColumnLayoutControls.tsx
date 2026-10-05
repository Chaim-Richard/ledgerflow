import { COLUMN_LABELS } from '../../lib/columnLayout';
import type { ColumnLayout } from '../../lib/columnLayout';

export function TransactionColumnLayoutControls({ layout, setWidth, move, reset }: { layout: ColumnLayout; setWidth: (id: string, width: number) => void; move: (id: string, direction: -1 | 1) => void; reset: () => void }) {
  return <section aria-label="Column widths and order" className="mt-3 border-t border-[var(--line)] pt-3">
    <h2 className="text-sm font-semibold">Widths and order</h2>
    <p className="text-xs text-[var(--muted)] mb-2">Saved for you on this device. Applies to desktop and tablet; phone columns stay compact.</p>
    {layout.order.filter(id => id !== 'select').map(id => {
      const label = COLUMN_LABELS.find(([column]) => column === id)![1];
      const position = layout.order.indexOf(id);
      return <div key={id} className="flex flex-wrap items-center gap-2 py-1">
        <label className="flex flex-1 items-center gap-2 text-xs">{label} width
          <input type="number" aria-label={`${label} width in pixels`} min={64} max={600} step={8} key={`${id}:${layout.widths[id] ?? 'auto'}`} defaultValue={layout.widths[id] ?? ''} placeholder="Auto" onBlur={event => setWidth(id, event.target.value ? Number(event.target.value) : Number.NaN)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} className="min-h-11 w-20 rounded border border-[var(--line)] bg-[var(--surface)] px-2" />
        </label>
        {id !== 'actions' && <><button type="button" aria-label={`Move ${label} left`} disabled={position <= 1} onClick={() => move(id, -1)} className="min-h-11 min-w-11 rounded border border-[var(--line)] disabled:opacity-40">←</button><button type="button" aria-label={`Move ${label} right`} disabled={position >= layout.order.length - 2} onClick={() => move(id, 1)} className="min-h-11 min-w-11 rounded border border-[var(--line)] disabled:opacity-40">→</button></>}
      </div>;
    })}
    <button type="button" onClick={reset} className="min-h-11 text-sm underline">Reset widths and order</button>
  </section>;
}
