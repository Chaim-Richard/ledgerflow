import { create } from 'zustand';
import { LedgerEngine } from '../kernel/ledger/LedgerEngine';
import { DoubleEntryAuditor, AuditResult } from '../services/auditor';
import { globalEventBus } from '../lib/eventBus';
import { 
  Transaction, 
  ChartAccount, 
  JournalEntry, 
  Project, 
  Budget, 
  Vendor, 
  Customer, 
  Invoice, 
  Bill, 
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
  transactions: Transaction[];
  accounts: ChartAccount[];
  journalEntries: JournalEntry[];
  projects: Project[];
  budgets: Budget[];
  vendors: Vendor[];
  customers: Customer[];
  invoices: Invoice[];
  bills: Bill[];
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
  analyticalPatternCache: Record<string, { accountId: string, accountName: string, projectId?: string, projectName?: string, count: number, tags?: string[] }>;
  activityFeed: any[];
  auditResult: AuditResult | null;
  optimisticIds: Set<string>;
  computedAccounts: ChartAccount[];
  totalLedgerBalance: number;
  lockDate: string | null;
  isPrivacyMode: boolean;
  baseCurrency: string;
  matchingThreshold: number;
  runningBalances: {
    totalIncome: bigint;
    totalExpense: bigint;
    totalBalance: bigint;
    projectMetrics: Record<string, { income: bigint, expense: bigint }>;
    categoryMetrics: Record<string, bigint>;
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
  commitTransaction: (tx: Transaction) => { success: boolean, error?: string };
  setAccounts: (data: ChartAccount[]) => void;
  setJournalEntries: (data: JournalEntry[]) => void;
  setProjects: (data: Project[]) => void;
  setBudgets: (data: Budget[]) => void;
  setVendors: (data: Vendor[]) => void;
  setCustomers: (data: Customer[]) => void;
  setInvoices: (data: Invoice[]) => void;
  setBills: (data: Bill[]) => void;
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
  updateAnalyticalMatchCache: (description: string, accountId: string, accountName: string, tags?: string[], projectId?: string, projectName?: string) => void;
  setActivityFeed: (data: any[]) => void;
  runFullAudit: () => void;
  recomputeBalances: () => void;
}

export const useLedgerStore = create<LedgerState>((set, get) => ({
  transactions: [],
  optimisticIds: new Set(),
  accounts: [],
  journalEntries: [],
  projects: [],
  budgets: [],
  vendors: [],
  customers: [],
  invoices: [],
  bills: [],
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
    totalIncome: 0n,
    totalExpense: 0n,
    totalBalance: 0n,
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
  deleteTransaction: (id) => set((state) => {
    const nextTxs = state.transactions.filter(t => t.id !== id);
    return { transactions: nextTxs };
  }),
  updateTransaction: (id, updates) => set((state) => {
    const nextTxs = state.transactions.map(t => t.id === id ? { ...t, ...updates } as typeof t : t);
    return { transactions: nextTxs };
  }),
  lockDate: null,
  baseCurrency: 'USD',
  matchingThreshold: 0.8,
  isPrivacyMode: false,

  setLockDate: (date) => set({ lockDate: date }),
  setBaseCurrency: (currency) => set({ baseCurrency: currency }),
  setMatchingThreshold: (threshold) => set({ matchingThreshold: threshold }),
  setPrivacyMode: (active) => set({ isPrivacyMode: active }),

  recomputeBalances: () => {
    if ((window as any)._recomputeTimer) {
      clearTimeout((window as any)._recomputeTimer);
    }
    
    (window as any)._recomputeTimer = setTimeout(() => {
      const { accounts, transactions, journalEntries, computedAccounts: currentComputed } = get();
      if (!accounts.length) return;

      const balances = LedgerEngine.computeDimensionalBalances(accounts, transactions, journalEntries);
      let totalBal = 0;
      let changed = false;
      
      const nextComputedAccounts = accounts.map((acc, idx) => {
        const data = balances.get(acc.id);
        const signedBalance = data?.total || 0;
        const isDebit = acc.type === 'asset' || acc.type === 'expense';
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
  },

  commitTransaction: (tx) => { 
    try {
      DoubleEntryValidator.validateJournalEntry(tx);
      // Usually here it would call an API or event ledger
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  reconcileIntegrity: () => {
    const { transactions, runningBalances } = get();
    
    set({ integrityStatus: { ...get().integrityStatus, isVerifying: true } });

    // Simulate slight delay for "Shadow Verification" feel
    const truth = {
      totalIncome: 0n,
      totalExpense: 0n,
      totalBalance: 0n,
      projectMetrics: {} as Record<string, { income: bigint, expense: bigint }>,
      categoryMetrics: {} as Record<string, bigint>
    };

    transactions.forEach(tx => {
      const amount = BigInt(tx.totalAmountCents || 0);
      truth.totalBalance += amount;
      if (amount > 0n) truth.totalIncome += amount;
      else truth.totalExpense += (-amount);

      if (tx.projectId) {
        if (!truth.projectMetrics[tx.projectId]) {
          truth.projectMetrics[tx.projectId] = { income: 0n, expense: 0n };
        }
        if (amount > 0n) truth.projectMetrics[tx.projectId].income += amount;
        else truth.projectMetrics[tx.projectId].expense += (-amount);
      }

      tx.lines?.forEach(l => {
        const cat = l.category || 'General';
        truth.categoryMetrics[cat] = (truth.categoryMetrics[cat] || 0n) + BigInt(l.amountCents || 0);
      });
    });

    const isConsistent = 
      truth.totalBalance === runningBalances.totalBalance &&
      truth.totalIncome === runningBalances.totalIncome;

    const drift = Number(truth.totalBalance - runningBalances.totalBalance);

    set({ 
      integrityStatus: {
        lastChecked: new Date().toISOString(),
        isConsistent,
        driftCents: drift,
        shadowTotalCents: Number(truth.totalBalance),
        incrementalTotalCents: Number(runningBalances.totalBalance),
        isVerifying: false
      }
    });

    if (!isConsistent) {
      console.warn('Physical Integrity Variance Detected: Delta engine corrected to O(N) Truth.');
      const formattedDelta = `$${(drift / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const { auditLogs } = get();
      const driftLog = {
        id: `drift_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        action: `PHYSICAL_INTEGRITY_DRIFT: Balance Delta is ${formattedDelta} [Shadow: $${(Number(truth.totalBalance) / 100).toFixed(2)} · Incremental: $${(Number(runningBalances.totalBalance) / 100).toFixed(2)}]`,
        entityType: 'system',
        entityId: 'SHADOW_RECONCILER',
        email: 'SYSTEM_AUTOPILOT@ledgerflow.security',
        userEmail: 'SYSTEM_AUTOPILOT@ledgerflow.security',
        targetId: 'LEDGER_INTEGRITY_VIOLATION',
        details: {
          driftCents: drift,
          shadowTotalCents: Number(truth.totalBalance),
          incrementalTotalCents: Number(runningBalances.totalBalance)
        },
        timestamp: new Date().toISOString()
      };
      set({ 
        runningBalances: truth,
        auditLogs: [driftLog, ...auditLogs]
      });
    }

    return isConsistent;
  },

  setTransactions: (transactions) => {
    const { recomputeBalances } = get();
    const mergedTxs = transactions;
    const allTxs = mergedTxs.sort((a, b) => {
      if (a.date > b.date) return -1;
      if (a.date < b.date) return 1;
      const aTime = a.createdAt || '';
      const bTime = b.createdAt || '';
      if (aTime > bTime) return -1;
      if (aTime < bTime) return 1;
      return 0;
    });

    // Initial Baseline computation (O(N) during load, O(1) thereafter)
    const runningBalances = {
      totalIncome: 0n,
      totalExpense: 0n,
      totalBalance: 0n,
      projectMetrics: {} as Record<string, { income: bigint, expense: bigint }>,
      categoryMetrics: {} as Record<string, bigint>
    };

    allTxs.forEach(tx => {
      const amount = BigInt(tx.totalAmountCents);
      runningBalances.totalBalance += amount;
      if (amount > 0n) runningBalances.totalIncome += amount;
      else runningBalances.totalExpense += (-amount);

      if (tx.projectId) {
        if (!runningBalances.projectMetrics[tx.projectId]) {
          runningBalances.projectMetrics[tx.projectId] = { income: 0n, expense: 0n };
        }
        if (amount > 0n) runningBalances.projectMetrics[tx.projectId].income += amount;
        else runningBalances.projectMetrics[tx.projectId].expense += (-amount);
      }
      tx.lines.forEach(l => {
        const cat = l.category || 'General';
        runningBalances.categoryMetrics[cat] = (runningBalances.categoryMetrics[cat] || 0n) + BigInt(l.amountCents);
      });
    });

    set({ transactions: allTxs, runningBalances });
    recomputeBalances();
  },

  

  

  setAccounts: (accounts) => {
    set({ accounts });
    get().recomputeBalances();
  },
  
  setJournalEntries: (journalEntries) => {
    set({ journalEntries });
    get().recomputeBalances();
  },
  setProjects: (projects) => set({ projects }),
  setBudgets: (budgets) => set({ budgets }),
  setVendors: (vendors) => set({ vendors }),
  setCustomers: (customers) => set({ customers }),
  setInvoices: (invoices) => set({ invoices }),
  setBills: (bills) => set({ bills }),
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
  updateAnalyticalMatchCache: (description, accountId, accountName, tags, projectId, projectName) => set((state) => {
    const cleanDesc = (description || '').toLowerCase().trim();
    // Index by vendor + project for precision
    const key = projectId ? `${cleanDesc}::${projectId}` : cleanDesc;
    
    const existing = state.analyticalPatternCache[key];
    const combinedTags = Array.from(new Set([...(existing?.tags || []), ...(tags || [])])).slice(0, 5);
    return {
      analyticalPatternCache: {
        ...state.analyticalPatternCache,
        [key]: {
          accountId,
          accountName,
          projectId,
          projectName,
          tags: combinedTags,
          count: (existing?.count || 0) + 1
        }
      }
    };
  }),
  setActivityFeed: (activityFeed) => set({ activityFeed }),
  runFullAudit: () => {
    const { transactions, accounts, journalEntries } = get();
    if (!transactions.length || !accounts.length) return;
    const auditResult = DoubleEntryAuditor.auditLedger(transactions, accounts, journalEntries);
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
  }
}));
