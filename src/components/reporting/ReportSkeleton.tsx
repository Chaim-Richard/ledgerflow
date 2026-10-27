/**
 * C-94: what a report shows while it loads — the shape of the report, not a spinner.
 *
 * A skeleton keeps the page still: the reader sees where the heading and the rows will be, and the
 * status is announced once, politely, instead of a spinning icon that says nothing. It is decoration
 * for the eye only (`aria-hidden`), so a screen reader hears the label and not twenty empty bars,
 * and it stops moving when the reader asked for less motion. The live region carries no `aria-busy`:
 * this component never clears that flag (it unmounts when loading ends), and a busy region can hold
 * the announcement back indefinitely.
 */
export default function ReportSkeleton({ rows = 8, columns = 4, label = 'Loading the report…', className = '' }: {
  /** placeholder rows, enough to fill the space the report will use */
  rows?: number;
  /** placeholder columns; the first is wider, like a report's name column */
  columns?: number;
  /** announced once: what is loading */
  label?: string;
  className?: string;
}) {
  const grid = { gridTemplateColumns: `minmax(6rem, 2fr) ${'minmax(3rem, 1fr) '.repeat(Math.max(1, columns) - 1)}` };
  // stable names for the placeholder cells, so React keys are not array positions
  const cells = (count: number, prefix: string) => Array.from({ length: Math.max(1, count) }, (_, place) => `${prefix}-${place}`);
  return (
    <div role="status" aria-live="polite" data-report-skeleton className={`w-full animate-pulse motion-reduce:animate-none ${className}`}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-3">
        <div className="h-6 w-1/3 max-w-64 rounded bg-[var(--line)]/70" />
        <div className="h-3 w-2/3 max-w-128 rounded bg-[var(--line)]/40" />
        <div className="overflow-hidden rounded-xl border border-[var(--line)]">
          <div className="grid gap-3 border-b border-[var(--line)] bg-[var(--ink)]/60 p-3" style={grid}>
            {cells(columns, 'heading').map(cell => (
              <div key={cell} className="h-3 rounded bg-[var(--line)]/70" />
            ))}
          </div>
          {cells(rows, 'row').map(row => (
            <div key={row} className="grid gap-3 border-b border-[var(--line)]/60 p-3 last:border-0" style={grid}>
              {cells(columns, row).map((cell, place) => (
                <div key={cell} className={`h-3 rounded bg-[var(--line)]/40 ${place === 0 ? '' : 'ml-auto w-2/3'}`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
