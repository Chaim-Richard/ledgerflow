import { create } from 'zustand';
import { LedgerEngine } from '../kernel/ledger/LedgerEngine';
import { DoubleEntryAuditor, AuditResult } from '../services/auditor';
import { globalEventBus } from '../lib/eventBus';
import { isPostable, lineAmount, isRevenueAccount, isExpenseAccount, calculateTransactionImpact } from '../lib/txFilters';
import { 
  Transaction, 
  ChartAccount, 
  JournalEntry, 
  Project, 
  Budget, 
  Vendor, 
  Customer, 
  Invoice, 
  CreditNote,
  Payment,
  Estimate,
  Bill, 
  VendorCredit, 
  InventoryItem, 
  FixedAsset, 
  RecurringTransaction, 
  Employee, 
  PayRun, 
  TaxRate,
  CustomTemplate,
  BankStatementLine
} from '../types';


import { DoubleEntryValidator } from '../kernel/validation/DoubleEntryValidator';
export interface LedgerState {
  _version: number;
  _lastSync: number;
  transactions: Transaction[];
  accounts: ChartAccount[];
  journalEntries: JournalEntry[];
  projects: Project[];
  budgets: Budget[];
  vendors: Vendor[];
  customers: Customer[];
  invoices: Invoice[];
  creditNotes: CreditNote[];
  payments: Payment[];
  estimates: Estimate[];
  bills: Bill[];
  vendorCredits: VendorCredit[];
  inventory: InventoryItem[];
  assets: FixedAsset[];
  recurring: RecurringTransaction[];
  employees: Employee[];
  payRuns: PayRun[];
  taxRates: TaxRate[];
  classes: string[];
  locations: string[];
  customFields: { name: string, type: string, showOnSales: boolean, showOnExpenses: boolean }[];
  auditLogs: any[];
  bankLines: BankStatementLine[];
  partners: any[];
  reconciliations: any[];
  customTemplates: CustomTemplate[];
  autoRules: any[];
  integrityStatus: {
    lastChecked: string;
    isConsistent: boolean;
    driftCents: number;
    shadowTotalCents: number;
    incrementalTotalCents: number;
    isVerifying: boolean;
  };
  projectedBalanceCents: number;
  lastActivity: string;
  analyticalPatternCache: Record<string, { accountId: string, accountName: string, projectId?: string, projectName?: string, count: number, tags?: string[], dimensions?: Record<string, string> }>;
  activityFeed: any[];
  auditResult: AuditResult | null;
  optimisticIds: Set<string>;
  computedAccounts: ChartAccount[];
  totalLedgerBalance: number;
  lockDate: string | null;
  isPrivacyMode: boolean;
  baseCurrency: string;
  matchingThreshold: number;
  isDataTruncated: boolean;
  runningBalances: {
    totalIncome: number;
    totalExpense: number;
    totalBalance: number;
    projectMetrics: Record<string, { income: number, expense: number }>;
    categoryMetrics: Record<string, number>;
  };

  // Actions
  reconcileIntegrity: () => boolean;
  setTransactions: (data: Transaction[]) => void;
  deleteTransaction: (id: string) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  setLockDate: (date: string | null) => void;
  setBaseCurrency: (currency: string) => void;
  setMatchingThreshold: (threshold: number) => void;
  setPrivacyMode: (active: boolean) => void;
  setIsDataTruncated: (isTruncated: boolean) => void;
  validateTransaction: (tx: Transaction) => { success: boolean, error?: string };
  setAccounts: (data: ChartAccount[]) => void;
  updateAccount: (id: string, updates: Partial<ChartAccount>) => void;
  setJournalEntries: (data: JournalEntry[]) => void;
  setProjects: (data: Project[]) => void;
  setBudgets: (data: Budget[]) => void;
  setVendors: (data: Vendor[]) => void;
  updateVendor: (id: string, updates: Partial<Vendor>) => void;
  setCustomers: (data: Customer[]) => void;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  setInvoices: (data: Invoice[]) => void;
  setCreditNotes: (data: CreditNote[]) => void;
  setPayments: (data: Payment[]) => void;
  setEstimates: (data: Estimate[]) => void;
  setBills: (data: Bill[]) => void;
  setVendorCredits: (data: VendorCredit[]) => void;
  setInventory: (data: InventoryItem[]) => void;
  setAssets: (data: FixedAsset[]) => void;
  setRecurring: (data: RecurringTransaction[]) => void;
  setEmployees: (data: Employee[]) => void;
  setPayRuns: (data: PayRun[]) => void;
  setTaxRates: (data: TaxRate[]) => void;
  setClasses: (data: string[]) => void;
  setLocations: (data: string[]) => void;
  setCustomFields: (data: { name: string, type: string, showOnSales: boolean, showOnExpenses: boolean }[]) => void;
  setAuditLogs: (data: any[]) => void;
  setPartners: (data: any[]) => void;
  setReconciliations: (data: any[]) => void;
  setBankLines: (data: BankStatementLine[]) => void;
  setCustomTemplates: (data: CustomTemplate[]) => void;
  setAutoRules: (data: any[]) => void;
  setAnalyticalPatternCache: (data: Record<string, any>) => void;
  updateAnalyticalMatchCache: (description: string, accountId: string, accountName: string, tags?: string[], projectId?: string, projectName?: string, dimensions?: Record<string, string>) => void;
  setActivityFeed: (data: any[]) => void;
  runFullAudit: () => void;
  recomputeBalances: () => void;
  resetStore: () => void;
}

