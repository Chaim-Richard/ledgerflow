import { useState, useEffect, useMemo, useCallback, useTransition } from 'react';
import { usePerformanceTrace } from './hooks/usePerformanceTrace';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, doc, addDoc, writeBatch, setDoc } from 'firebase/firestore';
import { Toaster, toast } from 'sonner';
import { motion } from 'motion/react';
import { BUSINESS_TEMPLATES } from './lib/businessTemplates';

// Stores & Hooks
import { useAuthStore } from './stores/useAuthStore';
import { useLedgerStore } from './stores/useLedgerStore';
import { useUIStore } from './stores/useUIStore';
import { useLedgerData } from './hooks/useLedgerData';
import { useAIActions } from './hooks/useAIActions';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTransactionActions } from './hooks/useTransactionActions';
import { ChartAccount } from './types';
import { useCommandDispatcher, useSystemProps } from './hooks/useSystemContext';
import { useBillingStore } from './modules/billing/BillingService';

// Core Architectural Imports
import { AuthScreen } from './core/auth/AuthScreen';
import { InitializationScreen } from './core/auth/InitializationScreen';
import { RootLayout } from './core/layout/RootLayout';
import { lazy, Suspense } from 'react';
const LedgerAutoAuditor = lazy(() => import('./components/forensics/LedgerAutoAuditor').then(m => ({ default: m.LedgerAutoAuditor })));

import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const [isPending, startTransition] = useTransition();
  usePerformanceTrace("App");

  const [isInitializing, setIsInitializing] = useState(true);
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);
  const currentWorkspaceId = useAuthStore(state => state.currentWorkspaceId);
  const workspaces = useAuthStore(state => state.workspaces);
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);

  
  const language = useUIStore(state => state.language);
  const speedDials = useUIStore(state => state.speedDials);
  const theme = useUIStore(state => state.theme);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);
  const isQuietMode = useUIStore(state => state.isQuietMode);

  useEffect(() => {
    document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = language || 'en';
  }, [language]);
  const setActiveTabStore = useUIStore(state => state.setActiveTab);
  const navigateToolStore = useUIStore(state => state.navigateTool);
  const isCommandPaletteOpen = useUIStore(state => state.isCommandPaletteOpen);
  const setCommandPaletteOpen = useUIStore(state => state.setCommandPaletteOpen);
  const isQuickEntryOpen = useUIStore(state => state.isQuickEntryOpen);
  const setQuickEntryOpen = useUIStore(state => state.setQuickEntryOpen);
  const setImporterOpen = useUIStore(state => state.setImporterOpen);
  const isDiagnosticConsoleOpen = useUIStore(state => state.isDiagnosticConsoleOpen);
  const setDiagnosticConsoleOpen = useUIStore(state => state.setDiagnosticConsoleOpen);
  const isShortcutOverlayOpen = useUIStore(state => state.isShortcutOverlayOpen);
  const setShortcutOverlayOpen = useUIStore(state => state.setShortcutOverlayOpen);
  const isArchitectureOpen = useUIStore(state => state.isArchitectureOpen);
  const setArchitectureOpen = useUIStore(state => state.setArchitectureOpen);
  const toggleFocusMode = useUIStore(state => state.toggleFocusMode);
  const setTemplateSelectorOpen = useUIStore(state => state.setTemplateSelectorOpen);

  // High-Performance Data Ingress
  useLedgerData();
  const txActions = useTransactionActions();
  const ai = useAIActions();
  
  const { handleAction } = useCommandDispatcher();
  const coreSystemProps = useSystemProps(handleAction);

  // Language & Direction Control & Sizing Core
  useEffect(() => {
    // Fetch dynamic limits & usage caps from public registration-status API
    useBillingStore.getState().fetchSystemCaps();
    const capsInterval = setInterval(() => {
      useBillingStore.getState().fetchSystemCaps();
    }, 30000);

    const handleResize = () => {
      if (window.innerWidth < 1024) {
        useUIStore.setState({ isSidebarOpen: false });
      } else {
        useUIStore.setState({ isSidebarOpen: true });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearInterval(capsInterval);
    };
  }, []);

  const navigateTool = useCallback((tab: any) => {
    startTransition(() => {
        navigateToolStore(tab);
    });
  }, [navigateToolStore]);

  const setActiveTab = useCallback((tab: any) => {
    startTransition(() => {
        setActiveTabStore(tab);
    });
  }, [setActiveTabStore]);

  useEffect(() => {
    return onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      setIsInitializing(false);
    });
  }, [setUser]);

  // Operational Keyboard Shortcuts
