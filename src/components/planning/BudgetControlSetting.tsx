import React, { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import { getIdToken } from '../../firebase';

type BudgetControl = 'off' | 'warn' | 'block';
const CHOICES: Array<{ value: BudgetControl; label: string }> = [
  { value: 'warn', label: 'Warn, and post (default)' },
  { value: 'block', label: 'Refuse the posting' },
  { value: 'off', label: 'Do not check' },
];

/**
 * EG-4: what a bill, expense or journal posted over an account's budget does (budgetGuard.ts on the server). Shows
 * the stored value; an owner changes it through PUT /workspaces/:id/budget-control, everyone else only sees it.
 */
export default function BudgetControlSetting() {
  const id = useId();
  const workspace = useAuthStore(s => s.getCurrentWorkspace());
  const workspaces = useAuthStore(s => s.workspaces);
  const setWorkspaces = useAuthStore(s => s.setWorkspaces);
  const isOwner = useCurrentRole() === 'owner';
  const stored: BudgetControl = workspace?.budgetControl ?? 'warn';
  const [value, setValue] = useState<BudgetControl>(stored);
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(stored), [stored]);

  const change = async (next: BudgetControl) => {
    if (!workspace?.id || next === stored) return;
    setValue(next);
    setBusy(true);
    try {
      const token = await getIdToken().catch(() => null);
      const res = await fetch(`/api/v1/workspaces/${encodeURIComponent(workspace.id)}/budget-control`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ budgetControl: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'The budget control could not be saved');
      setWorkspaces(workspaces.map(w => (w.id === workspace.id ? { ...w, budgetControl: next } : w)));
      toast.success('Budget control saved');
    } catch (err) {
      setValue(stored);
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[var(--text)]">
      <label htmlFor={id} className="font-semibold">When a posting goes over a budget</label>
      <select id={id} value={value} disabled={!isOwner || busy} onChange={e => change(e.target.value as BudgetControl)}
        className="px-2 py-1.5 border border-[var(--line)] rounded bg-[var(--panel)] text-[var(--text)]">
        {CHOICES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
      {!isOwner && <span className="text-[var(--muted)]">Only owners change this.</span>}
    </div>
  );
}
