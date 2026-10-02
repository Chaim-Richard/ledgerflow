import { useEffect, useRef } from 'react';
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
import type { Transaction, ChartAccount, RecurringTransaction, Workspace, CustomTemplate, UserProfile, DimensionNode } from '../types';
import { Scenario, useScenarioStore } from '../lib/scenarioStore';
import { seedDemoWorkspace } from '../lib/demoWorkspaceSeeder';
import { migrateWorkspaceDimensionNodesToCollection } from '../lib/migrations/dimensionNodesMigration';

import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';

import { safeAsync } from "../lib/utils";
import { useDataNeedsStore } from "../stores/useDataNeedsStore";
import { LEDGER_COLLECTIONS, keysToStart } from "../lib/ledgerCollections";
import type { LedgerCollectionSpec, LedgerKey } from "../lib/ledgerCollections";
import { effectiveLockDate } from '../lib/periodLock';


export function useLedgerData() {
  const user = useAuthStore(s => s.user);
  const isGuest = useAuthStore(s => s.isGuest);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const setWorkspaces = useAuthStore(s => s.setWorkspaces);
  const setCurrentWorkspaceId = useAuthStore(s => s.setCurrentWorkspaceId);
  const setUserProfile = useAuthStore(s => s.setUserProfile);
  
  const setAccounts = useLedgerStore(s => s.setAccounts);
  const setCustomers = useLedgerStore(s => s.setCustomers);
  const setVendors = useLedgerStore(s => s.setVendors);
  const setTransactions = useLedgerStore(s => s.setTransactions);
  
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
    useDataNeedsStore.getState().resetLoaded();
    useLedgerStore.setState({
      ...Object.fromEntries(Object.keys(LEDGER_COLLECTIONS).filter(k => k !== 'scenarios').map(k => [k, []])),
      truncatedCollections: {},
      isDataTruncated: false,
      runningBalances: {
        totalIncome: 0,
        totalExpense: 0,
        totalBalance: 0,
        projectMetrics: {},
        categoryMetrics: {}
      }
    });

    // Reference lists read once per workspace
    const filter = [where('workspaceId', '==', currentWorkspaceId)];
    const loadReferenceData = async () => {
      try {
        const snapTemplates = await getDocs(query(collection(db, 'customTemplates'), where('uid', '==', user.uid), limit(500)));
        useLedgerStore.getState().setCollectionTruncated('customTemplates', snapTemplates.docs.length >= 500);
        useLedgerStore.getState().setCustomTemplates(snapTemplates.docs.map(d => ({ id: d.id, ...d.data() } as CustomTemplate)));

        const snapPartners = await getDocs(query(collection(db, 'partners'), ...filter, limit(500)));
        useLedgerStore.getState().setCollectionTruncated('partners', snapPartners.docs.length >= 500);
        useLedgerStore.getState().setPartners(snapPartners.docs.map(d => ({ id: d.id, ...d.data() })));

        const snapRulePatterns = await getDocs(query(collection(db, 'rulePatterns'), ...filter, limit(2000)));
        useLedgerStore.getState().setCollectionTruncated('rulePatterns', snapRulePatterns.docs.length >= 2000);
        const cache: Record<string, any> = {};
        snapRulePatterns.docs.forEach(d => {
          const data = d.data();
          cache[(data.description || '').toLowerCase().trim()] = data;
        });
        useLedgerStore.getState().setAnalyticalPatternCache(cache);

        const snapDimensionNodes = await getDocs(query(collection(db, 'dimensionNodes'), ...filter, limit(10000)));
        useLedgerStore.getState().setCollectionTruncated('dimensionNodes', snapDimensionNodes.docs.length >= 10000);
        let nodes = snapDimensionNodes.docs.map(d => ({ ...d.data() } as DimensionNode));
        if (snapDimensionNodes.empty) {
          const currentWorkspace = useAuthStore.getState().workspaces.find(w => w.id === currentWorkspaceId);
          if ((currentWorkspace as any)?.dimensionNodes && (currentWorkspace as any).dimensionNodes.length > 0) {
            nodes = (currentWorkspace as any).dimensionNodes;
            if (db && currentWorkspaceId) {
              migrateWorkspaceDimensionNodesToCollection(db, currentWorkspaceId).catch(e => {
                console.warn('[Ledger] Background dimension migration error:', e);
              });
            }
          }
        }
        useLedgerStore.getState().setDimensionNodes(nodes);
      } catch (err) {
        console.warn('[Ledger] Error loading reference data:', err);
      }
    };
    loadReferenceData();
  }, [user, currentWorkspaceId]);

  // Live collections (src/lib/ledgerCollections.ts): the core ones as soon as a workspace opens,
  // the others the first time a screen asks for them (useLedgerCollections). Each stays live until
  // the workspace changes, so no screen sees a stale copy; changes are fetched incrementally.
  const asked = useDataNeedsStore(s => s.asked);
  const active = useRef(new Map<string, () => void>());
  useEffect(() => {
    const subscriptions = active.current;
    return () => {
      subscriptions.forEach(unsubscribe => unsubscribe());
      subscriptions.clear();
    };
  }, [user, currentWorkspaceId]);
  useEffect(() => {
    if (!user || !currentWorkspaceId) return;
    for (const key of keysToStart(asked, new Set(active.current.keys()))) {
      active.current.set(key, subscribeLedgerCollection(key, currentWorkspaceId));
    }
  }, [user, currentWorkspaceId, asked]);

  return null;
}

