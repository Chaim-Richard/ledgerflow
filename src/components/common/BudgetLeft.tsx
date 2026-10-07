import React, { useMemo } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { availableBudget } from '../../lib/availableBudget';
import type { SavedBudget } from '../../lib/budgetActual';
import { formatCurrency } from '../../lib/utils';

/**
 * Available budget (M-20) under an expense account where money is entered: "Rent, October 2026:
 * $800.00 left of $2,000.00", amber when this amount would go over. Nothing when the account has no
 * budget for that date. Amounts in the home currency.
 */
export function BudgetLeft({ accountId, date, addingCents = 0, excludeDocumentId, currency }: { accountId: string; date: string; addingCents?: number; excludeDocumentId?: string; currency?: string }) {
  useLedgerCollections('budgets');
  const budgets = useLedgerStore(s => s.budgets) as SavedBudget[];
  const accounts = useLedgerStore(s => s.accounts);
  const transactions = useLedgerStore(s => s.transactions);
  const left = useMemo(() => availableBudget({ budgets: budgets || [], accounts: accounts || [], transactions: transactions || [], accountId, date, addingCents, excludeDocumentId }),
    [budgets, accounts, transactions, accountId, date, addingCents, excludeDocumentId]);
  if (!left) return null;
  const money = (cents: number) => formatCurrency(cents, currency);
  const over = left.leftCents < 0;
  return (
    <p role="status" className={`text-[11px] ${left.wouldExceed || over ? 'text-amber-700 font-semibold' : 'text-[var(--muted)]'}`}>
      {left.name}, {left.period}: {over ? `${money(-left.leftCents)} over` : `${money(left.leftCents)} left`} of {money(left.budgetCents)}
      {left.wouldExceed && !over ? `; this goes ${money(addingCents - left.leftCents)} over` : ''}
    </p>
  );
}
