import React, { useState } from 'react';
import type { FixedAsset } from '../../types';
import { useEntityOperations } from '../../hooks/useEntityOperations';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import { formatCurrency, getLocalDateISO } from '../../lib/utils';
import { maintenanceCost, maintenanceProblem, withEntry } from '../../lib/assetMaintenance';

const field = 'px-2 py-1 text-[11px] border border-[var(--line)] rounded bg-[var(--panel)] text-[var(--text)]';

/**
 * An asset's maintenance log (X-06): each service, repair or inspection, newest first, and a form to
 * add one, which can also set the next service (reminded 30 days before). A record only: what it
 * cost is booked on its bill. People who keep the books add and remove entries; viewers read.
 */
export function MaintenanceLog({ asset, currency }: { asset: FixedAsset; currency: string }) {
  const { updateEntity } = useEntityOperations();
  const role = useCurrentRole();
  const canChange = role !== 'viewer';
  const log = asset.maintenance || [];
  const [draft, setDraft] = useState({ date: getLocalDateISO(), description: '', cost: '', by: '', nextDue: '' });
  const [busy, setBusy] = useState(false);
  const costCents = draft.cost.trim() ? Math.round(Number(draft.cost.replace(',', '.')) * 100) : undefined;
  const problem = maintenanceProblem({ date: draft.date, description: draft.description, costCents, nextDue: draft.nextDue || undefined });

  const save = async (maintenance: FixedAsset['maintenance'], extra: Partial<FixedAsset>, message: string) => {
    setBusy(true);
    try {
      await updateEntity('assets', asset.id, { maintenance, ...extra }, message);
    } finally {
      setBusy(false);
    }
  };
  const add = async () => {
    if (problem || busy) return;
    const entry = {
      id: globalThis.crypto.randomUUID(), date: draft.date, description: draft.description.trim(),
      ...(costCents !== undefined ? { costCents } : {}), ...(draft.by.trim() ? { by: draft.by.trim() } : {}),
    };
    await save(withEntry(log, entry), draft.nextDue ? { nextServiceDue: draft.nextDue } : {}, `Maintenance noted for ${asset.name}`);
    setDraft({ date: getLocalDateISO(), description: '', cost: '', by: '', nextDue: '' });
  };

  return (
    <details className="text-[11px] font-normal text-[var(--muted)]">
      <summary className="cursor-pointer">Maintenance log ({log.length}){log.length ? `, ${formatCurrency(maintenanceCost(log), currency)} in all` : ''}<span className="sr-only"> of {asset.name}</span></summary>
      <ol className="mt-1 space-y-0.5">
        {log.map(e => (
          <li key={e.id} className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{e.date}</span><bdi className="text-[var(--text)]">{e.description}</bdi>
            {e.by && <span>by <bdi>{e.by}</bdi></span>}
            {e.costCents !== undefined && <span className="font-mono">{formatCurrency(e.costCents, currency)}</span>}
            {canChange && (
              <button type="button" disabled={busy} onClick={() => void save(log.filter(x => x.id !== e.id), {}, `Maintenance entry removed from ${asset.name}`)} className="text-rose-600 hover:underline">
                Remove<span className="sr-only"> {e.description} on {e.date}</span>
              </button>
            )}
          </li>
        ))}
      </ol>
      {canChange && asset.status !== 'disposed' && (
        <fieldset disabled={busy} className="mt-1 flex flex-wrap items-end gap-1">
          <legend className="sr-only">Note a service, repair or inspection of {asset.name}</legend>
          <input type="date" aria-label="Day done" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} className={field} />
          <input aria-label="What was done" placeholder="What was done" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} className={field} />
          <input aria-label="By" placeholder="By (optional)" value={draft.by} onChange={e => setDraft({ ...draft, by: e.target.value })} className={`${field} w-28`} />
          <input inputMode="decimal" aria-label="Cost" placeholder="Cost (optional)" value={draft.cost} onChange={e => setDraft({ ...draft, cost: e.target.value })} className={`${field} w-24 text-right`} />
          <label className="flex flex-col">Next service<input type="date" value={draft.nextDue} onChange={e => setDraft({ ...draft, nextDue: e.target.value })} className={field} /></label>
          <button type="button" disabled={Boolean(problem)} onClick={() => void add()} className="rounded bg-indigo-600 px-2 py-1 font-semibold text-white disabled:opacity-50">Note it</button>
          {draft.description && problem && <span role="status" className="text-amber-700 dark:text-amber-400">{problem}</span>}
          <span className="basis-full">The cost here is a note: the service's bill books it.</span>
        </fieldset>
      )}
    </details>
  );
}
