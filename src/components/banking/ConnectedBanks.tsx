import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getIdToken } from '../../firebase';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import { readBankStatuses, type BankStatus } from '../../lib/bankFeedStatus';
import PlaidConnectButton from '../finance/PlaidConnectButton';

/**
 * The workspace's bank connections on Bank Connections: each with its state and last good sync,
 * "Reconnect" when its login expired, and "Disconnect" for owners and accountants (Z-30): the bank is
 * told to stop and the stored connection is removed; the bank lines already imported stay.
 */
export default function ConnectedBanks() {
  const workspaceId = useAuthStore(s => s.currentWorkspaceId);
  const role = useCurrentRole();
  const [banks, setBanks] = useState<BankStatus[] | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState('');
  useEffect(() => {
    if (!workspaceId) return;
    let live = true;
    (async () => {
      const res = await fetch(`/api/v1/plaid/banks?workspaceId=${encodeURIComponent(workspaceId)}`, { headers: { Authorization: `Bearer ${await getIdToken()}` } });
      if (!res.ok) return [];
      return readBankStatuses(await res.json());
    })().then(list => { if (live) setBanks(list); }).catch(() => { if (live) setBanks([]); });
    return () => { live = false; };
  }, [workspaceId, reload]);

  const disconnect = async (bank: BankStatus) => {
    if (!workspaceId || busy) return;
    if (!window.confirm(`Disconnect ${bank.institutionName}? No new bank lines will arrive from it; the lines already imported stay.`)) return;
    setBusy(bank.id);
    try {
      const res = await fetch('/api/v1/plaid/disconnect', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getIdToken()}` },
        body: JSON.stringify({ workspaceId, bankId: bank.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'The bank was not disconnected');
      toast.success(`${bank.institutionName} disconnected; its imported lines are kept`);
      setReload(n => n + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy('');
    }
  };

  if (!banks || banks.length === 0) return null;
  return (
    <section aria-labelledby="connected-banks-title" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <h2 id="connected-banks-title" className="text-sm font-bold text-[var(--text)]">Connected banks</h2>
      <ul className="mt-2 divide-y divide-[var(--line)] text-sm">
        {banks.map(bank => (
          <li key={bank.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <bdi className="font-semibold text-[var(--text)]">{bank.institutionName}</bdi>
              <span className="block text-xs text-[var(--muted)]">
                {bank.status === 'login_required' ? 'Login expired' : 'Connected'} · last good sync: {bank.lastSyncedAt ? new Date(bank.lastSyncedAt).toLocaleString() : 'never'}
              </span>
            </span>
            <span className="flex items-center gap-2">
              {bank.status === 'login_required' && role !== 'viewer' && <PlaidConnectButton bankId={bank.id} label="Reconnect" onSuccessSync={() => setReload(n => n + 1)} />}
              {(role === 'owner' || role === 'accountant') && (
                <button type="button" disabled={busy !== ''} onClick={() => void disconnect(bank)} className="text-xs text-rose-600 hover:underline disabled:opacity-50">
                  Disconnect<span className="sr-only"> {bank.institutionName}</span>
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
