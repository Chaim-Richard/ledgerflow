import { parseLocalDate } from '../lib/utils';
import { useState, useMemo, useCallback } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { ChartAccount, Transaction } from '../types';
import { toast } from 'sonner';
import { isPostable, isOpenInvoice, isOpenBill, lineAmount, isRevenueAccount, isExpenseAccount, calculateTransactionImpact } from '../lib/txFilters';
import { resolveAccountRole } from '../lib/accountUtils';

export function useFinancialReporting() {
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const invoices = useLedgerStore(s => s.invoices);
  const bills = useLedgerStore(s => s.bills);
  const [loading, setLoading] = useState(false);
  const [apiReports, setApiReports] = useState<any>({ pl: null, aging: null, agingAP: null, cashFlow: null });

  const fetchPL = useCallback(async (startDate?: string, endDate?: string) => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const user = useAuthStore.getState().user;
      if (!user) return;
      
      let url = `/api/v1/reports/pl?workspaceId=${currentWorkspaceId}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const token = await user.getIdToken();
      const response = await fetch(url, {
         headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.status === 'success') {
         setApiReports((prev: any) => ({ ...prev, pl: data.data }));
      }
    } catch (e: any) {
      toast.error('Failed to fetch P&L');
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId]);

  const fetchAging = useCallback(async (type: 'ar' | 'ap') => {
    if (!currentWorkspaceId) return;
    setLoading(true);

    try {
      const rawItems = type === 'ar' ? invoices : bills;
      const items = rawItems.filter(item => type === 'ar' ? isOpenInvoice(item) : isOpenBill(item));
      const now = new Date();
      
      const aging = {
        current: 0,
        "1-30": 0,
        "31-60": 0,
        "61-90": 0,
        "90+": 0,
        total: 0
      };

      items.forEach((item: any) => {
        const dueDate = parseLocalDate(item.dueDate);
        const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        const amount = item.amountCents || item.totalCents || 0;

        if (diffDays <= 0) aging.current += amount;
        else if (diffDays <= 30) aging["1-30"] += amount;
        else if (diffDays <= 60) aging["31-60"] += amount;
        else if (diffDays <= 90) aging["61-90"] += amount;
        else aging["90+"] += amount;

        aging.total += amount;
      });

      setApiReports((prev: any) => ({ ...prev, [type === 'ar' ? 'aging' : 'agingAP']: aging }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, invoices, bills]);

  const fetchCashFlow = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);

    try {
      const cashFlow = {
        operating: { total: 0, items: [] as any[] },
        investing: { total: 0, items: [] as any[] },
        financing: { total: 0, items: [] as any[] },
        netChange: 0
      };

      transactions.filter(isPostable).forEach((tx: any) => {
        const accountMap = new Map(accounts.map(a => [a.id, a]));
        tx.lines?.forEach((line: any) => {
          const acc = accountMap.get(line.accountId);
          if (!acc) return;

          const role = resolveAccountRole(acc);
          const amt = lineAmount(line, tx);

          if (isRevenueAccount(acc)) cashFlow.operating.total -= amt;
          if (isExpenseAccount(acc)) cashFlow.operating.total -= amt;

          if (role === 'ar' || acc.category === 'Receivables' || acc.category === 'Receivable') cashFlow.operating.total -= amt;
          if (role === 'ap' || acc.category === 'Payables' || acc.category === 'Payable') cashFlow.operating.total += amt;

          if (acc.category === 'Fixed Assets' || acc.category === 'Fixed Asset') {
            cashFlow.investing.total -= amt;
            cashFlow.investing.items.push({ name: tx.description, amount: -amt });
          }

          if (acc.type === 'equity' || acc.category === 'Debt' || acc.category === 'Long Term Liability') {
            cashFlow.financing.total += amt;
            cashFlow.financing.items.push({ name: tx.description, amount: amt });
          }
        });
      });

      cashFlow.netChange = cashFlow.operating.total + cashFlow.investing.total + cashFlow.financing.total;

      setApiReports((prev: any) => ({ ...prev, cashFlow }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, accounts, transactions]);

  // Combined reports object
  const reports = useMemo(() => {
    // Local calculation for immediate feedback
    let localIncome = 0;
    let localExpenses = 0;
    const accountMap = new Map(accounts.map(a => [a.id, a]));

    transactions.filter(isPostable).forEach((t: Transaction) => {
      const impact = calculateTransactionImpact(t, accountMap);
      if (impact > 0) localIncome += impact;
      else if (impact < 0) localExpenses += Math.abs(impact);
    });

    return {
      ...apiReports,
      local: { income: localIncome, expenses: localExpenses, netIncome: localIncome - localExpenses }
    };
  }, [transactions, accounts, apiReports]);

  return { reports, loading, fetchPL, fetchAging, fetchCashFlow };
}
