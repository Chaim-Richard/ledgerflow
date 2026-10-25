import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useLedgerCollections } from './useLedgerCollections';
import { useTeamRequests } from './useTeamRequests';
import { multiFactor } from '../lib/db/auth';
import { accessReviewRows, TWO_STEP_CHANGED, type AccessReviewRow } from '../lib/accessReview';

/**
 * Everything the access review (C-35) and the audit evidence pack (C-36) read: the workspace's
 * people and roles from the existing server routes, the audit trail the screen can already see,
 * and the signed-in person's own two-step status. One place, so the screen and the pack can never
 * disagree about who is in the workspace. Read-only.
 */
export interface AccessReviewData {
  status: 'loading' | 'ready' | 'error';
  error: string;
  rows: AccessReviewRow[];
  requireTwoStep: boolean;
  /** the audit collection stopped at its cap: older entries are not loaded here */
  auditTruncated: boolean;
  reload: () => void;
}

interface TeamState {
  status: 'loading' | 'ready' | 'error';
  members: string[];
  ownerUid: string;
  roles: Record<string, string>;
  error: string;
}

export function useAccessReview(workspaceId: string): AccessReviewData {
  const workspace = useAuthStore(s => s.getCurrentWorkspace());
  const user = useAuthStore(s => s.user);
  const { request } = useTeamRequests(workspaceId);
  const { loading: auditLoading } = useLedgerCollections('auditLogs');
  const auditFailed = useDataNeedsStore(s => s.failed.auditLogs);
  const auditLogs = useLedgerStore(s => s.auditLogs || []);
  const auditTruncated = useLedgerStore(s => Boolean(s.truncatedCollections?.auditLogs));
  const [team, setTeam] = useState<TeamState>({ status: 'loading', members: [], ownerUid: '', roles: {}, error: '' });
  const [selfTwoStep, setSelfTwoStep] = useState<boolean | null>(null);

  const loadTeam = useCallback(async () => {
    setTeam(current => ({ ...current, status: 'loading', error: '' }));
    try {
      const [members, roles] = await Promise.all([
        request(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/members`),
        request(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/roles`),
      ]);
      setTeam({
        status: 'ready',
        members: Array.isArray(members.members) ? members.members : [],
        ownerUid: String(members.ownerUid || roles.ownerUid || workspace?.uid || ''),
        roles: { ...(roles.roles || {}), ...(members.roles || {}) },
        error: '',
      });
    } catch (err) {
      setTeam(current => ({ ...current, status: 'error', error: err instanceof Error ? err.message : 'The workspace members could not be loaded.' }));
    }
  }, [request, workspaceId, workspace?.uid]);

  useEffect(() => { void loadTeam(); }, [loadTeam]);

  // Another person's authenticator status belongs to their account: only the reader's own is readable.
  // Re-read on mount, when the authenticator panel reports a change, and on Refresh — an auditor must
  // never get yesterday's "on" after someone turned it off.
  const loadSelf = useCallback(async () => {
    const account = useAuthStore.getState().user;
    if (!account || account.isAnonymous || useAuthStore.getState().isGuest) { setSelfTwoStep(null); return; }
    try {
      const factors = await multiFactor(account).getFactors();
      setSelfTwoStep(factors.some(factor => factor.status === 'verified'));
    } catch { setSelfTwoStep(null); }
  }, []);

  useEffect(() => {
    let live = true;
    const read = () => { if (live) void loadSelf(); };
    read();
    window.addEventListener(TWO_STEP_CHANGED, read);
    return () => { live = false; window.removeEventListener(TWO_STEP_CHANGED, read); };
  }, [loadSelf]);

  const emails = useMemo(() => {
    const found: Record<string, string> = {};
    for (const log of auditLogs) {
      if (log.uid && log.userEmail && !found[log.uid]) found[log.uid] = log.userEmail;
    }
    return found;
  }, [auditLogs]);

  const rows = useMemo(() => accessReviewRows({
    ownerUid: team.ownerUid,
    members: team.members,
    roles: team.roles,
    requireTwoStep: workspace?.requireTwoStep === true,
    auditLogs,
    selfUid: user?.uid,
    selfTwoStep,
    emails,
  }), [team, workspace?.requireTwoStep, auditLogs, user?.uid, selfTwoStep, emails]);

  const failure = team.status === 'error'
    ? team.error
    : auditFailed ? `The audit trail could not be loaded: ${auditFailed}` : '';
  const status: AccessReviewData['status'] = failure ? 'error' : team.status === 'loading' || (auditLoading && !auditFailed) ? 'loading' : 'ready';

  return {
    status,
    error: failure,
    rows,
    requireTwoStep: workspace?.requireTwoStep === true,
    auditTruncated,
    reload: () => { useDataNeedsStore.getState().retry('auditLogs'); void loadTeam(); void loadSelf(); },
  };
}
