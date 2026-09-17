import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowRight, UserCheck, AlertTriangle, RefreshCw, CheckCircle2, Lock, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { auth } from '../../firebase';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUIStore } from '../../stores/useUIStore';

interface AcceptInviteViewProps {
  token?: string;
  onSuccess?: () => void;
}

export const AcceptInviteView: React.FC<AcceptInviteViewProps> = ({ token: initialToken, onSuccess }) => {
  const [token, setToken] = useState<string>(initialToken || '');
  const [inviteDetails, setInviteDetails] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<boolean>(false);
  const [accepted, setAccepted] = useState<boolean>(false);

  const user = useAuthStore(s => s.user);
  const setCurrentWorkspaceId = useAuthStore(s => s.setCurrentWorkspaceId);
  const setActiveTab = useUIStore(s => s.setActiveTab);

  useEffect(() => {
    if (!initialToken && typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/invite\/([a-zA-Z0-9_\-]+)/);
      if (match && match[1]) {
        setToken(match[1]);
      }
    }
  }, [initialToken]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('No invite token provided');
      return;
    }

    const loadInvite = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/invites/${token}`);
        const data = await res.json();

        if (res.ok && data.status === 'success') {
          setInviteDetails(data.invite);
        } else {
          setError(data.message || 'Invalid or expired invite token');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to connect to invite service');
      } finally {
        setLoading(false);
      }
    };

    loadInvite();
  }, [token]);

  const handleAcceptInvite = async () => {
    if (!token) return;

    try {
      setAccepting(true);
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        toast.error('Authentication required', { description: 'Please sign in to accept this workspace invite.' });
        return;
      }

      const res = await fetch(`/api/v1/invites/${token}/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await res.json();

      if (res.ok && data.status === 'success') {
        setAccepted(true);
        toast.success(`Successfully joined workspace as ${data.role.toUpperCase()}!`);
        
        // Set workspace and navigate
        if (data.workspaceId && setCurrentWorkspaceId) {
          setCurrentWorkspaceId(data.workspaceId);
        }

        setTimeout(() => {
          if (onSuccess) onSuccess();
          else if (setActiveTab) setActiveTab('executive-overview' as any);
        }, 1200);
      } else {
        toast.error('Failed to accept invite', { description: data.message || 'An error occurred' });
      }
    } catch (err: any) {
      toast.error('Acceptance error', { description: err.message });
    } finally {
      setAccepting(false);
    }
  };

  const userEmail = (user?.email || '').toLowerCase().trim();
  const inviteEmail = (inviteDetails?.email || '').toLowerCase().trim();
  const emailMismatch = user && inviteEmail && userEmail !== inviteEmail;

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[var(--surface)] border border-[var(--line)] rounded-[28px] p-8 shadow-2xl space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center mx-auto">
            <Building2 size={24} />
          </div>
          <h2 className="text-xl font-black text-[var(--text)] tracking-tight">
            Workspace Invitation
          </h2>
          <p className="text-xs text-slate-400">
            LedgerFlow Enterprise Permissioned Multi-User Invite
          </p>
        </div>

        {loading ? (
          <div className="py-12 text-center space-y-3">
            <RefreshCw size={24} className="animate-spin text-indigo-500 mx-auto" />
            <p className="text-xs font-mono text-slate-400">Verifying cryptographically signed invite token...</p>
          </div>
        ) : error ? (
          <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-3 text-center">
            <AlertTriangle size={28} className="text-rose-500 mx-auto" />
            <h3 className="text-sm font-bold text-rose-400">Invitation Invalid or Expired</h3>
            <p className="text-xs text-slate-300">{error}</p>
          </div>
        ) : accepted ? (
          <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3 text-center">
            <CheckCircle2 size={32} className="text-emerald-500 mx-auto animate-bounce" />
            <h3 className="text-base font-bold text-emerald-400">Welcome to {inviteDetails?.workspaceName}!</h3>
            <p className="text-xs text-slate-300">Your role ({inviteDetails?.role?.toUpperCase()}) is active. Redirecting to workspace dashboard...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Invite Details Card */}
            <div className="p-4 bg-[var(--ink)]/40 border border-[var(--line)] rounded-2xl space-y-3 text-xs">
              <div className="flex justify-between items-center border-b border-[var(--line)] pb-2">
                <span className="text-slate-400 font-medium">Workspace:</span>
                <span className="font-bold text-[var(--text)]">{inviteDetails?.workspaceName}</span>
              </div>
              <div className="flex justify-between items-center border-b border-[var(--line)] pb-2">
                <span className="text-slate-400 font-medium">Invited Email:</span>
                <span className="font-mono font-bold text-indigo-400">{inviteDetails?.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Assigned Role:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {inviteDetails?.role}
                </span>
              </div>
            </div>

            {/* Auth State Handling */}
            {!user ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3 text-center text-xs">
                <Lock size={20} className="text-amber-500 mx-auto" />
                <p className="text-amber-300 font-semibold">
                  You must be signed in as <span className="underline font-bold">{inviteDetails?.email}</span> to accept this invitation.
                </p>
                <button
                  onClick={() => {
                    if (setActiveTab) setActiveTab('auth' as any);
                  }}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs rounded-xl transition-all"
                >
                  Sign In / Create Account
                </button>
              </div>
            ) : emailMismatch ? (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-3 text-center text-xs">
                <AlertTriangle size={20} className="text-rose-500 mx-auto" />
                <p className="text-rose-300 font-semibold">
                  Signed in as <span className="font-bold">{user.email}</span>. This invitation was sent to <span className="font-bold">{inviteDetails?.email}</span>.
                </p>
                <p className="text-slate-400 text-[11px]">
                  Please sign out and sign in with <span className="font-bold text-slate-200">{inviteDetails?.email}</span> to accept.
                </p>
              </div>
            ) : (
              <button
                onClick={handleAcceptInvite}
                disabled={accepting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
              >
                {accepting ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <>
                    <UserCheck size={16} />
                    <span>Accept & Join {inviteDetails?.workspaceName}</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default AcceptInviteView;
