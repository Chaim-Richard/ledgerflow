import React, { useSyncExternalStore } from 'react';
import { onReadCounts, readCounts, readVersion, resetReadCounts } from '../../../lib/db/readCounter';

/** C-17: rows this tab read from the database, per table (shown with the developer switch on). */
export default function ReadCounterPanel() {
  useSyncExternalStore(onReadCounts, readVersion);
  const rows = readCounts();
  const total = rows.reduce((s, r) => s + r.rows, 0);
  return (
    <section aria-labelledby="reads-title" className="p-6 bg-[var(--surface)] border border-[var(--line)] rounded-xl space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="reads-title" className="text-base font-black text-[var(--text)] uppercase tracking-tight">Rows read by this tab</h2>
        <button type="button" onClick={resetReadCounts} className="text-xs font-semibold text-[var(--muted)] hover:underline">Start again</button>
      </div>
      <p className="text-xs text-[var(--muted)]">{total} rows in all since this tab opened (or since Start again). Open a screen and come back to see what it read.</p>
      {rows.length > 0 && (
        <table className="w-full text-xs">
          <caption className="sr-only">Rows read per table</caption>
          <thead><tr className="text-[var(--muted)]"><th scope="col" className="text-left py-1">Table</th><th scope="col" className="text-right py-1">Rows</th><th scope="col" className="text-right py-1">Reads</th></tr></thead>
          <tbody>
            {rows.map(r => <tr key={r.table}><th scope="row" className="text-left font-mono font-normal py-0.5">{r.table}</th><td className="text-right font-mono">{r.rows}</td><td className="text-right font-mono">{r.reads}</td></tr>)}
          </tbody>
        </table>
      )}
    </section>
  );
}
