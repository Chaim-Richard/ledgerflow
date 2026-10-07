/**
 * Selling below zero (W-06) on Inventory. By default a sale of more than is on hand is recorded and
 * stock goes below zero, with a warning. An owner can turn on "Refuse sales beyond stock": then an
 * invoice that would take an item below zero is not saved. The server decides and enforces it
 * (src/server/services/stockPolicyService.ts, cogsStockService.ts); others see when it is on.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { getIdToken } from '../../firebase';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCurrentRole } from '../../hooks/useCurrentRole';

export default function StockPolicySwitch() {
  const workspace = useAuthStore(s => s.getCurrentWorkspace());
  const setWorkspaces = useAuthStore(s => s.setWorkspaces);
  const isOwner = useCurrentRole() === 'owner';
  const [saving, setSaving] = useState(false);
  if (!workspace) return null;
  const refuse = workspace.refuseNegativeStock === true;
  if (!isOwner) return refuse ? <p className="text-xs text-[var(--muted)]">Sales beyond stock are refused: record stock received before invoicing it.</p> : null;

  const change = async (next: boolean) => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/inventory/stock-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getIdToken()}` },
        body: JSON.stringify({ workspaceId: workspace.id, refuseNegativeStock: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The setting was not saved');
      setWorkspaces(useAuthStore.getState().workspaces.map(w => (w.id === workspace.id ? { ...w, refuseNegativeStock: next } : w)));
      toast.success(next ? 'Sales beyond stock are now refused' : 'Sales may take stock below zero again, with a warning');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <label className="flex items-start gap-2 text-xs text-[var(--text)] max-w-md">
      <input type="checkbox" className="mt-0.5" checked={refuse} disabled={saving} onChange={e => void change(e.target.checked)} />
      <span>Refuse sales beyond stock <span className="text-[var(--muted)]">(an invoice that would take an item below zero is not saved; when off, it is saved with a warning)</span></span>
    </label>
  );
}
