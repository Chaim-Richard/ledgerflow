/**
 * E-19: temporary W-2 boxes 1-6 review workspace.
 * Payroll gross is NOT presumed to be a W-2 taxable wage base.
 * Nothing is filed, persisted or posted.
 */
import { useMemo, useState } from 'react';
import type { PayRun } from '../../types';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDataNeedsStore } from '../../stores/useDataNeedsStore';
import { LEDGER_COLLECTIONS } from '../../lib/ledgerCollections';
import { downloadCsv } from '../../lib/csvExport';
import { exactW2Cents, usW2Review, US_W2_REVIEW_YEARS, type W2ReviewEmployee } from '../../lib/tax/usW2Review';

const BOXES = [
  { key: 'box1Cents', name: 'Box 1 — taxable wages' },
  { key: 'box2Cents', name: 'Box 2 — federal income tax withheld' },
  { key: 'box3Cents', name: 'Box 3 — Social Security wages' },
  { key: 'box4Cents', name: 'Box 4 — employee Social Security tax' },
  { key: 'box5Cents', name: 'Box 5 — Medicare wages and tips' },
  { key: 'box6Cents', name: 'Box 6 — employee Medicare tax' },
] as const;
type BoxKey = typeof BOXES[number]['key'];
type Draft = Partial<Record<BoxKey, string>> & { reviewed?: boolean };

