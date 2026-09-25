import { useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc,
  addDoc,
  limit,
  orderBy,
  getDocs
} from '../lib/db/firestore';
import { db } from '../firebase';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useUIStore } from '../stores/useUIStore';
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
  Payment,
  Estimate,
  InventoryItem, 
  FixedAsset, 
  RecurringTransaction, 
  Employee, 
  PayRun, 
  TaxRate,
  Workspace,
  CustomTemplate,
  UserProfile,
  DimensionNode,
  CreditNote,
  VendorCredit,
  PeriodStatus
} from '../types';
import { Scenario, useScenarioStore } from '../lib/scenarioStore';
import { seedDemoWorkspace } from '../lib/demoWorkspaceSeeder';
import { migrateWorkspaceDimensionNodesToCollection } from '../lib/migrations/dimensionNodesMigration';

import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';

import { safeAsync, getLocalDateISO } from "../lib/utils";
import { fetchSnapshotBridge, useSnapshotBridge } from "./useSnapshotBridge";
import { effectiveLockDate } from '../lib/periodLock';


export function useLedgerData() {
  const user = useAuthStore(s => s.user);
  const isGuest = useAuthStore(s => s.isGuest);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const setWorkspaces = useAuthStore(s => s.setWorkspaces);
  const setCurrentWorkspaceId = useAuthStore(s => s.setCurrentWorkspaceId);
  const setUserProfile = useAuthStore(s => s.setUserProfile);
  const startDate = useUIStore(s => s.filterCriteria?.startDate);
  const endDate = useUIStore(s => s.filterCriteria?.endDate);
  const activeTab = useUIStore(s => s.activeTab);
  
  const setAccounts = useLedgerStore(s => s.setAccounts);
  const setCustomers = useLedgerStore(s => s.setCustomers);
  const setVendors = useLedgerStore(s => s.setVendors);
  const setTransactions = useLedgerStore(s => s.setTransactions);
  
  useSnapshotBridge();

  // Guest mode seed effect
  useEffect(() => {
    if (!user && isGuest) {
      const demoData = seedDemoWorkspace('guest');
      setAccounts(demoData.accounts);
      setCustomers(demoData.customers);
      setVendors(demoData.vendors);
      setTransactions(demoData.transactions);
      if (!currentWorkspaceId) {
        setCurrentWorkspaceId('guest');
      }
    }
  }, [user, isGuest, setAccounts, setCustomers, setVendors, setTransactions, currentWorkspaceId, setCurrentWorkspaceId]);


  // 1. Workspaces
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'workspaces'), where('uid', '==', user.uid));
    return onSnapshot(q, async (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workspace));
      setWorkspaces(fetched);
      
      if (fetched.length === 0 && user) {
        // Create Default Workspace
        const defaultWorkspace: Partial<Workspace> = {
          uid: user.uid,
          name: 'Personal Workspace',
          businessType: 'personal',
          createdAt: new Date().toISOString(),
          currency: 'USD'
        };
        await safeAsync(
          setDoc(doc(collection(db, 'workspaces')), defaultWorkspace),
          OperationType.CREATE,
          'workspaces',
          { userId: user.uid }
        );
      } else if (fetched.length > 0) {
        // Validation: Ensure current selection is still valid
        const isCurrentValid = fetched.some(w => w.id === currentWorkspaceId);
        if (!currentWorkspaceId || !isCurrentValid) {
          setCurrentWorkspaceId(fetched[0].id);
        }
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'workspaces'));
  }, [user, currentWorkspaceId, setCurrentWorkspaceId, setWorkspaces]);

  // 2. User Profile
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setUserProfile(data);
      } else {
        const profileData: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          role: 'client',
          createdAt: new Date().toISOString()
        };
        await safeAsync(
          setDoc(doc(db, 'users', user.uid), profileData),
          OperationType.CREATE,
          `users/${user.uid}`
        );
        setUserProfile(profileData);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`));
  }, [user, setUserProfile]);

  // Sync workspace-level settings (currency, lockDate, and matchingThreshold) to the ledger store
  const workspaces = useAuthStore(state => state.workspaces);
  const baseCurrency = useLedgerStore(state => state.baseCurrency);
  const lockDate = useLedgerStore(state => state.lockDate);
  const matchingThreshold = useLedgerStore(state => state.matchingThreshold);
  const setBaseCurrency = useLedgerStore(state => state.setBaseCurrency);
  const setLockDate = useLedgerStore(state => state.setLockDate);
  const setLockException = useLedgerStore(state => state.setLockException);
  const setMatchingThreshold = useLedgerStore(state => state.setMatchingThreshold);

  useEffect(() => {
    const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);
    if (currentWorkspace) {
      const targetCurrency = currentWorkspace.currency || 'USD';
      // Closed through this date for this user (soft close applies to bookkeepers only)
      const targetLockDate = effectiveLockDate(currentWorkspace, user?.uid || '');
      setLockException(currentWorkspace.lockException || null);
      const targetThreshold = typeof currentWorkspace.matchingThreshold === 'number' ? currentWorkspace.matchingThreshold : 0.85;
      if (baseCurrency !== targetCurrency) {
        setBaseCurrency(targetCurrency);
      }
      if (lockDate !== targetLockDate) {
        setLockDate(targetLockDate);
      }
      if (matchingThreshold !== targetThreshold) {
        setMatchingThreshold(targetThreshold);
      }
    }
  }, [currentWorkspaceId, workspaces, user?.uid, baseCurrency, lockDate, matchingThreshold, setBaseCurrency, setLockDate, setLockException, setMatchingThreshold]);

  // Main Entities (Workspace Scoped)
  useEffect(() => {
    if (!user || !currentWorkspaceId) return;

    // Login Audit
    const sessionLoginKey = `login_logged_${currentWorkspaceId}_${user.uid}`;
    if (!sessionStorage.getItem(sessionLoginKey)) {
      sessionStorage.setItem(sessionLoginKey, 'true');
      addDoc(collection(db, 'auditLogs'), {
        action: 'USER_LOGIN',
        details: { description: 'User authenticated and entered workspace session' },
        severity: 'info',
        uid: user.uid,
        userEmail: user.email,
        workspaceId: currentWorkspaceId,
        timestamp: new Date().toISOString()
      }).catch(err => console.error('Failed to write login audit:', err));
    }

    // Clear data immediately to prevent ghosting between workspaces
    useLedgerStore.setState({
      transactions: [],
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
      runningBalances: {
        totalIncome: 0,
        totalExpense: 0,
        totalBalance: 0,
        projectMetrics: {},
        categoryMetrics: {}
      }
    });

    
    // DATA BRIDGE: Fetch snapshot for immediate "big math" rendering on new devices
    fetchSnapshotBridge(currentWorkspaceId).then((data: any) => {
      if (data && useLedgerStore.getState().transactions.length === 0) {
        useLedgerStore.setState({
          runningBalances: {
            ...useLedgerStore.getState().runningBalances,
            totalIncome: Number(data.totalIncome || 0),
            totalExpense: Number(data.totalExpense || 0),
            totalBalance: Number(data.totalBalance || 0)
          }
        });
      }
    });

    const filter = [
      where('workspaceId', '==', currentWorkspaceId)
    ];
    const { setIsSyncing } = useUIStore.getState();
    
    // Track pending writes across all active listeners
    const pendingWritesMap = new Map<string, boolean>();
    const updateGlobalSyncStatus = () => {
      const isAnyPending = Array.from(pendingWritesMap.values()).some(v => v);
      setIsSyncing(isAnyPending);
    };

    // Batch updates to the store to prevent rapid-fire re-renders
    let pendingUpdates: Partial<any> = {};
    let updateTimer: any = null;

    const scheduleUpdate = (key: string, data: any, hasPendingWrites: boolean) => {
      pendingUpdates[key] = data;
      pendingWritesMap.set(key, hasPendingWrites);
      updateGlobalSyncStatus();

      if (updateTimer) clearTimeout(updateTimer);
      // Increased window for high-volume logs and history to prevent UI lockup
      const debounceMs = (key === 'auditLogs' || key === 'bankLines') ? 500 : 100;
      
      updateTimer = setTimeout(() => {
        const updatesToApply: any = { ...pendingUpdates };
        pendingUpdates = {};
        updateTimer = null;

        Object.entries(updatesToApply).forEach(([k, value]) => {
          const setterName = `set${k.charAt(0).toUpperCase() + k.slice(1)}`;
          const store = useLedgerStore.getState() as any;
          if (store[setterName]) {
            store[setterName](value);
          }
        });
      }, debounceMs);
    };

    const TX_PAGE_LIMIT = 2000;
    const txConstraints: any[] = [...filter];
    
    // Narrow date window optimization: default to trailing 12 months if no custom window is specified
    const finalStartDate = startDate || (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() - 1);
      return getLocalDateISO(d);
    })();

    txConstraints.push(where('date', '>=', finalStartDate));
    
    if (endDate) {
      txConstraints.push(where('date', '<=', endDate));
    }
    txConstraints.push(orderBy('date', 'desc'));
    txConstraints.push(limit(TX_PAGE_LIMIT));

    const criticalListeners = [
      onSnapshot(query(collection(db, 'transactions'), ...txConstraints), (snap) => {
        const isTrunc = snap.docs.length >= TX_PAGE_LIMIT;
        useLedgerStore.getState().setIsDataTruncated(isTrunc);
        useLedgerStore.getState().setCollectionTruncated('transactions', isTrunc);
        scheduleUpdate('transactions', snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)), snap.metadata.hasPendingWrites);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')),
      onSnapshot(query(collection(db, 'chartAccounts'), ...filter, limit(1000)), (snap) => {
        useLedgerStore.getState().setCollectionTruncated('chartAccounts', snap.docs.length >= 1000);
        scheduleUpdate('accounts', snap.docs.map(d => ({ id: d.id, ...d.data() } as ChartAccount)), snap.metadata.hasPendingWrites);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'chartAccounts')),
      onSnapshot(query(collection(db, 'projects'), ...filter, limit(1000)), (snap) => {
        useLedgerStore.getState().setCollectionTruncated('projects', snap.docs.length >= 1000);
        scheduleUpdate('projects', snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)), snap.metadata.hasPendingWrites);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'projects')),
      onSnapshot(query(collection(db, 'journalEntries'), ...filter, limit(2000)), (snap) => {
        useLedgerStore.getState().setCollectionTruncated('journalEntries', snap.docs.length >= 2000);
        scheduleUpdate('journalEntries', snap.docs.map(d => ({ id: d.id, ...d.data() } as JournalEntry)), snap.metadata.hasPendingWrites);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'journalEntries')),
    ];

    // Slow-moving configurations: Switch to one-time getDocs fetches on workspace load
    const loadSlowMovingData = async () => {
      try {
        const qTaxRates = query(collection(db, 'taxRates'), ...filter, limit(500));
        const snapTaxRates = await getDocs(qTaxRates);
        useLedgerStore.getState().setCollectionTruncated('taxRates', snapTaxRates.docs.length >= 500);
        scheduleUpdate('taxRates', snapTaxRates.docs.map(d => ({ id: d.id, ...d.data() } as TaxRate)), false);

        const qTemplates = query(collection(db, 'customTemplates'), where('uid', '==', user.uid), limit(500));
        const snapTemplates = await getDocs(qTemplates);
        useLedgerStore.getState().setCollectionTruncated('customTemplates', snapTemplates.docs.length >= 500);
        scheduleUpdate('customTemplates', snapTemplates.docs.map(d => ({ id: d.id, ...d.data() } as CustomTemplate)), false);

        const qPartners = query(collection(db, 'partners'), ...filter, limit(500));
        const snapPartners = await getDocs(qPartners);
        useLedgerStore.getState().setCollectionTruncated('partners', snapPartners.docs.length >= 500);
        scheduleUpdate('partners', snapPartners.docs.map(d => ({ id: d.id, ...d.data() })), false);

        const qAutoRules = query(collection(db, 'autoRules'), ...filter, limit(1000));
        const snapAutoRules = await getDocs(qAutoRules);
        useLedgerStore.getState().setCollectionTruncated('autoRules', snapAutoRules.docs.length >= 1000);
        scheduleUpdate('autoRules', snapAutoRules.docs.map(d => ({ id: d.id, ...d.data() })), false);

        const qRulePatterns = query(collection(db, 'rulePatterns'), ...filter, limit(2000));
        const snapRulePatterns = await getDocs(qRulePatterns);
        useLedgerStore.getState().setCollectionTruncated('rulePatterns', snapRulePatterns.docs.length >= 2000);
        const cache: Record<string, any> = {};
        snapRulePatterns.docs.forEach(d => {
          const data = d.data();
          cache[(data.description || '').toLowerCase().trim()] = data;
        });
        useLedgerStore.getState().setAnalyticalPatternCache(cache);

        const qDimensionNodes = query(collection(db, 'dimensionNodes'), ...filter, limit(10000));
        const snapDimensionNodes = await getDocs(qDimensionNodes);
        useLedgerStore.getState().setCollectionTruncated('dimensionNodes', snapDimensionNodes.docs.length >= 10000);
        let nodes = snapDimensionNodes.docs.map(d => ({ ...d.data() } as DimensionNode));
        if (snapDimensionNodes.empty) {
          const currentWorkspace = useAuthStore.getState().workspaces.find(w => w.id === currentWorkspaceId);
          if ((currentWorkspace as any)?.dimensionNodes && (currentWorkspace as any).dimensionNodes.length > 0) {
            nodes = (currentWorkspace as any).dimensionNodes;
            if (db && currentWorkspaceId) {
              migrateWorkspaceDimensionNodesToCollection(db, currentWorkspaceId).catch(e => {
                console.warn('[Firebase Ledger] Background dimension migration error:', e);
              });
            }
          }
        }
        useLedgerStore.getState().setDimensionNodes(nodes);
      } catch (err) {
        console.warn("[Firebase Ledger] Error loading static configs:", err);
      }
    };
    loadSlowMovingData();

    const isCurrent = { active: true };
    const allUnsubs = [...criticalListeners];

    return () => {
      isCurrent.active = false;
      allUnsubs.forEach(unsub => unsub());
      if (updateTimer) clearTimeout(updateTimer);
    };
  }, [user, currentWorkspaceId, startDate, endDate]);

  // Lazy-load other high-frequency/route-specific collections dynamically based on route activeTab
  
  // 1. Sales & Invoicing Hub
  useEffect(() => {
    if (!user || !currentWorkspaceId) return;
    if (activeTab !== 'sales' && activeTab !== 'estimates' && activeTab !== 'payments' && activeTab !== 'credit-notes' && activeTab !== 'audit-trail' && activeTab !== 'month-end-close') return;

    const filter = [where('workspaceId', '==', currentWorkspaceId)];
    const unsubInvoices = onSnapshot(query(collection(db, 'invoices'), ...filter, orderBy('date', 'desc'), limit(2000)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('invoices', snap.docs.length >= 2000);
      useLedgerStore.getState().setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'invoices'));

    const unsubCreditNotes = onSnapshot(query(collection(db, 'creditNotes'), ...filter, orderBy('date', 'desc'), limit(2000)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('creditNotes', snap.docs.length >= 2000);
      useLedgerStore.getState().setCreditNotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as CreditNote)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'creditNotes'));

    const unsubPayments = onSnapshot(query(collection(db, 'payments'), ...filter, orderBy('date', 'desc'), limit(2000)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('payments', snap.docs.length >= 2000);
      useLedgerStore.getState().setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Payment)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'payments'));

    const unsubEstimates = onSnapshot(query(collection(db, 'estimates'), ...filter, orderBy('date', 'desc'), limit(2000)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('estimates', snap.docs.length >= 2000);
      useLedgerStore.getState().setEstimates(snap.docs.map(d => ({ id: d.id, ...d.data() } as Estimate)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'estimates'));

    const unsubCustomers = onSnapshot(query(collection(db, 'customers'), ...filter, limit(2000)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('customers', snap.docs.length >= 2000);
      useLedgerStore.getState().setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'customers'));

    return () => {
      unsubInvoices();
      unsubCreditNotes();
      unsubPayments();
      unsubEstimates();
      unsubCustomers();
    };
  }, [user, currentWorkspaceId, activeTab]);

  // 2. Purchases, Bills & Vendors
  useEffect(() => {
    if (!user || !currentWorkspaceId) return;
    if (activeTab !== 'purchases' && activeTab !== 'inventory' && activeTab !== 'credit-notes' && activeTab !== 'month-end-close') return;

    const filter = [where('workspaceId', '==', currentWorkspaceId)];
    const unsubBills = onSnapshot(query(collection(db, 'bills'), ...filter, orderBy('date', 'desc'), limit(2000)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('bills', snap.docs.length >= 2000);
      useLedgerStore.getState().setBills(snap.docs.map(d => ({ id: d.id, ...d.data() } as Bill)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'bills'));

    const unsubVendorCredits = onSnapshot(query(collection(db, 'vendorCredits'), ...filter, orderBy('date', 'desc'), limit(2000)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('vendorCredits', snap.docs.length >= 2000);
      useLedgerStore.getState().setVendorCredits(snap.docs.map(d => ({ id: d.id, ...d.data() } as VendorCredit)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'vendorCredits'));

    const unsubVendors = onSnapshot(query(collection(db, 'vendors'), ...filter, limit(2000)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('vendors', snap.docs.length >= 2000);
      useLedgerStore.getState().setVendors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'vendors'));

    return () => {
      unsubBills();
      unsubVendorCredits();
      unsubVendors();
    };
  }, [user, currentWorkspaceId, activeTab]);

  // 3. Inventory Stock
  useEffect(() => {
    if (!user || !currentWorkspaceId) return;
    if (activeTab !== 'inventory') return;

    const filter = [where('workspaceId', '==', currentWorkspaceId)];
    const unsubInventory = onSnapshot(query(collection(db, 'inventory'), ...filter, limit(2000)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('inventory', snap.docs.length >= 2000);
      useLedgerStore.getState().setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'inventory'));

    return () => {
      unsubInventory();
    };
  }, [user, currentWorkspaceId, activeTab]);

  // 4. Budgets and forecasting
  useEffect(() => {
    if (!user || !currentWorkspaceId) return;
    if (activeTab !== 'budgets' && activeTab !== 'forecaster' && activeTab !== 'reports' && activeTab !== 'charts' && activeTab !== 'intelligence') return;

    const filter = [where('workspaceId', '==', currentWorkspaceId)];
    const unsubBudgets = onSnapshot(query(collection(db, 'budgets'), ...filter, limit(1000)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('budgets', snap.docs.length >= 1000);
      useLedgerStore.getState().setBudgets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Budget)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'budgets'));

    return () => {
      unsubBudgets();
    };
  }, [user, currentWorkspaceId, activeTab]);

  // 5. Month End Close & Payroll HR
  useEffect(() => {
    if (!user || !currentWorkspaceId) return;
    if (activeTab !== 'month-end-close') return;

    const filter = [where('workspaceId', '==', currentWorkspaceId)];
    const unsubPayRuns = onSnapshot(query(collection(db, 'payRuns'), ...filter, limit(1000)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('payRuns', snap.docs.length >= 1000);
      useLedgerStore.getState().setPayRuns(snap.docs.map(d => ({ id: d.id, ...d.data() } as PayRun)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'payRuns'));

    const unsubEmployees = onSnapshot(query(collection(db, 'employees'), ...filter, limit(1000)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('employees', snap.docs.length >= 1000);
      useLedgerStore.getState().setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'employees'));

    return () => {
      unsubPayRuns();
      unsubEmployees();
    };
  }, [user, currentWorkspaceId, activeTab]);

  // 6. Banking Feed & Reconciliations
  useEffect(() => {
    if (!user || !currentWorkspaceId) return;
    if (activeTab !== 'banking' && activeTab !== 'reconciliation' && activeTab !== 'month-end-close') return;

    const filter = [where('workspaceId', '==', currentWorkspaceId)];
    const unsubBankLines = onSnapshot(query(collection(db, 'bankLines'), ...filter, orderBy('date', 'desc'), limit(2000)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('bankLines', snap.docs.length >= 2000);
      useLedgerStore.getState().setBankLines(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'bankLines'));

    const unsubReconciliations = onSnapshot(query(collection(db, 'reconciliations'), ...filter, limit(1000)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('reconciliations', snap.docs.length >= 1000);
      useLedgerStore.getState().setReconciliations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'reconciliations'));

    return () => {
      unsubBankLines();
      unsubReconciliations();
    };
  }, [user, currentWorkspaceId, activeTab]);

  // 7. Forensic Audit Trail logs
  useEffect(() => {
    if (!user || !currentWorkspaceId) return;
    if (activeTab !== 'audit-trail') return;

    const filter = [where('workspaceId', '==', currentWorkspaceId)];
    const unsubPeriods = onSnapshot(query(collection(db, 'periods'), ...filter, limit(100)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('periods', snap.docs.length >= 100);
      useLedgerStore.getState().setPeriods(snap.docs.map(d => ({ id: d.id, ...d.data() } as PeriodStatus)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'periods'));

    const unsubScenarios = onSnapshot(query(collection(db, 'scenarios'), ...filter, limit(100)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('scenarios', snap.docs.length >= 100);
      const scenarios = snap.docs.map(d => ({ id: d.id, ...d.data() } as Scenario));
      useScenarioStore.getState().setScenarios(scenarios.length > 0 ? scenarios : [
        {
          id: 'default-scenario',
          name: 'Base Evolution',
          description: 'The natural trajectory of current operations.',
          ghosts: [],
          isActive: true
        }
      ]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'scenarios'));

    const unsubAuditLogs = onSnapshot(query(collection(db, 'auditLogs'), ...filter, orderBy('timestamp', 'desc'), limit(500)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('auditLogs', snap.docs.length >= 500);
      useLedgerStore.getState().setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs'));

    return () => {
      unsubAuditLogs();
      unsubPeriods();
      unsubScenarios();
    };
  }, [user, currentWorkspaceId, activeTab]);

  // 8. Recurring rules & fixed assets (Settings/Appearance/Data Health Views)
  useEffect(() => {
    if (!user || !currentWorkspaceId) return;
    if (activeTab !== 'settings' && activeTab !== 'data-health' && activeTab !== 'system-command-center' && activeTab !== 'recurring') return;

    const filter = [where('workspaceId', '==', currentWorkspaceId)];
    const unsubRecurring = onSnapshot(query(collection(db, 'recurring'), ...filter, limit(1000)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('recurring', snap.docs.length >= 1000);
      useLedgerStore.getState().setRecurring(snap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          ...data,
          status: data.status || (data.isActive ? 'active' : 'paused'),
          payee: data.payee || data.template?.payee || '',
          lastOccurrence: data.lastOccurrence || data.lastTriggeredAt || ''
        } as RecurringTransaction;
      }));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'recurring'));

    const unsubAssets = onSnapshot(query(collection(db, 'assets'), ...filter, limit(2000)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('assets', snap.docs.length >= 2000);
      useLedgerStore.getState().setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() } as FixedAsset)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'assets'));

    const unsubInvites = onSnapshot(query(collection(db, 'invites'), ...filter, limit(500)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('invites', snap.docs.length >= 500);
      useLedgerStore.getState().setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'invites'));

    const unsubWorkspaceShards = onSnapshot(query(collection(db, 'workspaceShards'), ...filter, limit(100)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('workspaceShards', snap.docs.length >= 100);
      useLedgerStore.getState().setWorkspaceShards(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'workspaceShards'));

    const unsubBillingLedgerTraces = onSnapshot(query(collection(db, 'billingLedgerTraces'), ...filter, limit(500)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('billingLedgerTraces', snap.docs.length >= 500);
      useLedgerStore.getState().setBillingLedgerTraces(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'billingLedgerTraces'));

    const unsubSupportTickets = onSnapshot(query(collection(db, 'supportTickets'), ...filter, limit(500)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('supportTickets', snap.docs.length >= 500);
      useLedgerStore.getState().setSupportTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'supportTickets'));

    const unsubSupportMessages = onSnapshot(query(collection(db, 'supportMessages'), ...filter, limit(1000)), (snap) => {
      useLedgerStore.getState().setCollectionTruncated('supportMessages', snap.docs.length >= 1000);
      useLedgerStore.getState().setSupportMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'supportMessages'));

    return () => {
      unsubRecurring();
      unsubAssets();
      unsubInvites();
      unsubWorkspaceShards();
      unsubBillingLedgerTraces();
      unsubSupportTickets();
      unsubSupportMessages();
    };
  }, [user, currentWorkspaceId, activeTab]);

  return null;
}
