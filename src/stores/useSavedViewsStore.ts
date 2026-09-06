import { create } from 'zustand';
import { Transaction, ChartAccount } from '../types';
import { useUIStore } from './useUIStore';
import { isPostable, isIncomeTransaction, isExpenseTransaction } from '../lib/txFilters';

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
  
  activeViewId: 'view-liquid-cash',

  loadViewsForWorkspace: (workspaceId?: string | null) => {
    const views = loadViewsFromStorage(workspaceId);
    const activeViewId = views[0]?.id || null;
    set({ views, activeViewId });
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
      const nextActive = state.activeViewId === id ? (nextViews[0]?.id || null) : state.activeViewId;
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
    set({ views: DEFAULT_PRESET_VIEWS, activeViewId: 'view-liquid-cash' });
  },

  applySavedView: (view) => {
    useUIStore.getState().setFilterCriteria({
      searchTerm: view.filter.searchTerm || '',
      startDate: view.filter.startDate,
      endDate: view.filter.endDate,
      minAmountCents: view.filter.minAmountCents,
      maxAmountCents: view.filter.maxAmountCents,
      accountIds: view.filter.accountIds,
      accountTypes: view.filter.accountTypes,
      status: view.filter.status,
      type: view.filter.type,
      projectId: view.filter.projectId,
      customerId: view.filter.customerId,
      vendorId: view.filter.vendorId,
      tags: view.filter.tags,
      payee: view.filter.payee,
      isTaxDeductibleOnly: view.filter.isTaxDeductibleOnly,
      hasAttachmentOnly: view.filter.hasAttachmentOnly,
      viewId: view.id,
      viewName: view.name,
    });

    if (view.targetTab && view.targetTab !== 'all') {
      useUIStore.getState().setActiveTab(view.targetTab as any);
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
  invoices: any[] = [],
  bills: any[] = []
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

    if (filter.startDate && tx.date < filter.startDate) return;
    if (filter.endDate && tx.date > filter.endDate) return;

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
      const mainLineAcc = tx.lines?.[0]?.accountId;
      const acc = mainLineAcc ? accountMap.get(mainLineAcc) : null;
      if (acc && !filter.accountTypes.includes(acc.type)) return;
    }

    if (filter.isTaxDeductibleOnly) {
      const isTaxTag = tx.lines?.some((l) => l.tags?.some((t) => t.toLowerCase().includes('tax')));
      const isTaxDesc = (tx.description || '').toLowerCase().includes('tax');
      if (!isTaxTag && !isTaxDesc && !(tx as any).isReconciled) return;
    }

    if (filter.projectId && tx.projectId !== filter.projectId) return;

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
    if (isInc) {
      moneyInCents += absAmt;
      totalSumCents += absAmt;
    } else if (isExp) {
      moneyOutCents += absAmt;
      totalSumCents -= absAmt;
    } else {
      if (tx.type === 'income') {
        moneyInCents += absAmt;
        totalSumCents += absAmt;
      } else if (tx.type === 'expense') {
        moneyOutCents += absAmt;
        totalSumCents -= absAmt;
      } else {
        totalSumCents += absAmt;
      }
    }
  });

  const netBalanceCents = moneyInCents - moneyOutCents;
  const averageAmountCents = matchingCount > 0 ? Math.round(totalSumCents / matchingCount) : 0;

  return {
    totalMoneyCents: Math.abs(totalSumCents),
    moneyInCents,
    moneyOutCents,
    netBalanceCents,
    matchingCount,
    averageAmountCents,
  };
}