export function UsW2Review({ payRuns, homeCurrency }: { payRuns: readonly PayRun[]; homeCurrency: string }) {
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const isGuest = useAuthStore(s => s.isGuest && !s.user);
  const loaded = useDataNeedsStore(s => s.loaded.payRuns);
  const loadedWorkspaceId = useDataNeedsStore(s => s.loadedWorkspaceId);
  const failed = useDataNeedsStore(s => s.failed.payRuns);
  const [expanded, setExpanded] = useState(false);
  const [year, setYear] = useState(2026);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [confirmedYear, setConfirmedYear] = useState<number | null>(null);

  const yearRuns = useMemo(() => payRuns.filter(run =>
    run.workspaceId === currentWorkspaceId && run.status === 'processed' && run.date.startsWith(String(year) + '-')
  ), [payRuns, currentWorkspaceId, year]);

  const employeeNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const run of yearRuns) for (const person of run.employees || []) {
      if (!person.contractor && person.employeeId && !names.has(person.employeeId)) names.set(person.employeeId, person.name);
    }
    return [...names].sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]));
  }, [yearRuns]);

  const inputs = useMemo<W2ReviewEmployee[]>(() => employeeNames.map(([employeeId, name]) => {
    const draft = drafts[employeeId] || {};
    return {
      employeeId, name, currency: homeCurrency, sourceReviewed: draft.reviewed === true,
      ...(Object.fromEntries(BOXES.map(box => [box.key, exactW2Cents(draft[box.key])])) as Pick<W2ReviewEmployee, BoxKey>),
    };
  }), [employeeNames, drafts, homeCurrency]);

  const result = useMemo(() => usW2Review(inputs, year), [inputs, year]);
  const blockers = [
    ...(isGuest ? ['Demo payroll does not prove a tax-year history.'] : []),
    ...(!currentWorkspaceId ? ['Select a workspace before reviewing payroll.'] : []),
    ...(!loaded || loadedWorkspaceId !== currentWorkspaceId ? ['Pay runs have not finished loading for this workspace.'] : []),
    ...(failed ? ['The pay-run collection could not be loaded; retry before exporting.'] : []),
    ...(payRuns.length >= LEDGER_COLLECTIONS.payRuns.cap ? ['The pay-run browser history reached its limit and may omit older records.'] : []),
    ...(payRuns.some(run => run.workspaceId !== currentWorkspaceId) ? ['The pay-run cache contains a different workspace.'] : []),
    ...(homeCurrency.toUpperCase() !== 'USD' ? ['This worksheet requires a USD workspace and verified US payroll details.'] : []),
    ...result.blockers,
  ];
  const canDownload = blockers.length === 0 && result.canDownloadForReview && confirmedYear === year;

  const update = (employeeId: string, key: keyof Draft, value: string | boolean) => {
    setDrafts(previous => ({ ...previous, [employeeId]: { ...previous[employeeId], [key]: value } }));
    setConfirmedYear(null);
  };

  return (
    <section aria-labelledby="us-w2-review-title" className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="us-w2-review-title" className="font-semibold text-neutral-900">US W-2 — annual worksheet (review only)</h2>
          <p className="mt-1 max-w-3xl text-xs text-neutral-600">
            Enter independently checked calendar-year figures for boxes 1–6. Gross payroll alone cannot establish the three wage bases.
            This is not a W-2 form or an SSA electronic submission, and contains no government identification numbers.
          </p>
        </div>
        <button type="button" aria-expanded={expanded} aria-controls="us-w2-review-body"
          onClick={() => setExpanded(value => !value)}
          className="min-h-11 rounded-lg border border-neutral-300 px-3 text-xs font-semibold">
          {expanded ? 'Close W-2 worksheet' : 'Review W-2 boxes'}
        </button>
      </div>
      {expanded && <div id="us-w2-review-body" className="space-y-3">
        <label className="block text-xs font-semibold text-neutral-800" htmlFor="w2-review-year">Tax year</label>
        <select id="w2-review-year" aria-label="W-2 review year" value={year}
          onChange={event => { setYear(Number(event.target.value)); setDrafts({}); setConfirmedYear(null); }}
          className="min-h-11 rounded-lg border border-neutral-300 px-3">
          {US_W2_REVIEW_YEARS.map(row => <option key={row.year} value={row.year}>{row.year}</option>)}
        </select>
        <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          The loaded browser list might omit earlier pay runs. Verify the full year against approved payroll records and quarterly
          reports. Figures entered here are not saved. Missing figures must not be treated as zero. This CSV is NOT accepted by SSA/IRS.
        </p>
        {employeeNames.length === 0 && <p className="text-xs text-neutral-600">No processed employee pay lines are loaded for this year.</p>}
        {employeeNames.map(([id, name]) => <fieldset key={id} className="space-y-3 rounded-lg border border-neutral-200 p-3">
          <legend className="px-1 font-semibold text-neutral-900"><bdi>{name}</bdi></legend>
          <p className="text-xs text-neutral-500">Enter six exact USD amounts from reviewed annual payroll documents.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BOXES.map(box => <label key={box.key} className="space-y-1 text-xs text-neutral-700">
              <span className="block">{box.name} (USD)</span>
              <input aria-label={box.name + ' for ' + name} type="text" inputMode="decimal"
                value={drafts[id]?.[box.key] ?? ''} placeholder="0.00"
                onChange={event => update(id, box.key, event.target.value)}
                className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 font-mono text-sm" />
            </label>)}
          </div>
          <label className="flex min-h-11 items-center gap-2 text-xs">
            <input type="checkbox" checked={drafts[id]?.reviewed === true}
              onChange={event => update(id, 'reviewed', event.target.checked)} />
            <span>These six box figures were independently checked for this employee and tax year.</span>
          </label>
        </fieldset>)}
        {blockers.length > 0 && <ul role="alert" className="list-disc ps-5 text-xs text-amber-900">
          {[...new Set(blockers)].map(problem => <li key={problem}>{problem}</li>)}
        </ul>}
        <label className="flex min-h-11 items-center gap-2 text-xs">
          <input type="checkbox" checked={confirmedYear === year} disabled={blockers.length > 0}
            onChange={event => setConfirmedYear(event.target.checked ? year : null)} />
          <span>I understand that this contains reviewed partial W-2 data, not a complete annual return or a filing file.</span>
        </label>
        <button type="button" disabled={!canDownload}
          className="min-h-11 rounded-lg border border-neutral-300 px-3 text-xs font-semibold disabled:opacity-40"
          onClick={() => { if (canDownload) downloadCsv('w2-review-' + year + '.csv', [...result.headers], result.rows); }}>
          Download W-2 review CSV
        </button>
        <p className="text-xs text-neutral-600">
          Official source: <a href="https://www.irs.gov/instructions/iw2w3" target="_blank" rel="noopener noreferrer"
            className="underline">IRS W-2 and W-3 instructions</a>. This worksheet omits boxes 7–20, identifiers,
          employer details, state/local breakdowns and the year-end reconciliation.
        </p>
      </div>}
    </section>
  );
}
