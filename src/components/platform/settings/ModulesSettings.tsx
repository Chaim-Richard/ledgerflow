import React, { useState } from 'react';
import { Blocks } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useCurrentRole } from '../../../hooks/useCurrentRole';
import { getIdToken } from '../../../firebase';
import { isModuleOn, MODULES } from '../../../lib/modules';

/**
 * Settings → Modules (BB-07): which sets of screens this workspace uses. A module turned off leaves
 * the menu and the page search; nothing is deleted, and turning it on again shows everything as it
 * was. Owners and accountants change them (saved by the server, moduleService.ts); others see them.
 */
export default function ModulesSettings() {
  const workspace = useAuthStore(s => s.getCurrentWorkspace());
  const setWorkspaces = useAuthStore(s => s.setWorkspaces);
  const role = useCurrentRole();
  const canChange = role === 'owner' || role === 'accountant';
  const [saving, setSaving] = useState<string | null>(null);
  if (!workspace) return null;

  const change = async (id: string, on: boolean) => {
    setSaving(id);
    try {
      const res = await fetch(`/api/v1/workspaces/${encodeURIComponent(workspace.id)}/modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getIdToken()}` },
        body: JSON.stringify({ modules: { [id]: on } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'The modules were not saved');
      setWorkspaces(useAuthStore.getState().workspaces.map(w => (w.id === workspace.id ? { ...w, modules: data.modules } : w)));
      const name = MODULES.find(m => m.id === id)?.name || id;
      toast.success(on ? `${name} is on: its screens are in the menu` : `${name} is off: its screens left the menu, nothing was deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(null);
    }
  };

  return (
    <section aria-labelledby="modules-title" className="space-y-4">
      <div>
        <h2 id="modules-title" className="text-lg font-bold text-[var(--text)] flex items-center gap-2"><Blocks className="w-5 h-5" aria-hidden="true" /> Modules</h2>
        <p className="text-sm text-[var(--muted)]">Turn on the screens this business needs. A module turned off leaves the menu and the search; nothing in it is deleted, and turning it on shows everything again.</p>
        {!canChange && <p className="text-sm text-[var(--muted)]">Owners and accountants choose the modules.</p>}
      </div>
      <ul className="rounded-xl border border-[var(--line)] bg-[var(--surface)] divide-y divide-[var(--line)]">
        {MODULES.map(m => {
          const on = isModuleOn(workspace.modules, m.id);
          return (
            <li key={m.id} className="p-4">
              <label className="flex items-start gap-3 text-sm text-[var(--text)]">
                <input type="checkbox" className="mt-1" checked={on} disabled={!canChange || saving !== null} onChange={e => void change(m.id, e.target.checked)} />
                <span>
                  <span className="font-semibold">{m.name}</span>
                  <span className="block text-xs text-[var(--muted)]">{m.about}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
