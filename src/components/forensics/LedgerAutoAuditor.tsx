import { useEffect } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';

export function LedgerAutoAuditor() {
  const transactions = useLedgerStore(state => state.transactions);
  const accounts = useLedgerStore(state => state.accounts);
  const journalEntries = useLedgerStore(state => state.journalEntries);

  useEffect(() => {
    if (transactions.length > 0 && accounts.length > 0) {
      useLedgerStore.getState().runFullAudit();
    }
  }, [transactions, accounts, journalEntries]);

  return null;
}
