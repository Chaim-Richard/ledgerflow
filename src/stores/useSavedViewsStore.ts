import type { AppTab } from '../types';
import { create } from 'zustand';
import { Transaction, ChartAccount } from '../types';
import { useUIStore } from './useUIStore';
import { isPostable, isIncomeTransaction, isExpenseTransaction, lineAmount, getAbsoluteTotal, isTransactionInDateRange } from '../lib/txFilters';

export interface SavedViewFilter {
  searchTerm?: string;
  startDate?: string;
  endDate?: string;
  minAmountCents?: number;
  maxAmountCents?: number;
  accountIds?: string[];
  accountTypes?: string[];
  status?: string;
  type?: string;
  projectId?: string;
  customerId?: string;
  vendorId?: string;
  tags?: string[];
  payee?: string;
  isTaxDeductibleOnly?: boolean;
  hasAttachmentOnly?: boolean;
}

export interface SavedView {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  isDefault?: boolean; // Multiple default views ARE explicitly supported!
  isPinned?: boolean;
  targetTab?: 'transactions' | 'ledger' | 'sales' | 'purchases' | 'reports' | 'all';
  filter: SavedViewFilter;
  createdAt: string;
  updatedAt: string;
}

export interface ViewMetrics {
  totalMoneyCents: number;
  moneyInCents: number;
  moneyOutCents: number;
  netBalanceCents: number;
  matchingCount: number;
  averageAmountCents: number;
}