const shortcutMap = useMemo(() => {
    const base: Record<string, () => void> = {
      'mod+k': () => setCommandPaletteOpen(!isCommandPaletteOpen),
      'mod+q': () => setQuickEntryOpen(!isQuickEntryOpen),
      'mod+f': () => toggleFocusMode(),
      'mod+shift+k': () => setDiagnosticConsoleOpen(!isDiagnosticConsoleOpen),
      'mod+/?': () => setShortcutOverlayOpen(!isShortcutOverlayOpen),
      '?': () => setShortcutOverlayOpen(!isShortcutOverlayOpen),
      'mod+1': () => setActiveTab('dashboard' as any),
      'mod+2': () => setActiveTab('transactions' as any),
      'mod+3': () => setActiveTab('ledger' as any),
      'mod+e': () => handleAction('export' as any),
      'mod+p': () => setActiveTab('reports' as any),
      'mod+shift+d': () => useUIStore.getState().setTheme(useUIStore.getState().theme === 'dark' ? 'light' : 'dark'),
      'mod+i': () => setImporterOpen(true),
      'mod+shift+a': () => setArchitectureOpen(!isArchitectureOpen),
    };
    Object.entries(speedDials || {}).forEach(([key, tabId]) => {
      base[`alt+${key.toLowerCase()}`] = () => navigateTool(tabId);
    });
    return base;
  }, [
    isCommandPaletteOpen, isQuickEntryOpen, isDiagnosticConsoleOpen,
    isShortcutOverlayOpen, isArchitectureOpen, speedDials, navigateTool
  ]);
  
  useKeyboardShortcuts(shortcutMap);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        useLedgerStore.getState().recomputeBalances();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);


  const [isGuest, setIsGuest] = useState(() => localStorage.getItem('isGuest') === 'true');

  const handleGuest = () => {
    localStorage.setItem('isGuest', 'true');
    setIsGuest(true);
  };

  const handleLoginPrompt = () => {
    localStorage.setItem('isGuest', 'false');
    setIsGuest(false);
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    localStorage.removeItem('clearbook_use_sandbox_mode');
    localStorage.removeItem('clearbook_identity_email');
    localStorage.removeItem('clearbook_identity_name');
    
    try {
      await signInWithPopup(auth, provider);
      setIsGuest(false);
      localStorage.setItem('isGuest', 'false');
      toast.success('SUCCESSFULLY LOGGED IN WITH GOOGLE');
    } catch (e) {
      console.error("Google Sign-In failed:", e);
      toast.error('Google Sign-In failed or was cancelled.');
    }
  };

  const handleEmailLogin = async (email: string, pass: string) => {
    localStorage.removeItem('clearbook_use_sandbox_mode');
    localStorage.removeItem('clearbook_identity_email');
    localStorage.removeItem('clearbook_identity_name');
    
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setIsGuest(false);
      localStorage.setItem('isGuest', 'false');
      toast.success('SUCCESSFULLY LOGGED IN');
    } catch (e: any) {
      console.error("Login failed:", e);
      toast.error('Login failed: ' + e.message);
      throw e;
    }
  };

  const handleEmailSignup = async (email: string, pass: string) => {
    localStorage.removeItem('clearbook_use_sandbox_mode');
    localStorage.removeItem('clearbook_identity_email');
    localStorage.removeItem('clearbook_identity_name');
    
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      setIsGuest(false);
      localStorage.setItem('isGuest', 'false');
      toast.success('ACCOUNT CREATED SUCCESSFULLY');
    } catch (e: any) {
      console.error("Signup failed:", e);
      toast.error('Signup failed: ' + e.message);
      throw e;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('clearbook_use_sandbox_mode');
    localStorage.removeItem('clearbook_identity_email');
    localStorage.removeItem('clearbook_identity_name');
    
    setUser(null);
    useLedgerStore.setState({ 
      transactions: [], 
      accounts: [], 
      journalEntries: [],
      computedAccounts: [],
      totalLedgerBalance: 0
    });
    
    signOut(auth).catch(() => {});
    toast.success('Secure session terminated');
  };

  const handleApplyAITemplate = useCallback(async (customBlueprint: any) => {
    if (!user || !currentWorkspaceId || !customBlueprint) return;
    
    const loader = toast.loading(`Initiating AI ledger structural transformation...`);
    try {
      const batch = writeBatch(db);
      
      // Update workspace with the AI schema
      batch.update(doc(db, 'workspaces', currentWorkspaceId), {
        businessType: customBlueprint.id || 'ai_custom',
        analyticalTopology: customBlueprint.dashboardSchema || customBlueprint.topology
      });

      const hasTransactions = useLedgerStore.getState().transactions.length > 0;
      
      if (!hasTransactions) {
        const currentAccounts = useLedgerStore.getState().accounts;
        if (currentAccounts.length > 0) {
          currentAccounts.forEach(acc => {
            if (acc.id) {
              batch.delete(doc(db, 'chartAccounts', acc.id));
            }
          });
        }
        
        const accountsToMap = customBlueprint.chartOfAccounts || customBlueprint.accounts || [];
        accountsToMap.forEach((acc: any) => {
          const accRef = doc(collection(db, 'chartAccounts'));
          batch.set(accRef, {
            ...acc,
            uid: user.uid,
            workspaceId: currentWorkspaceId,
            balanceCents: 0,
            isArchived: false,
            createdAt: new Date().toISOString()
          });
        });
      } else {
        const accountsToMap = customBlueprint.chartOfAccounts || customBlueprint.accounts || [];
        accountsToMap.forEach((acc: any) => {
          const exists = useLedgerStore.getState().accounts.some((a: any) => a.name.toLowerCase() === acc.name.toLowerCase());
          if (!exists) {
            const accRef = doc(collection(db, 'chartAccounts'));
            batch.set(accRef, {
              ...acc,
              uid: user.uid,
              workspaceId: currentWorkspaceId,
              balanceCents: 0,
              isArchived: false,
              createdAt: new Date().toISOString()
            });
          }
        });
      }

      await batch.commit();
      toast.success('AI Ledger Template synchronized and applied successfully.', { id: loader });
      useUIStore.getState().setAIBlueprintOpen(false);
      useUIStore.getState().setTemplateSelectorOpen(false);
      useUIStore.getState().setActiveTab('intelligence');
    } catch (error: any) {
      toast.error(`Transformation Failed: ${error.message}`, { id: loader });
    }
  }, [user, currentWorkspaceId]);

  const handleSelectTemplate = useCallback(async (templateId: string) => {
    if (!user || !currentWorkspaceId) return;
    const template = BUSINESS_TEMPLATES[templateId];
    if (!template) return;

    const loader = toast.loading(`Initiating ledger structural transformation...`);
    try {
      const batch = writeBatch(db);
      
      batch.update(doc(db, 'workspaces', currentWorkspaceId), {
        businessType: templateId,
        analyticalTopology: template.topology
      });

      // Implement correct "Code Physics" of double-entry ledger alignment:
      // If there are no transactions recorded in this workspace, we cleanly purge existing placeholder 
      // accounts and write the template's exact configuration.
      // If transactions do exist, we execute a non-destructive "Smart Blend" (adding missing template accounts).
      const hasTransactions = useLedgerStore.getState().transactions.length > 0;
      
      if (!hasTransactions) {
        // Clean Reset Strategy
        const currentAccounts = useLedgerStore.getState().accounts;
        if (currentAccounts.length > 0) {
          currentAccounts.forEach(acc => {
            if (acc.id) {
              batch.delete(doc(db, 'chartAccounts', acc.id));
            }
          });
        }
        
        template.accounts.forEach((acc: Partial<ChartAccount>) => {
          const accRef = doc(collection(db, 'chartAccounts'));
          batch.set(accRef, {
            ...acc,
            uid: user.uid,
            workspaceId: currentWorkspaceId,
            balanceCents: 0,
            createdAt: new Date().toISOString()
          });
        });
      } else {
        // Smart Blend Strategy
        const currentAccounts = useLedgerStore.getState().accounts;
        const existingCodes = new Set(currentAccounts.map(a => a.code));
        const existingNames = new Set(currentAccounts.map(a => (a.name || '').toLowerCase().trim()));

        template.accounts.forEach((acc: Partial<ChartAccount>) => {
          if (!acc.code) return;
          const isCodeDuplicate = existingCodes.has(acc.code);
          const isNameDuplicate = acc.name ? existingNames.has(acc.name.toLowerCase().trim()) : false;

          if (!isCodeDuplicate && !isNameDuplicate) {
            const accRef = doc(collection(db, 'chartAccounts'));
            batch.set(accRef, {
              ...acc,
              uid: user.uid,
              workspaceId: currentWorkspaceId,
              balanceCents: 0,
              createdAt: new Date().toISOString()
            });
          }
        });
      }

      await batch.commit();

      setTemplateSelectorOpen(false);
      
      setActiveTab('ledger'); // Navigate to the Ledger/Chart of Accounts (the "Integrity")
      
      toast.success(`STRUCTURE TRANSGRESSED TO ${(template.name || 'UNKNOWN').toUpperCase()}`, { id: loader });
    } catch (e) {
      console.error("Template transformation aborted:", e);
      toast.error('SETUP FAILED', { id: loader });
    }
  }, [user, currentWorkspaceId, setTemplateSelectorOpen, setActiveTab]);

  const handleSaveCurrentTemplate = useCallback(async () => {
    if (!user || !currentWorkspaceId || !currentWorkspace) return;
    
    const name = window.prompt("Enter template name:", `${currentWorkspace.name} Clone`);
    if (!name) return;

    try {
      await addDoc(collection(db, 'customTemplates'), {
        name,
        industry: currentWorkspace.businessType || 'generic',
        accounts: useLedgerStore.getState().accounts.map(a => ({ code: a.code, name: a.name, type: a.type, category: a.category })),
        analyticalTopology: currentWorkspace.analyticalTopology || {},
        uid: user.uid,
        createdAt: new Date().toISOString()
      });
      toast.success('TEMPLATE SAVED');
    } catch (e) {
      toast.error('SNAPSHOT FAILED');
    }
  }, [user, currentWorkspaceId, currentWorkspace]);

  const handleCreateWorkspace = useCallback(async () => {
    if (!user) return;
    
    const name = window.prompt("Enter new workspace name:", "New Workspace");
    if (!name) return;

    try {
      const workspaceRef = doc(collection(db, 'workspaces'));
      const newWorkspace = {
        id: workspaceRef.id,
        uid: user.uid,
        name: name,
        type: 'business',
        currency: 'USD',
        businessType: 'generic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(workspaceRef, newWorkspace);
      useAuthStore.getState().setCurrentWorkspaceId(workspaceRef.id);
      toast.success('Workspace created');
    } catch (e) {
      console.error(e);
      toast.error('Failed to create workspace');
    }
  }, [user]);



  if (isInitializing) {
    return <InitializationScreen language={language} />;
  }

  if (!user && !isGuest) {
    return <AuthScreen onLogin={handleLogin} onEmailLogin={handleEmailLogin} onEmailSignup={handleEmailSignup} onGuest={handleGuest} language={language} />;
  }

  return (
    <ErrorBoundary>
      <div dir={language === 'he' ? 'rtl' : 'ltr'} className="h-[100dvh] w-full bg-[var(--ink)] overflow-hidden flex flex-col font-sans text-[var(--text)]">
        <Toaster theme="light" position="top-right" expand={false} richColors closeButton className={isQuietMode ? 'opacity-0 pointer-events-none' : ''} />
        {/* Google-grade Progress Line */}
        {isPending && (
          <div className="fixed top-0 left-0 right-0 h-1 z-[1000] overflow-hidden">
              <motion.div 
                className="h-full bg-emerald-500 shadow-[0_0_15px_#10b981]"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
              />
          </div>
        )}
        <Suspense fallback={null}><LedgerAutoAuditor /></Suspense>
        <RootLayout 
          handleAction={handleAction} 
          coreSystemProps={coreSystemProps} 
          handleLogout={handleLogout} 
          handleLoginPrompt={handleLoginPrompt}
          isPending={isPending} 
          txActions={txActions}
          ai={ai}
          handleSelectTemplate={handleSelectTemplate}
          handleSaveCurrentTemplate={handleSaveCurrentTemplate}
          handleApplyAITemplate={handleApplyAITemplate}
          handleCreateWorkspace={handleCreateWorkspace}
        />
      </div>
    </ErrorBoundary>
  );
}