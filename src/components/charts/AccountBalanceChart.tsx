import React, { useEffect, useMemo, useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFinancialReporting, type ServerTrialBalanceData } from '../../hooks/useFinancialReporting';
import { computeTrialBalance } from '../../server/reports/computeReports';
import { collection, query, where, getDocs } from '../../lib/db/firestore';
import { db } from '../../firebase';
import type { ChartAccount, Transaction } from '../../types';
import AccountIcicle from './AccountIcicle';

export default function AccountBalanceChart({ endDate, currency }: { endDate: string; currency?: string }) {
  const uid = useAuthStore(state => state.user?.uid), workspace = useAuthStore(state => state.currentWorkspaceId);
  return <ScopedBalanceChart key={JSON.stringify([uid, workspace])} endDate={endDate} currency={currency} />;
}
function ScopedBalanceChart({ endDate, currency }: { endDate: string; currency?: string }) {
  const workspace = useAuthStore(state => state.currentWorkspaceId);
  const guest = useAuthStore(state => state.isGuest && !state.user);
  const accounts = useLedgerStore(state => state.accounts), transactions = useLedgerStore(state => state.transactions);
  const { fetchTrialBalance } = useFinancialReporting();
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ date: string; sourceAccounts: ChartAccount[]; sourceTransactions: Transaction[]; report?: ServerTrialBalanceData; accounts?: ChartAccount[]; error?: string }>();
  const cached = useMemo(() => {
    const cacheWorkspace = guest ? 'guest' : workspace || undefined;
    const scoped = accounts.filter(account => !!cacheWorkspace && account.workspaceId === cacheWorkspace);
    return { accounts: scoped, report: computeTrialBalance(scoped, transactions.filter(tx => !!cacheWorkspace && tx.workspaceId === cacheWorkspace), endDate) };
  }, [accounts, transactions, workspace, guest, endDate]);
  useEffect(() => {
    if (guest || !workspace || !endDate) return;
    let active = true;
    Promise.all([fetchTrialBalance(endDate), getDocs(query(collection(db, 'chartAccounts'), where('workspaceId', '==', workspace)))]).then(([report, snapshot]) => {
      if (!report || !Array.isArray(report.accounts)) throw new Error('The account balance report could not be read.');
      if (active) setResult({ date: endDate, sourceAccounts: accounts, sourceTransactions: transactions, report, accounts: snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ChartAccount)) });
    }).catch(error => { if (active) setResult({ date: endDate, sourceAccounts: accounts, sourceTransactions: transactions, error: error instanceof Error ? error.message : 'The account balance report could not be read.' }); });
    return () => { active = false; };
  }, [guest, workspace, endDate, accounts, transactions, fetchTrialBalance, refresh]);
  const current = result?.date === endDate && result.sourceAccounts === accounts && result.sourceTransactions === transactions ? result : undefined;
  const records = current?.accounts || (guest ? cached.accounts : []);
  const report = current?.report || (guest ? cached.report : { accounts: [] });
  const byId = new Map(records.map(account => [account.id, account]));
  const members = report.accounts.map(row => ({ ...row, parentId: byId.get(row.id)?.parentId }));
  return <div className="space-y-2 min-w-0"><p>Account closing balances as of {endDate}, including opening balances and earlier posted activity.</p>
    {!current?.report && <p role="status">{!workspace && !guest ? 'Choose a workspace to read account balances.' : guest ? 'Guest demonstration using loaded history.' : current?.error ? `Account balances unavailable: ${current.error}` : 'Loading full account balances…'}</p>}
    {!guest && workspace && <button type="button" disabled={!current} aria-busy={!current} className="min-h-11 px-3 border rounded disabled:opacity-50" onClick={() => { setResult(undefined); setRefresh(value => value + 1); }}>Refresh account balances</button>}
    {(guest || current?.report) && <AccountIcicle key={endDate} members={members} currency={currency} />}
  </div>;
}
