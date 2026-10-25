/** A compact, report-specific empty state that leaves the period controls and totals in place. */
export default function ReportEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div role="status" className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-5 py-4">
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{description}</p>
    </div>
  );
}
