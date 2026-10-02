import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import { formatDate } from '../../lib/utils';
import { describeError } from '../../lib/errorRemedies';

/**
 * A deleted workspace waits 30 days before it is purged (workspacePurgeService.ts). Until then this
 * says when, and an owner can keep it (POST /api/v1/workspaces/:id/cancel-deletion).
 */
export default function PendingDeletionBanner() {
  const workspace = useAuthStore(s => s.getCurrentWorkspace());
  const user = useAuthStore(s => s.user);
  const role = useCurrentRole();
  const [busy, setBusy] = useState(false);
  if (!workspace || workspace.status !== 'pending_deletion') return null;
  const when = workspace.scheduledPurgeAt ? formatDate(workspace.scheduledPurgeAt.slice(0, 10)) : 'soon';

  const keep = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/workspaces/${encodeURIComponent(workspace.id)}/cancel-deletion`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || body.error || 'The workspace could not be kept');
      useAuthStore.getState().setWorkspaces(useAuthStore.getState().workspaces.map(w => w.id === workspace.id ? { ...w, status: 'active', scheduledPurgeAt: undefined, deletedAt: undefined } : w));
      toast.success(`"${workspace.name}" is kept`);
    } catch (err) {
      const described = describeError(err, 'update');
      toast.error(described.title, { description: described.remedy });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="alert" className="border-b border-[var(--neg)] bg-[var(--neg)]/10 text-[var(--text)] px-4 py-2 text-xs flex flex-wrap items-center gap-3">
      <AlertTriangle size={14} className="text-[var(--neg)]" aria-hidden="true" />
      <span>This workspace was deleted. Everything in it will be removed on <strong>{when}</strong>.</span>
      {role === 'owner' ? (
        <button type="button" disabled={busy} onClick={keep} className="underline font-semibold disabled:opacity-50">
          {busy ? 'Keeping…' : 'Keep this workspace'}
        </button>
      ) : (
        <span className="text-[var(--muted)]">Only an owner can keep it.</span>
      )}
    </div>
  );
}