export const getPostableTransactions = (state: LedgerState): Transaction[] => {
  return state.transactions.filter(isPostable);
};

export const useLedgerStore = create<LedgerState>((set, get) => ({
  _version: 0,
  _lastSync: Date.now(),
  transactions: [],
  optimisticIds: new Set(),
  accounts: [],
  journalEntries: [],
  projects: [],
  budgets: [],
  vendors: [],
  customers: [],
  invoices: [],
  creditNotes: [],
  payments: [],
  estimates: [],
  bills: [],
  vendorCredits: [],
  inventory: [],
  assets: [],
  recurring: [],
  employees: [],
  payRuns: [],
  taxRates: [],
  classes: [],
  locations: [],
  customFields: [],
  auditLogs: [],
  partners: [],
  reconciliations: [],
  bankLines: [],
  customTemplates: [],
  autoRules: [],
  activityFeed: [],
  analyticalPatternCache: {},
  runningBalances: {
    totalIncome: 0,
    totalExpense: 0,
    totalBalance: 0,
    projectMetrics: {},
    categoryMetrics: {}
  },
  integrityStatus: {
    lastChecked: new Date().toISOString(),
    isConsistent: true,
    shadowTotalCents: 0,
    incrementalTotalCents: 0,
    driftCents: 0,
    isVerifying: false
  },
  auditResult: null,

  computedAccounts: [],
  totalLedgerBalance: 0,
  projectedBalanceCents: 0,
  lastActivity: '',
  deleteTransaction: (id) => {
    const state = get();
    const nextTxs = state.transactions.filter(t => t.id !== id);
    state.setTransactions(nextTxs);
  },
  updateTransaction: (id, updates) => {
    const state = get();
    const nextTxs = state.transactions.map(t => t.id === id ? { ...t, ...updates } as typeof t : t);
    state.setTransactions(nextTxs);
  },
  lockDate: null,
  baseCurrency: 'USD',
  matchingThreshold: 0.8,
  isDataTruncated: false,
  isPrivacyMode: false,

  setLockDate: (date) => set({ lockDate: date }),
  setBaseCurrency: (currency) => set({ baseCurrency: currency }),
  setMatchingThreshold: (threshold) => set({ matchingThreshold: threshold }),
  setPrivacyMode: (active) => set({ isPrivacyMode: active }),
  setIsDataTruncated: (isTruncated) => set({ isDataTruncated: isTruncated }),

  recomputeBalances: () => {
    if (typeof window !== 'undefined') {
      if ((window as any)._recomputeTimer) {
        clearTimeout((window as any)._recomputeTimer);
      }
      (window as any)._recomputeTimer = setTimeout(() => {
      const { accounts, transactions, computedAccounts: currentComputed } = get();
      if (!accounts.length) {
        if (currentComputed.length > 0 || get().totalLedgerBalance !== 0) {
          set({ computedAccounts: [], totalLedgerBalance: 0 });
        }
        return;
      }

      const balances = LedgerEngine.computeDimensionalBalances(accounts, transactions);
      let totalBal = 0;
      let changed = false;
      
      const nextComputedAccounts = accounts.map((acc, idx) => {
        const data = balances.get(acc.id);
        const signedBalance = data?.total || 0;
        const isDebit = acc.type === 'asset' || acc.type === 'expense' || acc.type === 'cost_of_goods';
        const balance = isDebit ? signedBalance : -signedBalance;
        
        if (isDebit) totalBal += balance;
        else totalBal -= balance;

        const projectAllocations = data ? Object.fromEntries(data.projects) : {};
        const current = currentComputed[idx];
        
        // Minimal stability check
        const hasChanged = !current || 
                          current.id !== acc.id || 
                          current.balanceCents !== balance ||
                          JSON.stringify(current.projectAllocations) !== JSON.stringify(projectAllocations);

        if (hasChanged) changed = true;

        return { 
          ...acc, 
          balanceCents: balance,
          projectAllocations 
        };
      });

      if (changed || get().totalLedgerBalance !== totalBal || currentComputed.length !== nextComputedAccounts.length) {
        set({ 
          computedAccounts: nextComputedAccounts,
          totalLedgerBalance: totalBal
        });
      }
      }, 10);
    }
  },

  validateTransaction: (tx) => { 
    try {
      DoubleEntryValidator.validateJournalEntry(tx);
      // Usually here it would call an API or event ledger
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  reconcileIntegrity: () => {
    const { transactions, runningBalances, accounts } = get();
    
    set({ integrityStatus: { ...get().integrityStatus, isVerifying: true } });

    const accountMap = new Map(accounts.map(a => [a.id, a]));

    const integrity = {
      totalIncome: 0,
      totalExpense: 0,
      totalBalance: 0,
      projectMetrics: {} as Record<string, { income: number, expense: number }>,
      categoryMetrics: {} as Record<string, number>
    };

    if (Array.isArray(transactions)) {
      transactions.forEach(tx => {
        if (!tx || typeof tx !== 'object' || !isPostable(tx)) return;
        
        const impact = calculateTransactionImpact(tx, accountMap);
        
        if (impact > 0) {
          integrity.totalIncome += impact;
        } else if (impact < 0) {
          integrity.totalExpense += Math.abs(impact);
        }
        
        integrity.totalBalance += impact;

        if (Array.isArray(tx.lines)) {
          tx.lines.forEach(l => {
            if (!l || typeof l !== 'object') return;
            const amt = lineAmount(l, tx);
            const cat = (typeof l.category === 'string' && l.category) ? l.category : 'General';
            integrity.categoryMetrics[cat] = (integrity.categoryMetrics[cat] || 0) + amt;
          });
        }

        if (tx.projectId && typeof tx.projectId === 'string') {
          if (!integrity.projectMetrics[tx.projectId]) {
            integrity.projectMetrics[tx.projectId] = { income: 0, expense: 0 };
          }
          if (impact > 0) integrity.projectMetrics[tx.projectId].income += impact;
          else if (impact < 0) integrity.projectMetrics[tx.projectId].expense += Math.abs(impact);
        }
      });
    }

    const isConsistent = 
      integrity.totalBalance === runningBalances.totalBalance &&
      integrity.totalIncome === runningBalances.totalIncome;

    const drift = integrity.totalBalance - runningBalances.totalBalance;

    set({ 
      integrityStatus: {
        lastChecked: new Date().toISOString(),
        isConsistent,
        driftCents: drift,
        shadowTotalCents: integrity.totalBalance,
        incrementalTotalCents: runningBalances.totalBalance,
        isVerifying: false
      }
    });

    if (!isConsistent) {
      console.warn('Physical Integrity Variance Detected: Delta engine corrected to O(N) Integrity.');
      const formattedDelta = `$${(drift / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const { auditLogs } = get();
      const driftLog = {
        id: crypto.randomUUID(),
        action: `PHYSICAL_INTEGRITY_DRIFT: Balance Delta is ${formattedDelta} [Shadow: $${(integrity.totalBalance / 100).toFixed(2)} · Incremental: $${(runningBalances.totalBalance / 100).toFixed(2)}]`,
        entityType: 'system',
        entityId: 'SHADOW_RECONCILER',
        email: 'SYSTEM_AUTOPILOT@ledgerflow.security',
        userEmail: 'SYSTEM_AUTOPILOT@ledgerflow.security',
        targetId: 'LEDGER_INTEGRITY_VIOLATION',
        details: {
          driftCents: drift,
          shadowTotalCents: integrity.totalBalance,
          incrementalTotalCents: runningBalances.totalBalance
        },
        timestamp: new Date().toISOString()
      };
      set({ 
        runningBalances: integrity,
        auditLogs: [driftLog, ...(Array.isArray(auditLogs) ? auditLogs : [])]
      });
    }

    return isConsistent;
  },

  setTransactions: (transactions) => {
    const currentVersion = get()._version;
    set({ _version: currentVersion + 1, _lastSync: Date.now() });
    if (!Array.isArray(transactions)) {
      throw new Error("Validation Failed: Transactions payload must be an array.");
    }
    
    const validTxs = transactions
      .filter((tx): tx is Transaction => Boolean(tx && typeof tx === 'object'))
      .map(tx => ({
        ...tx,
        lines: Array.isArray(tx.lines) ? tx.lines : []
      }));
    
    const { recomputeBalances } = get();
    const allTxs = validTxs.sort((a, b) => {
      const aDate = typeof a.date === 'string' ? a.date : '';
      const bDate = typeof b.date === 'string' ? b.date : '';
      if (aDate > bDate) return -1;
      if (aDate < bDate) return 1;
      const aTime = typeof a.createdAt === 'string' ? a.createdAt : '';
      const bTime = typeof b.createdAt === 'string' ? b.createdAt : '';
      if (aTime > bTime) return -1;
      if (aTime < bTime) return 1;
      return 0;
    });

    // Initial Baseline computation (O(N) during load, O(1) thereafter)
    const runningBalances = {
      totalIncome: 0,
      totalExpense: 0,
      totalBalance: 0,
      projectMetrics: {} as Record<string, { income: number, expense: number }>,
      categoryMetrics: {} as Record<string, number>
    };

    allTxs.forEach(tx => {
      if (!isPostable(tx)) return;

      const accountMap = new Map(get().accounts.map(a => [a.id, a]));
      const impact = calculateTransactionImpact(tx, accountMap);

      if (impact > 0) {
        runningBalances.totalIncome += impact;
      } else if (impact < 0) {
        runningBalances.totalExpense += Math.abs(impact);
      }
      
      runningBalances.totalBalance += impact;

      if (Array.isArray(tx.lines)) {
        tx.lines.forEach(l => {
          if (!l || typeof l !== 'object') return;
          const amt = lineAmount(l, tx);
          const cat = (typeof l.category === 'string' && l.category) ? l.category : 'General';
          runningBalances.categoryMetrics[cat] = (runningBalances.categoryMetrics[cat] || 0) + amt;
        });
      }

      if (tx.projectId && typeof tx.projectId === 'string') {
        if (!runningBalances.projectMetrics[tx.projectId]) {
          runningBalances.projectMetrics[tx.projectId] = { income: 0, expense: 0 };
        }
        if (impact > 0) runningBalances.projectMetrics[tx.projectId].income += impact;
        else if (impact < 0) runningBalances.projectMetrics[tx.projectId].expense += Math.abs(impact);
      }
    });

    set({ transactions: allTxs, runningBalances });
    recomputeBalances();
  },

  

  

  setAccounts: (accounts) => {
    set({ accounts });
    get().recomputeBalances();
  },
  
  updateAccount: (id, updates) => {
    const nextAccounts = get().accounts.map(a => a.id === id ? { ...a, ...updates } : a);
    get().setAccounts(nextAccounts);
  },

  setJournalEntries: (journalEntries) => {
    set({ journalEntries });
    get().recomputeBalances();
  },
  setProjects: (projects) => set({ projects }),
  setBudgets: (budgets) => set({ budgets }),
  setVendors: (vendors) => set({ vendors }),

  updateVendor: (id, updates) => {
    const nextVendors = get().vendors.map(v => v.id === id ? { ...v, ...updates } : v);
    get().setVendors(nextVendors);
  },

  setCustomers: (customers) => set({ customers }),

  updateCustomer: (id, updates) => {
    const nextCustomers = get().customers.map(c => c.id === id ? { ...c, ...updates } : c);
    get().setCustomers(nextCustomers);
  },
  setInvoices: (invoices) => set({ invoices }),
  setCreditNotes: (creditNotes) => set({ creditNotes }),
  setPayments: (payments) => set({ payments }),
  setEstimates: (estimates) => set({ estimates }),
  setBills: (bills) => set({ bills }),
  setVendorCredits: (vendorCredits) => set({ vendorCredits }),
  setInventory: (inventory) => set({ inventory }),
  setAssets: (assets) => set({ assets }),
  setRecurring: (recurring) => set({ recurring }),
  setEmployees: (employees) => set({ employees }),
  setPayRuns: (payRuns) => set({ payRuns }),
  setTaxRates: (taxRates) => set({ taxRates }),
  setClasses: (classes) => set({ classes }),
  setLocations: (locations) => set({ locations }),
  setCustomFields: (customFields) => set({ customFields }),
  setAuditLogs: (auditLogs) => set({ auditLogs }),
  setPartners: (partners) => set({ partners }),
  setReconciliations: (reconciliations) => set({ reconciliations }),
  setBankLines: (bankLines) => set({ bankLines }),
  setCustomTemplates: (customTemplates) => set({ customTemplates }),
  setAutoRules: (autoRules) => set({ autoRules }),
  setAnalyticalPatternCache: (analyticalPatternCache) => set({ analyticalPatternCache }),
  updateAnalyticalMatchCache: (description, accountId, accountName, tags, projectId, projectName, dimensions) => set((state) => {
    const cleanDesc = (description || '').toLowerCase().trim();
    // Index by vendor + project for precision
    const key = projectId ? `${cleanDesc}::${projectId}` : cleanDesc;
    
    const existing = state.analyticalPatternCache[key];
    const combinedTags = Array.from(new Set([...(existing?.tags || []), ...(tags || [])])).slice(0, 5);
    const combinedDimensions = { ...(existing?.dimensions || {}), ...(dimensions || {}) };
    return {
      analyticalPatternCache: {
        ...state.analyticalPatternCache,
        [key]: {
          accountId,
          accountName,
          projectId,
          projectName,
          tags: combinedTags,
          dimensions: Object.keys(combinedDimensions).length > 0 ? combinedDimensions : undefined,
          count: (existing?.count || 0) + 1
        }
      }
    };
  }),
  setActivityFeed: (activityFeed) => set({ activityFeed }),
  runFullAudit: () => {
    const { transactions, accounts } = get();
    if (!transactions.length || !accounts.length) return;
    const auditResult = DoubleEntryAuditor.auditLedger(transactions, accounts);
    set({ auditResult });

    const hasIssues = !auditResult.isBalanced || 
                      auditResult.imbalances.length > 0 || 
                      auditResult.orphans.length > 0 || 
                      !auditResult.hashChainValid || 
                      auditResult.missingAccounts.length > 0;

    if (hasIssues) {
      globalEventBus.publish('LEDGER_AUDIT_EXCEPTION', {
        result: auditResult,
        timestamp: new Date().toISOString(),
        severity: !auditResult.isBalanced || !auditResult.hashChainValid ? 'critical' : 'warning'
      });
    }
  },
  resetStore: () => {
    set({
      transactions: [],
      optimisticIds: new Set(),
      accounts: [],
      journalEntries: [],
      projects: [],
      budgets: [],
      vendors: [],
      customers: [],
      invoices: [],
      creditNotes: [],
      payments: [],
      estimates: [],
      bills: [],
      vendorCredits: [],
      inventory: [],
      assets: [],
      recurring: [],
      employees: [],
      payRuns: [],
      taxRates: [],
      classes: [],
      locations: [],
      customFields: [],
      auditLogs: [],
      partners: [],
      reconciliations: [],
      bankLines: [],
      customTemplates: [],
      autoRules: [],
      activityFeed: [],
      analyticalPatternCache: {},
      computedAccounts: [],
      totalLedgerBalance: 0,
      projectedBalanceCents: 0,
      lastActivity: '',
      lockDate: null,
      auditResult: null,
      runningBalances: {
        totalIncome: 0,
        totalExpense: 0,
        totalBalance: 0,
        projectMetrics: {},
        categoryMetrics: {}
      },
      integrityStatus: {
        lastChecked: new Date().toISOString(),
        isConsistent: true,
        shadowTotalCents: 0,
        incrementalTotalCents: 0,
        driftCents: 0,
        isVerifying: false
      }
    });
  }
}));

if (typeof window !== 'undefined') {
  (window as any).__ledgerStore = useLedgerStore;
  (window as any).__ledgerBaseCurrency = 'USD';
  useLedgerStore.subscribe((state) => {
    (window as any).__ledgerBaseCurrency = state.baseCurrency || 'USD';
  });
}
