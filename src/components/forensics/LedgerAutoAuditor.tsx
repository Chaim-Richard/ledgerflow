import { useEffect, useRef } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';

export function LedgerAutoAuditor() {
  const transactionsLength = useLedgerStore(state => state.transactions.length);
  const accountsLength = useLedgerStore(state => state.accounts.length);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (transactionsLength > 0 && accountsLength > 0) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        useLedgerStore.getState().runFullAudit();
      }, 400);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [transactionsLength, accountsLength]);

  return null;
}
