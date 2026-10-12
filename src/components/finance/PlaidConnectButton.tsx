import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { toast } from 'sonner';
import { Link2 } from 'lucide-react';
import { getIdToken } from '../../firebase';
import { useAuthStore } from '../../stores/useAuthStore';

async function plaidPost(path: string, body: Record<string, unknown>, signal?: AbortSignal) {
  const idToken = await getIdToken();
  signal?.throwIfAborted();
  const response = await fetch(`/api/v1/plaid/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Bank connection failed');
  return data;
}

/**
 * Connect a bank for the current workspace through Plaid Link. With `bankId` it reconnects an
 * existing connection whose bank asked the user to log in again (Plaid update mode).
 */
export default function PlaidConnectButton({ onSuccessSync, bankId, label }: { onSuccessSync?: () => void; bankId?: string; label?: string }) {
  const workspaceId = useAuthStore(s => s.currentWorkspaceId);
  const [token, setToken] = useState<{ workspaceId: string; bankId?: string; value: string } | null>(null);
  const linkToken = token?.workspaceId === workspaceId && token?.bankId === bankId ? token.value : null;

  useEffect(() => {
    if (!workspaceId) return;
    const controller = new AbortController();
    plaidPost('create_link_token', { workspaceId, ...(bankId ? { bankId } : {}) }, controller.signal)
      .then(data => { if (!controller.signal.aborted) setToken({ workspaceId, bankId, value: data.link_token }); })
      .catch(err => { if (!controller.signal.aborted) console.error('Error generating link token:', err); });
    return () => { controller.abort(); };
  }, [workspaceId, bankId]);

  const onSuccess = useCallback(
    async (public_token: string, metadata: { institution?: { name?: string } | null }) => {
      try {
        if (bankId) {
          await plaidPost('reconnected', { workspaceId, bankId });
          toast.success('Bank reconnected');
        } else {
          await plaidPost('exchange_public_token', { workspaceId, public_token, institutionName: metadata?.institution?.name || undefined });
          toast.success('Bank connected via Plaid');
        }
        onSuccessSync?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to connect bank');
      }
    },
    [onSuccessSync, bankId, workspaceId]
  );

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });

  return (
    <button
      type="button"
      onClick={() => open()}
      disabled={!ready}
      className="h-12 px-6 bg-[var(--surface)] hover:border-[var(--brass-line)] border border-[var(--line)] text-[var(--text)] font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center gap-2 active:scale-95 disabled:opacity-50"
    >
      <Link2 size={14} aria-hidden="true" />
      <span>{label || (bankId ? 'Reconnect bank' : 'Connect Bank')}</span>
    </button>
  );
}
