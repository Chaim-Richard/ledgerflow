import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Mail, ShieldCheck, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { auth } from '../../../firebase';
import { useAuthStore } from '../../../stores/useAuthStore';

export default function TeamSettings() {
  const currentWorkspace = useAuthStore(s => s.getCurrentWorkspace());
  const workspaceId = currentWorkspace?.id || 'default_workspace';

  const [members, setMembers] = useState<string[]>([]);
  const [ownerUid, setOwnerUid] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [inviteInput, setInviteInput] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const res = await fetch(`/api/v1/workspaces/${workspaceId}/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status === 'success') {
        setMembers(data.members || []);
        if (data.ownerUid) setOwnerUid(data.ownerUid);
      }
    } catch (err: any) {
      toast.error('Failed to load workspace team members', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token || !active) return;

        const res = await fetch(`/api/v1/workspaces/${workspaceId}/members`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.status === 'success' && active) {
          setMembers(data.members || []);
          if (data.ownerUid) setOwnerUid(data.ownerUid);
        }
      } catch (err: any) {
        if (active) toast.error('Failed to load workspace team members', { description: err.message });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [workspaceId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteInput.trim()) return;

    try {
      setSubmitting(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const isEmail = inviteInput.includes('@');
      const body = isEmail ? { email: inviteInput.trim() } : { memberUid: inviteInput.trim() };

      const res = await fetch(`/api/v1/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.status === 'success') {
        toast.success(`Member invited/added to workspace.`);
        setInviteInput('');
        setMembers(data.members || []);
      } else {
        toast.error('Failed to invite member', { description: data.error || 'Unknown error' });
      }
    } catch (err: any) {
      toast.error('Error adding member', { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (memberUid: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const res = await fetch(`/api/v1/workspaces/${workspaceId}/members/${memberUid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (data.status === 'success') {
        toast.success('Member removed from workspace.');
        setMembers(data.members || []);
      } else {
        toast.error('Failed to remove member', { description: data.error || 'Unknown error' });
      }
    } catch (err: any) {
      toast.error('Error removing member', { description: err.message });
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h3 className="text-xl font-black text-[var(--text)] tracking-tight flex items-center gap-2">
          <Users size={20} className="text-indigo-600" />
          Workspace Members & Bookkeeper Invites
        </h3>
        <p className="text-sm text-slate-500 max-w-xl">
          Grant bookkeepers and finance team members access to <span className="font-bold text-[var(--text)]">{currentWorkspace?.name || 'this workspace'}</span>. Top-level Firestore rules authorize all assigned members.
        </p>
      </div>

      {/* Invite form */}
      <form onSubmit={handleAddMember} className="p-6 bg-[var(--surface)] border border-[var(--line)] rounded-[24px] space-y-4">
        <div className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <UserPlus size={14} className="text-indigo-500" /> Invite Team Member or Bookkeeper
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder="Enter bookkeeper email address or User ID"
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--ink)] border border-[var(--line)] rounded-xl text-xs font-semibold text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !inviteInput.trim()}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <UserPlus size={14} />}
            <span>Grant Access</span>
          </button>
        </div>
      </form>

      {/* Active Members List */}
      <div className="p-6 bg-[var(--surface)] border border-[var(--line)] rounded-[24px] space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div className="text-xs font-black uppercase tracking-wider text-slate-400">
            Authorized Workspace Members ({members.length + 1})
          </div>
          <button
            onClick={fetchMembers}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-200 flex items-center gap-1"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs text-slate-500 font-mono">Loading team manifest...</div>
        ) : (
          <div className="space-y-2">
            {/* Owner item */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--ink)]/40 border border-[var(--line)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-600 font-bold flex items-center justify-center text-xs">
                  OW
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--text)] font-mono">
                    {ownerUid || auth.currentUser?.uid || 'Workspace Owner'}
                  </div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <ShieldCheck size={10} className="text-indigo-500" /> Primary Owner / Admin
                  </div>
                </div>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200">
                Owner
              </span>
            </div>

            {/* Invited Members */}
            {members.map((mUid) => (
              <div key={mUid} className="flex items-center justify-between p-3 rounded-xl bg-[var(--ink)]/20 border border-[var(--line)]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-600/10 border border-emerald-500/20 text-emerald-600 font-bold flex items-center justify-center text-xs">
                    BK
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--text)] font-mono">{mUid}</div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Check size={10} className="text-emerald-500" /> Active Member
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveMember(mUid)}
                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors text-xs font-bold flex items-center gap-1"
                  title="Revoke workspace access"
                >
                  <Trash2 size={14} />
                  <span className="text-[10px] uppercase">Revoke</span>
                </button>
              </div>
            ))}

            {members.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400 italic">
                No additional bookkeepers or team members invited yet. Invite your bookkeeper above to allow parallel month-end verification.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