type StoredRow = { id: string } & Record<string, unknown>;

function toStore(key: LedgerKey, rows: StoredRow[]): void {
  const store = useLedgerStore.getState();
  switch (key) {
    case 'transactions': store.setTransactions(rows as unknown as Transaction[]); return;
    case 'accounts': store.setAccounts(rows as unknown as ChartAccount[]); return;
    case 'recurring':
      store.setRecurring(rows.map(row => {
        const data = row as StoredRow & Partial<RecurringTransaction> & { lastTriggeredAt?: string; template?: { payee?: string } };
        return {
          ...data,
          status: data.status || (data.isActive ? 'active' : 'paused'),
          payee: data.payee || data.template?.payee || '',
          lastOccurrence: data.lastOccurrence || data.lastTriggeredAt || ''
        } as RecurringTransaction;
      }));
      return;
    case 'scenarios': {
      const scenarios = rows as unknown as Scenario[];
      useScenarioStore.getState().setScenarios(scenarios.length > 0 ? scenarios : [{
        id: 'default-scenario',
        name: 'Base Evolution',
        description: 'The natural trajectory of current operations.',
        ghosts: [],
        isActive: true
      }]);
      return;
    }
    default: {
      const setter = (store as unknown as Record<string, unknown>)[`set${key.charAt(0).toUpperCase()}${key.slice(1)}`];
      if (typeof setter === 'function') (setter as (data: unknown[]) => void)(rows);
    }
  }
}

/** One live collection of one workspace into the store. */
function subscribeLedgerCollection(key: LedgerKey, workspaceId: string): () => void {
  const spec: LedgerCollectionSpec = LEDGER_COLLECTIONS[key];
  const constraints = [where('workspaceId', '==', workspaceId)];
  if (spec.newestFirstBy) constraints.push(orderBy(spec.newestFirstBy, 'desc'));
  constraints.push(limit(spec.cap));
  return onSnapshot(query(collection(db, spec.collection), ...constraints), (snap) => {
    if (useAuthStore.getState().currentWorkspaceId !== workspaceId) return;
    useLedgerStore.getState().setCollectionTruncated(spec.collection, snap.docs.length >= spec.cap);
    toStore(key, snap.docs.map(d => ({ id: d.id, ...d.data() })));
    useDataNeedsStore.getState().markLoaded(key);
  }, (err) => handleFirestoreError(err, OperationType.LIST, spec.collection));
}
