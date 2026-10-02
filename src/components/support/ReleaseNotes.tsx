interface ReleaseNote {
  id: string;
  date: string;
  displayDate: string;
  title: string;
  changes: readonly string[];
}

// Newest first. Add only changes that have shipped; keep the date as a calendar date.
const RELEASE_NOTES: readonly ReleaseNote[] = [
  {
    id: '2026-10-02-bookkeeping-and-workspace-controls',
    date: '2026-10-02',
    displayDate: 'October 2, 2026',
    title: 'Clearer bookkeeping and safer workspace controls',
    changes: [
      'Data Health flags duplicate documents, entries that do not balance, missing accounts, and overdue invoices, with links to the records that need attention.',
      'Tax codes support multiple parts, compound tax, zero-rated and exempt sales, and reverse-charge bills. The Tax return screen keeps a copy when you file a return.',
      'New workspaces can choose a chart of accounts and enter opening balances, or start from zero.',
      'Settings → Security lets you download your personal data and manage workspace retention and deletion.',
      'Reports offer period comparisons, shareable links, and Print / Save as PDF.',
      'Form labels and keyboard controls are clearer, and dates follow your Date Display Format preference.',
    ],
  },
];

export default function ReleaseNotes() {
  return (
    <details className="max-w-7xl mx-auto mt-5 rounded-xl border border-[var(--line)] bg-[var(--panel)]">
      <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold text-[var(--text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brass)]">
        What’s new
      </summary>
      <div className="max-h-72 overflow-y-auto border-t border-[var(--line)] p-4 space-y-6">
        <h2 className="text-base font-bold text-[var(--text)]">Updates to LedgerFlow</h2>
        {RELEASE_NOTES.map(release => (
          <article key={release.id} className="space-y-2">
            <time dateTime={release.date} className="text-xs font-medium text-[var(--muted)]">
              {release.displayDate}
            </time>
            <h3 className="text-sm font-semibold text-[var(--text)]">{release.title}</h3>
            <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed text-[var(--text)]">
              {release.changes.map(change => <li key={change}>{change}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </details>
  );
}
