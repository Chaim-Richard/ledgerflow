import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import type { FixedAsset } from '../../types';
import { useEntityOperations } from '../../hooks/useEntityOperations';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { formatCurrency, getLocalDateISO } from '../../lib/utils';
import { MAX_MAINTENANCE, maintenanceCost, maintenanceProblem, withEntry } from '../../lib/assetMaintenance';
import { inlineRecordAdapter } from '../../lib/inlineRecordAdapter';
import AttachmentsPanel from '../common/AttachmentsPanel';

const field = 'min-h-11 max-w-full px-2 py-1 text-[11px] border border-[var(--line)] rounded bg-[var(--panel)] text-[var(--text)]';
const emptyDraft = () => ({ date: getLocalDateISO(), description: '', cost: '', by: '', nextDue: '' });

/** Costs are notes only. Saves use the existing asset update; refused drafts stay for retry. */
function ScopedMaintenanceLog({ asset, currency }: { asset: FixedAsset; currency: string }) {
  const { updateEntity } = useEntityOperations();
  useLedgerCollections('assets');
  const role = useCurrentRole();
  const canChange = ['owner', 'accountant', 'bookkeeper'].includes(role);
  const log = asset.maintenance || [];
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const pending = useRef(false);
  const [scope] = useState(() => inlineRecordAdapter.session());
  const sameScope = (requireWritable = true) => {
    const current = inlineRecordAdapter.session();
    return Boolean(current && (!requireWritable || current.writable) && current.uid === scope?.uid && current.workspaceId === scope?.workspaceId && current.workspaceId === asset.workspaceId);
  };
  const costCents = draft.cost.trim() ? Math.round(Number(draft.cost.replace(',', '.')) * 100) : undefined;
  const invalidCost = draft.cost.trim() && !/^\d+(?:[.,]\d{1,2})?$/.test(draft.cost.trim());
  const problem = invalidCost ? 'Enter the cost with at most two decimal places.' : maintenanceProblem({
    date: draft.date, description: draft.description, costCents, nextDue: draft.nextDue || undefined, by: draft.by,
  });
  const atLimit = log.length >= MAX_MAINTENANCE;

  const save = async (maintenance: FixedAsset['maintenance'], extra: Partial<FixedAsset>, message: string): Promise<boolean> => {
    if (pending.current || !canChange || !sameScope()) return false;
    pending.current = true;
    setBusy(true); setError('');
    try {
      await updateEntity('assets', asset.id, { maintenance, ...extra });
      if (!sameScope()) return false;
      // Patch only confirmed metadata; keep newer financial fields and unrelated records intact.
      useLedgerStore.setState(state => ({ assets: state.assets.map(record =>
        record.id === asset.id && record.workspaceId === asset.workspaceId ? { ...record, maintenance, ...extra } : record) }));
      toast.success(message);
      return true;
    } catch (err) {
      if (sameScope()) {
        let message = err instanceof Error ? err.message : String(err);
        // The shared database error handler wraps the useful message in an auth-context JSON blob.
        try { const details = JSON.parse(message) as { error?: string }; message = details.error || message; } catch { /* already plain text */ }
        setError(`Not saved: ${message}`);
      }
      return false;
    } finally {
      pending.current = false;
      // Busy is not sensitive metadata: release it even if this same user has lost write permission.
      if (sameScope(false)) setBusy(false);
    }
  };
  const add = async () => {
    if (problem || atLimit || pending.current || !canChange || !sameScope()) return;
    const entry = {
      id: globalThis.crypto.randomUUID(), date: draft.date, description: draft.description.trim(),
      ...(costCents !== undefined ? { costCents } : {}), ...(draft.by.trim() ? { by: draft.by.trim() } : {}),
    };
    if (await save(withEntry(log, entry), draft.nextDue ? { nextServiceDue: draft.nextDue } : {}, `Maintenance noted for ${asset.name}`)) {
      setDraft(emptyDraft());
    }
  };

  return (
    <details onToggle={event => setOpen(event.currentTarget.open)} className="text-[11px] font-normal text-[var(--muted)] [overflow-wrap:anywhere]">
      <summary className="min-h-11 flex items-center cursor-pointer">Maintenance log ({log.length}){log.length ? `, ${formatCurrency(maintenanceCost(log), currency)} in all` : ''}<span className="sr-only"> of {asset.name}</span></summary>
      <ol className="mt-1 space-y-1">
        {log.map(entry => (
          <li key={entry.id} className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{entry.date}</span><bdi className="text-[var(--text)]">{entry.description}</bdi>
            {entry.by && <span>by <bdi>{entry.by}</bdi></span>}
            {entry.costCents !== undefined && <bdi className="font-mono" dir="ltr">{formatCurrency(entry.costCents, currency)}</bdi>}
            {canChange && (
              <button type="button" disabled={busy} onClick={() => void save(log.filter(item => item.id !== entry.id), {}, `Maintenance entry removed from ${asset.name}`)} className="min-h-11 px-2 text-rose-600 hover:underline">
                Remove<span className="sr-only"> {entry.description} on {entry.date}</span>
              </button>
            )}
          </li>
        ))}
      </ol>
      {error && <p role="alert" className="text-[var(--neg)]">{error} Your draft is kept; retry when ready.</p>}
      {canChange && asset.status !== 'disposed' && (
        <fieldset disabled={busy} className="mt-1 min-w-0 flex flex-wrap items-end gap-2">
          <legend className="sr-only">Note a service, repair or inspection of {asset.name}</legend>
          <input type="date" aria-label="Day done" value={draft.date} onChange={event => setDraft({ ...draft, date: event.target.value })} className={field} />
          <input aria-label="What was done" placeholder="What was done" maxLength={300} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} className={field} />
          <input aria-label="By" placeholder="By (optional)" maxLength={120} value={draft.by} onChange={event => setDraft({ ...draft, by: event.target.value })} className={`${field} w-28`} />
          <input inputMode="decimal" aria-label="Cost" placeholder="Cost (optional)" value={draft.cost} onChange={event => setDraft({ ...draft, cost: event.target.value })} className={`${field} w-24 text-right`} />
          <label className="flex flex-col">Next service<input type="date" value={draft.nextDue} onChange={event => setDraft({ ...draft, nextDue: event.target.value })} className={field} /></label>
          <button type="button" disabled={Boolean(problem) || atLimit} onClick={() => void add()} className="min-h-11 rounded bg-indigo-600 px-3 py-1 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Note it'}</button>
          {draft.description && problem && <span role="status" className="text-amber-700 dark:text-amber-400">{problem}</span>}
          {atLimit && <p role="status">This log has {MAX_MAINTENANCE} entries. Remove one before adding another; older entries are never silently discarded.</p>}
          <span className="basis-full">The cost here is a note: the service's bill books it.</span>
        </fieldset>
      )}
      {open && <AttachmentsPanel className="[&_label]:relative [&_label]:inline-flex [&_label]:min-h-11 [&_label]:items-center [&_label:focus-within]:outline-2 [&_label:focus-within]:outline-offset-2 [&_label:focus-within]:outline-[var(--brass)] [&_input[type=file]]:left-0" target={{ collection: 'assets', id: asset.id, label: `Asset maintenance: ${asset.name}`, scope: 'Asset maintenance:' }} />}
    </details>
  );
}

/** Changing workspace/user/asset unmounts the old draft and isolates late save responses. */
export function MaintenanceLog(props: { asset: FixedAsset; currency: string }) {
  const workspaceId = useAuthStore(state => state.currentWorkspaceId);
  const uid = useAuthStore(state => state.user?.uid);
  return <ScopedMaintenanceLog key={`${uid}:${workspaceId}:${props.asset.id}`} {...props} />;
}