const DEFAULT_PRESET_VIEWS: SavedView[] = [
  {
    id: 'view-liquid-cash',
    name: 'Liquid Cash & Bank Funds',
    description: 'Real-time liquidity across cash and liquid bank asset accounts',
    icon: 'Wallet',
    color: '#10b981',
    isDefault: true,
    isPinned: true,
    targetTab: 'transactions',
    filter: {
      accountTypes: ['asset'],
      searchTerm: 'cash bank checking operating savings',
      status: 'all'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'view-high-revenue',
    name: 'High-Value Revenue (> $1,000)',
    description: 'Major sales, customer receipts, and high-value income streams',
    icon: 'TrendingUp',
    color: '#3b82f6',
    isDefault: true,
    isPinned: true,
    targetTab: 'sales',
    filter: {
      minAmountCents: 100000,
      type: 'income'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'view-major-expenses',
    name: 'Major Outflows & Vendor Expenses',
    description: 'Substantial company expenses and recurring operational costs',
    icon: 'TrendingDown',
    color: '#ef4444',
    isDefault: true,
    isPinned: true,
    targetTab: 'purchases',
    filter: {
      minAmountCents: 50000,
      type: 'expense'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'view-tax-deductible',
    name: 'Tax Deductible Expenses',
    description: 'Schedule C / Business tax deductible purchases for audit prep',
    icon: 'Tag',
    color: '#8b5cf6',
    isDefault: true,
    isPinned: true,
    targetTab: 'transactions',
    filter: {
      isTaxDeductibleOnly: true,
      type: 'expense'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'view-pending-audit',
    name: 'Pending & Uncleared Items',
    description: 'Unreconciled, pending, or review-required transactions',
    icon: 'Clock',
    color: '#f59e0b',
    isDefault: false,
    isPinned: true,
    targetTab: 'ledger',
    filter: {
      status: 'pending'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'view-large-outflows',
    name: 'Critical Outflows (> $5,000)',
    description: 'High capital commitments requiring executive review',
    icon: 'ShieldAlert',
    color: '#dc2626',
    isDefault: false,
    isPinned: false,
    targetTab: 'transactions',
    filter: {
      minAmountCents: 500000,
      type: 'expense'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const getSavedViewsStorageKey = (workspaceId?: string | null): string => {
  const wsId = workspaceId || (typeof localStorage !== 'undefined' ? localStorage.getItem('ledgerflow_current_workspace') : null);
  return wsId ? `lf_saved_views_v2_${wsId}` : 'lf_saved_views_v2';
};

const loadViewsFromStorage = (workspaceId?: string | null): SavedView[] => {
  try {
    if (typeof window === 'undefined') return DEFAULT_PRESET_VIEWS;
    const key = getSavedViewsStorageKey(workspaceId);
    let stored = localStorage.getItem(key);
    // Fallback to legacy global key if workspace-specific key not populated yet
    if (!stored && key !== 'lf_saved_views_v2') {
      stored = localStorage.getItem('lf_saved_views_v2');
    }
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error loading saved views:', e);
  }
  return DEFAULT_PRESET_VIEWS;
};

interface SavedViewsState {
  views: SavedView[];
  activeViewId: string | null;
  
  addSavedView: (view: Omit<SavedView, 'id' | 'createdAt' | 'updatedAt'>) => SavedView;
  updateSavedView: (id: string, updates: Partial<SavedView>) => void;
  deleteSavedView: (id: string) => void;
  toggleDefaultView: (id: string) => void;
  togglePinView: (id: string) => void;
  setActiveView: (id: string | null) => void;
  resetToDefaultViews: () => void;
  applySavedView: (view: SavedView) => void;
  loadViewsForWorkspace: (workspaceId?: string | null) => void;
}

export const useSavedViewsStore = create<SavedViewsState>((set, get) => ({
  views: loadViewsFromStorage(),
  
  // the full list until the person picks a view: a preset used to be switched on at every start,
  // so the Transactions list opened showing only some entries (the rest looked missing)
  activeViewId: null,

  loadViewsForWorkspace: (workspaceId?: string | null) => {
    const views = loadViewsFromStorage(workspaceId);
    set({ views, activeViewId: null });
  },

  addSavedView: (newViewData) => {
    const id = `view-custom-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const newView: SavedView = {
      ...newViewData,
      id,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => {
      const nextViews = [newView, ...state.views];
      try {
        localStorage.setItem(getSavedViewsStorageKey(), JSON.stringify(nextViews));
      } catch (e) {
        console.warn("Failed to persist saved view to localStorage", e);
      }
      return { views: nextViews, activeViewId: id };
    });

    get().applySavedView(newView);
    return newView;
  },

  updateSavedView: (id, updates) => {
    set((state) => {
      const nextViews = state.views.map((v) =>
        v.id === id
          ? {
              ...v,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : v
      );
      try {
        localStorage.setItem(getSavedViewsStorageKey(), JSON.stringify(nextViews));
      } catch (e) {
        console.warn("Failed to update saved view in localStorage", e);
      }
      return { views: nextViews };
    });
  },

  deleteSavedView: (id) => {
    set((state) => {
      const nextViews = state.views.filter((v) => v.id !== id);
      try {
        localStorage.setItem(getSavedViewsStorageKey(), JSON.stringify(nextViews));
      } catch (e) {
        console.warn("Failed to delete saved view from localStorage", e);
      }
      const nextActive = state.activeViewId === id ? null : state.activeViewId;
      return { views: nextViews, activeViewId: nextActive };
    });
  },

  toggleDefaultView: (id) => {
    set((state) => {
      // Multiple default views are explicitly supported!
      const nextViews = state.views.map((v) => (v.id === id ? { ...v, isDefault: !v.isDefault } : v));
      try {
        localStorage.setItem(getSavedViewsStorageKey(), JSON.stringify(nextViews));
      } catch (e) {
        console.warn("Failed to persist default view in localStorage", e);
      }
      return { views: nextViews };
    });
  },

  togglePinView: (id) => {
    set((state) => {
      const nextViews = state.views.map((v) => (v.id === id ? { ...v, isPinned: !v.isPinned } : v));
      try {
        localStorage.setItem(getSavedViewsStorageKey(), JSON.stringify(nextViews));
      } catch (e) {
        console.warn("Failed to persist pinned view in localStorage", e);
      }
      return { views: nextViews };
    });
  },

  setActiveView: (id) => {
    set({ activeViewId: id });
    if (id) {
      const view = get().views.find((v) => v.id === id);
      if (view) {
        get().applySavedView(view);
      }
    }
  },

  resetToDefaultViews: () => {
    try {
      localStorage.removeItem(getSavedViewsStorageKey());
      localStorage.removeItem('lf_saved_views_v2');
    } catch (e) {
      console.warn("Failed to reset saved views in localStorage", e);
    }
    set({ views: DEFAULT_PRESET_VIEWS, activeViewId: null });
  },

  applySavedView: (view) => {
    // The view's own conditions are applied by the transaction query (activeView); only its date
    // range goes into the filters (before, fields the filter doesn't know showed up as chips and
    // did nothing)
    const { startDate, endDate } = view.filter;
    useUIStore.getState().setFilterCriteria(startDate || endDate ? { startDate, endDate } : null);

    if (view.targetTab && view.targetTab !== 'all') {
      useUIStore.getState().setActiveTab(view.targetTab as AppTab);
    }
  },
}));

/**
 * Computes exact monetary aggregate metrics for any saved view dynamically against ledger state
 */
export function computeSavedViewMetrics(
  view: SavedView,
  transactions: Transaction[] = [],
  accounts: ChartAccount[] = [],
  _invoices: unknown[] = [],
  _bills: unknown[] = []
): ViewMetrics {
  const filter = view.filter || {};
  const searchLower = (filter.searchTerm || '').toLowerCase();

  const accountMap = new Map<string, ChartAccount>();
  accounts.forEach((a) => accountMap.set(a.id, a));

  let moneyInCents = 0;
  let moneyOutCents = 0;
  let totalSumCents = 0;
  let matchingCount = 0;

  transactions.forEach((tx) => {
    if (!tx || !isPostable(tx)) return;

    const absAmt = Math.abs(tx.totalAmountCents || 0);
    if (filter.minAmountCents !== undefined && absAmt < filter.minAmountCents) return;
    if (filter.maxAmountCents !== undefined && absAmt > filter.maxAmountCents) return;

    if (!isTransactionInDateRange(tx, filter.startDate, filter.endDate)) return;

    const isInc = isIncomeTransaction(tx, accountMap);
    const isExp = isExpenseTransaction(tx, accountMap);

    if (filter.type && filter.type !== 'all') {
      if (filter.type === 'income' && !isInc) return;
      if (filter.type === 'expense' && !isExp) return;
      if (filter.type === 'journal' && tx.type !== 'journal') return;
      if (filter.type === 'bank_import' && tx.type !== 'bank_import') return;
    }

    if (filter.status && filter.status !== 'all') {
      if (tx.status !== filter.status) return;
    }

    if (filter.accountTypes && filter.accountTypes.length > 0) {
      const touchesAccountType = tx.lines?.some((l) => {
        const acc = l.accountId ? accountMap.get(l.accountId) : null;
        return acc && filter.accountTypes!.includes(acc.type);
      });
      if (!touchesAccountType) return;
    }

    if (filter.isTaxDeductibleOnly) {
      const isTaxTag = tx.lines?.some((l) => l.tags?.some((t) => t.toLowerCase().includes('tax')));
      const isTaxDesc = (tx.description || '').toLowerCase().includes('tax');
      const isClearedOrReconciled = tx.status === 'reconciled' || Boolean(tx.isCleared);
      if (!isTaxTag && !isTaxDesc && !isClearedOrReconciled) return;
    }

    if (filter.projectId && tx.projectId !== filter.projectId && tx.project !== filter.projectId) return;

    if (searchLower) {
      const matchDesc = (tx.description || '').toLowerCase().includes(searchLower);
      const matchPayee = (tx.payee || '').toLowerCase().includes(searchLower);
      const matchProject = (tx.project || '').toLowerCase().includes(searchLower);
      const matchLines = tx.lines?.some(
        (l) => (l.description || '').toLowerCase().includes(searchLower) || (l.accountName || '').toLowerCase().includes(searchLower)
      );
      if (!matchDesc && !matchPayee && !matchProject && !matchLines) return;
    }

    matchingCount++;

    // Calculate line-level income and expense impacts (F13)
    let txIncomeCents = 0;
    let txExpenseCents = 0;

    tx.lines?.forEach((l) => {
      const acc = l.accountId ? accountMap.get(l.accountId) : null;
      const amt = lineAmount(l, tx);
      if (acc?.type === 'revenue') {
        txIncomeCents += (-amt); // Revenue is credit normal
      } else if (acc?.type === 'expense' || acc?.type === 'cost_of_goods') {
        txExpenseCents += amt; // Expense is debit normal
      }
    });

    if (txIncomeCents > 0 || txExpenseCents > 0) {
      moneyInCents += txIncomeCents;
      moneyOutCents += txExpenseCents;
      totalSumCents += (txIncomeCents - txExpenseCents);
    } else {
      const txMagnitude = getAbsoluteTotal(tx);
      if (isInc || tx.type === 'income') {
        moneyInCents += txMagnitude;
        totalSumCents += txMagnitude;
      } else if (isExp || tx.type === 'expense') {
        moneyOutCents += txMagnitude;
        totalSumCents -= txMagnitude;
      } else {
        totalSumCents += txMagnitude;
      }
    }
  });

  const netBalanceCents = moneyInCents - moneyOutCents;
  const averageAmountCents = matchingCount > 0 ? Math.round(Math.abs(totalSumCents) / matchingCount) : 0;

  return {
    totalMoneyCents: Math.abs(totalSumCents),
    moneyInCents,
    moneyOutCents,
    netBalanceCents,
    matchingCount,
    averageAmountCents,
  };
}
