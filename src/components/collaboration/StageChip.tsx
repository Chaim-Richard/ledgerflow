import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import type { StageKind } from '../../lib/stages';
import { useStageStore } from './stageStore';

/**
 * A record's own stage (BG-06) on its row: nothing when the workspace has no stages for this kind;
 * a select for owners, accountants and bookkeepers, the stage's name for everyone else.
 */
export function StageChip({ kind, id, label }: { kind: StageKind; id: string; label: string }) {
  const workspaceId = useAuthStore(s => s.currentWorkspaceId) || '';
  const role = useCurrentRole();
  const loaded = useStageStore(s => s.byKey[`${workspaceId}:${kind}`]);
  const load = useStageStore(s => s.load);
  const setStage = useStageStore(s => s.set);
  useEffect(() => { if (workspaceId) load(workspaceId, kind); }, [workspaceId, kind, load]);
  if (!loaded || loaded.stages.length === 0) return null;
  const current = loaded.current[id] || '';
  if (!['owner', 'accountant', 'bookkeeper'].includes(role)) return current ? <div className="mt-1 text-[10px] text-[var(--muted)]"><bdi>{current}</bdi></div> : null;
  return (
    <select value={current} aria-label={`Stage of ${label}`} onChange={e => { setStage(workspaceId, kind, id, e.target.value).catch(err => toast.error(err instanceof Error ? err.message : String(err))); }}
      className="mt-1 max-w-[9rem] px-1 py-0.5 text-[10px] border border-[var(--line)] rounded bg-[var(--panel)] text-[var(--text)]">
      <option value="">No stage</option>
      {loaded.stages.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}
