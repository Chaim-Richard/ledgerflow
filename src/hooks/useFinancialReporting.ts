import { useState, useMemo, useCallback } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { ChartAccount, Transaction } from '../types';
import { toast } from 'sonner';
import { isPostable, calculateTransactionImpact } from '../lib/txFilters';

export interface ServerPLData {
  income: { total: number; accounts: Record<string, { name: string; code?: string; balance: number; parentId?: string }> };
  cogs: { total: number; accounts: Record<string, { name: string; code?: string; balance: number; parentId?: string }> };
  expense: { total: number; accounts: Record<string, { name: string; code?: string; balance: number; parentId?: string }> };
  grossProfit: number;
  netIncome: number;
}

export interface ServerBalanceSheetData {
  assets: Record<string, number>;
  liabilities: Record<string, number>;
  equity: Record<string, number>;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  currentPeriodNetIncome: number;
  totalClaims: number;
  isBalanced: boolean;
}

export interface ServerTrialBalanceData {
  accounts: Record<string, { name: string; code?: string; type: string; debit: number; credit: number; netSigned: number }>;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

export interface ServerCashFlowData {
  operating: { total: number; items: Array<{ name: string; amount: number }> };
  investing: { total: number; items: Array<{ name: string; amount: number }> };
  financing: { total: number; items: Array<{ name: string; amount: number }> };
  netChange: number;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = useAuthStore.getState().user;
  if (!user) return {};
  try {
    const token = await user.getIdToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export function useFinancialReporting() {
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const [loading, setLoading] = useState(false);
  const [loadingStates, setLoadingStates] = useState<{ pl: boolean; bs: boolean; tb: boolean; cf: boolean }>({
    pl: false,
    bs: false,
    tb: false,
    cf: false,
  });
  const [apiReports, setApiReports] = useState<{
    pl: ServerPLData | null;
    balanceSheet: ServerBalanceSheetData | null;
    trialBalance: ServerTrialBalanceData | null;
    cashFlow: ServerCashFlowData | null;
    aging: any | null;
    agingAP: any | null;
  }>({
    pl: null,
    balanceSheet: null,
    trialBalance: null,
    cashFlow: null,
    aging: null,
    agingAP: null,
  });

  const fetchPL = useCallback(async (startDate?: string, endDate?: string): Promise<ServerPLData | null> => {
    if (!currentWorkspaceId) return null;
    setLoading(true);
    setLoadingStates(prev => ({ ...prev, pl: true }));
    try {
      const headers = await getAuthHeaders();
      let url = `/api/v1/reports/profit-and-loss?workspaceId=${currentWorkspaceId}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const data = await response.json();
      const report: ServerPLData = data.data || data;
      setApiReports(prev => ({ ...prev, pl: report }));
      return report;
    } catch (e: any) {
      console.warn('P&L server fetch fallback:', e);
      return null;
    } finally {
      setLoading(false);
      setLoadingStates(prev => ({ ...prev, pl: false }));
    }
  }, [currentWorkspaceId]);

  const fetchBalanceSheet = useCallback(async (endDate?: string): Promise<ServerBalanceSheetData | null> => {
    if (!currentWorkspaceId) return null;
    setLoading(true);
    setLoadingStates(prev => ({ ...prev, bs: true }));
    try {
      const headers = await getAuthHeaders();
      let url = `/api/v1/reports/balance-sheet?workspaceId=${currentWorkspaceId}`;
      if (endDate) url += `&endDate=${endDate}`;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const data = await response.json();
      const report: ServerBalanceSheetData = data.data || data;
      setApiReports(prev => ({ ...prev, balanceSheet: report }));
      return report;
    } catch (e: any) {
      console.warn('Balance Sheet server fetch fallback:', e);
      return null;
    } finally {
      setLoading(false);
      setLoadingStates(prev => ({ ...prev, bs: false }));
    }
  }, [currentWorkspaceId]);

  const fetchTrialBalance = useCallback(async (asOfDate?: string): Promise<ServerTrialBalanceData | null> => {
    if (!currentWorkspaceId) return null;
    setLoading(true);
    setLoadingStates(prev => ({ ...prev, tb: true }));
    try {
      const headers = await getAuthHeaders();
      let url = `/api/v1/reports/trial-balance?workspaceId=${currentWorkspaceId}`;
      if (asOfDate) url += `&asOfDate=${asOfDate}`;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const data = await response.json();
      const report: ServerTrialBalanceData = data.data || data;
      setApiReports(prev => ({ ...prev, trialBalance: report }));
      return report;
    } catch (e: any) {
      console.warn('Trial Balance server fetch fallback:', e);
      return null;
    } finally {
      setLoading(false);
      setLoadingStates(prev => ({ ...prev, tb: false }));
    }
  }, [currentWorkspaceId]);

  const fetchCashFlow = useCallback(async (startDate?: string, endDate?: string): Promise<ServerCashFlowData | null> => {
    if (!currentWorkspaceId) return null;
    setLoading(true);
    setLoadingStates(prev => ({ ...prev, cf: true }));
    try {
      const headers = await getAuthHeaders();
      let url = `/api/v1/reports/cash-flow?workspaceId=${currentWorkspaceId}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const data = await response.json();
      const report: ServerCashFlowData = data.data || data;
      setApiReports(prev => ({ ...prev, cashFlow: report }));
      return report;
    } catch (e: any) {
      console.warn('Cash flow server fetch fallback:', e);
      return null;
    } finally {
      setLoading(false);
      setLoadingStates(prev => ({ ...prev, cf: false }));
    }
  }, [currentWorkspaceId]);

  const fetchAging = useCallback(async (type: 'ar' | 'ap') => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/v1/reports/aging?workspaceId=${currentWorkspaceId}&type=${type}`, { headers });
      if (response.ok) {
        const data = await response.json();
        setApiReports(prev => ({ ...prev, [type === 'ar' ? 'aging' : 'agingAP']: data.data || data }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId]);

  // Combined reports object
  const reports = useMemo(() => {
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

  return { 
    reports, 
    loading, 
    loadingStates,
    fetchPL, 
    fetchBalanceSheet,
    fetchTrialBalance,
    fetchCashFlow,
    fetchAging 
  };
}
