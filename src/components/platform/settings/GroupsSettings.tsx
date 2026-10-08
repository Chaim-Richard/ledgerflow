import React, { useEffect, useState } from 'react';
import { FolderTree } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../../stores/useAuthStore';
import { getIdToken } from '../../../firebase';
import { groupProblem, structureProblem, type WorkspaceGroup } from '../../../lib/workspaceGroups';

const field = 'px-2 py-1.5 text-sm border border-[var(--line)] rounded bg-[var(--panel)] text-[var(--text)]';

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(`/api/v1/account/groups${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getIdToken()}` }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || 'That did not work');
  return data as { groups?: WorkspaceGroup[]; group?: WorkspaceGroup };
}

/**
 * Settings → Groups of books (DA-01): your own groups of the workspaces you can open, e.g. a holding
 * and its companies, or clients by kind. Belonging to a group changes nothing in a workspace; nobody
 * else sees your groups. Saved by the server (src/server/services/workspaceGroupService.ts).
 */
export default function GroupsSettings() {
  const workspaces = useAuthStore(s => s.workspaces);
  const [groups, setGroups] = useState<WorkspaceGroup[] | null>(null);
  const [error, setError] = useState('');
  // Z-16: the parent and the share it owns of each other member, typed as text until saved
  const [editing, setEditing] = useState<{ id: string | null; name: string; workspaceIds: string[]; parentId: string; shares: Record<string, string> } | null>(null);
  const [busy, setBusy] = useState(false);
  const nameOf = (id: string) => workspaces.find(w => w.id === id)?.name || id;

  const [reload, setReload] = useState(0);
  useEffect(() => {
    let live = true;
    call('', 'GET')
      .then(data => { if (live) { setGroups(data.groups || []); setError(''); } })
      .catch(err => { if (live) { setError(err instanceof Error ? err.message : String(err)); setGroups([]); } });
    return () => { live = false; };
  }, [reload]);
  const load = () => setReload(n => n + 1);

  const ownership = (e: NonNullable<typeof editing>) => e.parentId
    ? Object.fromEntries(e.workspaceIds.filter(id => id !== e.parentId && (e.shares[id] ?? '').trim() !== '').map(id => [id, Number(e.shares[id])]))
    : {};
  const problem = editing
    ? (groupProblem(editing) || (editing.workspaceIds.length === 0 ? 'Choose at least one workspace' : null)
      || structureProblem({ workspaceIds: editing.workspaceIds, parentId: editing.parentId || null, ownership: ownership(editing) }))
    : null;
  const edit = (g: WorkspaceGroup) => setEditing({
    id: g.id, name: g.name, workspaceIds: g.workspaceIds, parentId: g.parentId || '',
    shares: Object.fromEntries(Object.entries(g.ownership || {}).map(([id, n]) => [id, String(n)])),
  });
  const save = async () => {
    if (!editing || problem || busy) return;
    setBusy(true);
    try {
      const body = { name: editing.name, workspaceIds: editing.workspaceIds, parentId: editing.parentId || null, ownership: ownership(editing) };
      if (editing.id) await call(`/${encodeURIComponent(editing.id)}`, 'PUT', body); else await call('', 'POST', body);
      toast.success(editing.id ? `Saved ${editing.name.trim()}` : `Group ${editing.name.trim()} made`);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (group: WorkspaceGroup) => {
    if (busy) return;
    setBusy(true);
    try {
      await call(`/${encodeURIComponent(group.id)}`, 'DELETE');
      toast.success(`Group ${group.name} removed (its workspaces are untouched)`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: string, on: boolean) => setEditing(e => e && ({
    ...e, workspaceIds: on ? [...e.workspaceIds, id] : e.workspaceIds.filter(x => x !== id), parentId: !on && e.parentId === id ? '' : e.parentId,
  }));
  const shareText = (g: WorkspaceGroup) => g.parentId
    ? `Parent: ${nameOf(g.parentId)}${g.workspaceIds.filter(id => id !== g.parentId).map(id => `; ${nameOf(id)} ${g.ownership?.[id] ?? 100}%`).join('')}`
    : '';

  return (
    <section aria-labelledby="groups-title" className="space-y-4">
      <div>
        <h2 id="groups-title" className="text-lg font-bold text-[var(--text)] flex items-center gap-2"><FolderTree className="w-5 h-5" aria-hidden="true" /> Groups of books</h2>
        <p className="text-sm text-[var(--muted)]">Group the workspaces you can open, e.g. a holding and its companies, or clients by kind. Only you see your groups, and a workspace in a group stays exactly as it is.</p>
      </div>
      {error && <p role="alert" className="text-sm text-rose-600">Your groups could not be loaded: {error}</p>}
      {groups === null ? <p className="text-sm text-[var(--muted)]">Loading…</p> : (
        <ul className="rounded-xl border border-[var(--line)] bg-[var(--surface)] divide-y divide-[var(--line)]">
          {groups.length === 0 && <li className="p-4 text-sm text-[var(--muted)]">No groups yet.</li>}
          {groups.map(g => (
            <li key={g.id} className="p-4 flex flex-wrap items-start justify-between gap-2 text-sm">
              <div>
                <p className="font-semibold text-[var(--text)]"><bdi>{g.name}</bdi></p>
                <p className="text-xs text-[var(--muted)]">{g.workspaceIds.length ? g.workspaceIds.map(nameOf).join(', ') : 'No workspaces you can open'}</p>
                {g.parentId && <p className="text-xs text-[var(--muted)]">{shareText(g)}</p>}
              </div>
              <div className="flex gap-2 text-xs">
                <button type="button" disabled={busy} onClick={() => edit(g)} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  Change<span className="sr-only"> {g.name}</span>
                </button>
                <button type="button" disabled={busy} onClick={() => void remove(g)} className="text-rose-600 hover:underline">
                  Remove<span className="sr-only"> {g.name}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <fieldset disabled={busy} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3 text-sm">
          <legend className="px-1 font-semibold text-[var(--text)]">{editing.id ? 'Change the group' : 'New group'}</legend>
          <label className="flex flex-col gap-1 text-[var(--muted)]">Name
            <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className={field} />
          </label>
          <div role="group" aria-label="Workspaces in the group" className="grid gap-1 sm:grid-cols-2">
            {workspaces.map(w => (
              <label key={w.id} className="flex items-center gap-2 text-[var(--text)]">
                <input type="checkbox" checked={editing.workspaceIds.includes(w.id)} onChange={e => toggle(w.id, e.target.checked)} />
                <bdi>{w.name || w.id}</bdi>
              </label>
            ))}
          </div>
          {editing.workspaceIds.length > 1 && (
            <div className="space-y-2">
              <label className="flex flex-col gap-1 text-[var(--muted)]">Parent company (optional)
                <select value={editing.parentId} onChange={e => setEditing({ ...editing, parentId: e.target.value })} className={field}>
                  <option value="">None: just a list of books</option>
                  {editing.workspaceIds.map(id => <option key={id} value={id}>{nameOf(id)}</option>)}
                </select>
              </label>
              {editing.parentId && (
                <div role="group" aria-label="Share the parent owns" className="space-y-1">
                  <p className="text-xs text-[var(--muted)]">The share the parent owns of each company (above 50%; empty is 100%). The rest belongs to other owners, and the group total says how much.</p>
                  {editing.workspaceIds.filter(id => id !== editing.parentId).map(id => (
                    <label key={id} className="flex items-center gap-2 text-[var(--text)]">
                      <bdi className="min-w-[8rem]">{nameOf(id)}</bdi>
                      <input inputMode="decimal" placeholder="100" aria-label={`Share of ${nameOf(id)} owned, in percent`} value={editing.shares[id] ?? ''}
                        onChange={e => setEditing({ ...editing, shares: { ...editing.shares, [id]: e.target.value } })} className={`${field} w-24`} />%
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
          {problem && <p role="status" className="text-xs text-amber-700 dark:text-amber-400">{problem}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => void save()} disabled={Boolean(problem)} className="rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white disabled:opacity-50">Save group</button>
            <button type="button" onClick={() => setEditing(null)} className="text-[var(--muted)] hover:underline">Cancel</button>
          </div>
        </fieldset>
      ) : (
        <button type="button" onClick={() => setEditing({ id: null, name: '', workspaceIds: [], parentId: '', shares: {} })} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-semibold text-[var(--text)] hover:bg-[var(--elevated)]">New group</button>
      )}
    </section>
  );
}
