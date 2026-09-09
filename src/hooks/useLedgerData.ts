import { useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc,
  limit,
  orderBy
} from 'firebase/firestore';
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
  InventoryItem, 
  FixedAsset, 
  RecurringTransaction, 
  Employee, 
  PayRun, 
  TaxRate,
  Workspace,
  CustomTemplate,
  UserProfile
} from '../types';

import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';

import { safeAsync } from "../lib/utils";
import { fetchSnapshotBridge, useSnapshotBridge } from "./useSnapshotBridge";


export function useLedgerData() {
  const user = useAuthStore(s => s.user);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const setWorkspaces = useAuthStore(s => s.setWorkspaces);
  const setCurrentWorkspaceId = useAuthStore(s => s.setCurrentWorkspaceId);
  const setUserProfile = useAuthStore(s => s.setUserProfile);
  useSnapshotBridge();


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
        if (user.email === 'shmuelbiller@gmail.com' && data.role !== 'admin') {
          const { updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'users', user.uid), { role: 'admin' }).catch(console.error);
          data.role = 'admin';
        }
        setUserProfile(data);
      } else {
        const profileData: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          role: user.email === 'shmuelbiller@gmail.com' ? 'admin' : 'client',
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
  const setMatchingThreshold = useLedgerStore(state => state.setMatchingThreshold);

  useEffect(() => {
    const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);
    if (currentWorkspace) {
      const targetCurrency = currentWorkspace.currency || 'USD';
      const targetLockDate = currentWorkspace.lockDate || null;
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
  }, [currentWorkspaceId, workspaces, baseCurrency, lockDate, matchingThreshold, setBaseCurrency, setLockDate, setMatchingThreshold]);

  // Main Entities (Workspace Scoped)
  useEffect(() => {
    if (!user || !currentWorkspaceId) return;

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

    const criticalListeners = [
      onSnapshot(query(collection(db, 'transactions'), ...filter, orderBy('date', 'desc')), (snap) => {
        useLedgerStore.getState().setIsDataTruncated(false);
        scheduleUpdate('transactions', snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)), snap.metadata.hasPendingWrites);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions')),
      onSnapshot(query(collection(db, 'chartAccounts'), ...filter), (snap) => {
        scheduleUpdate('accounts', snap.docs.map(d => ({ id: d.id, ...d.data() } as ChartAccount)), snap.metadata.hasPendingWrites);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'chartAccounts')),
      onSnapshot(query(collection(db, 'projects'), ...filter), (snap) => {
        scheduleUpdate('projects', snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)), snap.metadata.hasPendingWrites);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'projects')),
      onSnapshot(query(collection(db, 'rulePatterns'), ...filter), (snap) => {
        const cache: Record<string, any> = {};
        snap.docs.forEach(d => {
          const data = d.data();
          cache[(data.description || '').toLowerCase().trim()] = data;
        });
        useLedgerStore.getState().setAnalyticalPatternCache(cache);
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'rulePatterns')),
    ];

    const isCurrent = { active: true };
    const allUnsubs = [...criticalListeners];

    // Defer non-critical listeners to prioritize initial paint and dashboard readiness
    const secondaryTimer = setTimeout(() => {
      if (!isCurrent.active) return;
      const secondaryUnsubs = [
        onSnapshot(query(collection(db, 'budgets'), ...filter), (snap) => {
          scheduleUpdate('budgets', snap.docs.map(d => ({ id: d.id, ...d.data() } as Budget)), snap.metadata.hasPendingWrites);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'budgets')),
        onSnapshot(query(collection(db, 'vendors'), ...filter), (snap) => {
          scheduleUpdate('vendors', snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor)), snap.metadata.hasPendingWrites);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'vendors')),
        onSnapshot(query(collection(db, 'customers'), ...filter), (snap) => {
          scheduleUpdate('customers', snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)), snap.metadata.hasPendingWrites);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'customers')),
        onSnapshot(query(collection(db, 'invoices'), ...filter, orderBy('date', 'desc'), limit(2000)), (snap) => {
          scheduleUpdate('invoices', snap.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)), snap.metadata.hasPendingWrites);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'invoices')),
        onSnapshot(query(collection(db, 'bills'), ...filter, orderBy('date', 'desc'), limit(2000)), (snap) => {
          scheduleUpdate('bills', snap.docs.map(d => ({ id: d.id, ...d.data() } as Bill)), snap.metadata.hasPendingWrites);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'bills')),
        onSnapshot(query(collection(db, 'inventory'), ...filter), (snap) => {
          scheduleUpdate('inventory', snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)), snap.metadata.hasPendingWrites);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'inventory')),
        onSnapshot(query(collection(db, 'assets'), ...filter), (snap) => {
          scheduleUpdate('assets', snap.docs.map(d => ({ id: d.id, ...d.data() } as FixedAsset)), snap.metadata.hasPendingWrites);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'assets')),
        onSnapshot(query(collection(db, 'recurring'), ...filter), (snap) => {
          scheduleUpdate('recurring', snap.docs.map(d => ({ id: d.id, ...d.data() } as RecurringTransaction)), snap.metadata.hasPendingWrites);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'recurring')),
        onSnapshot(query(collection(db, 'employees'), ...filter), (snap) => {
          scheduleUpdate('employees', snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee)), snap.metadata.hasPendingWrites);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'employees')),
        onSnapshot(query(collection(db, 'payRuns'), ...filter), (snap) => {
          scheduleUpdate('payRuns', snap.docs.map(d => ({ id: d.id, ...d.data() } as PayRun)), snap.metadata.hasPendingWrites);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'payRuns')),
        onSnapshot(query(collection(db, 'taxRates'), ...filter), (snap) => {
          scheduleUpdate('taxRates', snap.docs.map(d => ({ id: d.id, ...d.data() } as TaxRate)), snap.metadata.hasPendingWrites);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'taxRates')),
        onSnapshot(query(collection(db, 'customTemplates'), where('uid', '==', user.uid)), (snap) => {
          scheduleUpdate('customTemplates', snap.docs.map(d => ({ id: d.id, ...d.data() } as CustomTemplate)), snap.metadata.hasPendingWrites);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'customTemplates')),
        onSnapshot(query(collection(db, 'auditLogs'), ...filter, orderBy('timestamp', 'desc'), limit(500)), (snap) => {
          scheduleUpdate('auditLogs', snap.docs.map(d => ({ id: d.id, ...d.data() })), snap.metadata.hasPendingWrites);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')),
        onSnapshot(query(collection(db, 'partners'), ...filter), (snap) => {
          scheduleUpdate('partners', snap.docs.map(d => ({ id: d.id, ...d.data() })), snap.metadata.hasPendingWrites);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'partners')),
        onSnapshot(query(collection(db, 'reconciliations'), ...filter), (snap) => {
          scheduleUpdate('reconciliations', snap.docs.map(d => ({ id: d.id, ...d.data() })), snap.metadata.hasPendingWrites);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'reconciliations')),
        onSnapshot(query(collection(db, 'autoRules'), ...filter), (snap) => {
          scheduleUpdate('autoRules', snap.docs.map(d => ({ id: d.id, ...d.data() })), snap.metadata.hasPendingWrites);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'autoRules')),
        onSnapshot(query(collection(db, 'bankLines'), ...filter, orderBy('date', 'desc'), limit(2000)), (snap) => {
          scheduleUpdate('bankLines', snap.docs.map(d => ({ id: d.id, ...d.data() })), snap.metadata.hasPendingWrites);
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'bankLines')),
      ];
      allUnsubs.push(...secondaryUnsubs);
    }, 500);

    return () => {
      isCurrent.active = false;
      allUnsubs.forEach(unsub => unsub());
      clearTimeout(secondaryTimer);
      if (updateTimer) clearTimeout(updateTimer);
    };
  }, [user, currentWorkspaceId]);

  return null;
}
