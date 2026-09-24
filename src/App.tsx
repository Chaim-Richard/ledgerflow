import { useState, useEffect, useMemo, useCallback, useTransition } from 'react';
import { usePerformanceTrace } from './hooks/usePerformanceTrace';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from './lib/db/auth';
import { collection, doc, addDoc, writeBatch, setDoc } from './lib/db/firestore';
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
import { useCommandDispatcher } from './hooks/useSystemContext';
import { useBillingStore } from './modules/billing/BillingService';

// Core Architectural Imports
import { AuthScreen } from './core/auth/AuthScreen';
import { InitializationScreen } from './core/auth/InitializationScreen';
import { RootLayout } from './core/layout/RootLayout';
import { lazy, Suspense } from 'react';
const LedgerAutoAuditor = lazy(() => import('./components/forensics/LedgerAutoAuditor').then(m => ({ default: m.LedgerAutoAuditor })));

import { FallbackBoundary } from './components/FallbackBoundary';
import PublicInvoicePage from './components/sales/PublicInvoicePage';
import CookieConsent from './components/legal/CookieConsent';
import LegalModal from './components/legal/LegalModal';


export default function App() {
  const [isPending, startTransition] = useTransition();
  usePerformanceTrace("App");

  const [isInitializing, setIsInitializing] = useState(true);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalModalTab, setLegalModalTab] = useState<'terms' | 'privacy'>('privacy');
  const user = useAuthStore(state => state.user);
  const setUser = useAuthStore(state => state.setUser);
  const currentWorkspaceId = useAuthStore(state => state.currentWorkspaceId);
  const workspaces = useAuthStore(state => state.workspaces);
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);

  
  const language = useUIStore(state => state.language);
  const speedDials = useUIStore(state => state.speedDials);
  const theme = useUIStore(state => state.theme);
  const fontSizeScale = useUIStore(state => state.fontSizeScale);
  const fontFamily = useUIStore(state => state.fontFamily);
  const accentColor = useUIStore(state => state.accentColor);
  const highContrast = useUIStore(state => state.highContrast);
  const rowDensity = useUIStore(state => state.rowDensity);
  const reduceMotion = useUIStore(state => state.reduceMotion);

  // Dynamic Appearance & Accessibility Effect
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }

    // Apply Text Sizing Scale
    root.style.fontSize = `${fontSizeScale}%`;

    // Apply Font Family
    const fontMap: Record<string, string> = {
      system: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      inter: '"Inter", ui-sans-serif, system-ui, sans-serif',
      jakarta: '"Plus Jakarta Sans", "Inter", sans-serif',
      serif: '"Playfair Display", Georgia, serif',
      mono: '"JetBrains Mono", SFMono-Regular, monospace'
    };
    root.style.setProperty('--font-sans', fontMap[fontFamily] || fontMap.system);

    // Apply Accent Color Palette
    const accentMap: Record<string, { brass: string; soft: string; line: string }> = {
      emerald: { brass: '#D6A852', soft: 'rgba(214, 168, 82, 0.14)', line: 'rgba(214, 168, 82, 0.4)' },
      indigo: { brass: '#6366F1', soft: 'rgba(99, 102, 241, 0.14)', line: 'rgba(99, 102, 241, 0.4)' },
      amber: { brass: '#F59E0B', soft: 'rgba(245, 158, 11, 0.14)', line: 'rgba(245, 158, 11, 0.4)' },
      teal: { brass: '#14B8A6', soft: 'rgba(20, 184, 166, 0.14)', line: 'rgba(20, 184, 166, 0.4)' },
      violet: { brass: '#A855F7', soft: 'rgba(168, 85, 247, 0.14)', line: 'rgba(168, 85, 247, 0.4)' },
      rose: { brass: '#F43F5E', soft: 'rgba(244, 63, 94, 0.14)', line: 'rgba(244, 63, 94, 0.4)' },
      slate: { brass: '#94A3B8', soft: 'rgba(148, 163, 184, 0.14)', line: 'rgba(148, 163, 184, 0.4)' }
    };
    const palette = accentMap[accentColor] || accentMap.emerald;
    root.style.setProperty('--brass', palette.brass);
    root.style.setProperty('--brass-soft', palette.soft);
    root.style.setProperty('--brass-line', palette.line);

    // High Contrast & Row Density
    if (highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    if (reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    root.setAttribute('data-density', rowDensity);
  }, [theme, fontSizeScale, fontFamily, accentColor, highContrast, rowDensity, reduceMotion]);
  const isQuietMode = useUIStore(state => state.isQuietMode);

  useEffect(() => {
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = 'en';
  }, []);
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
    isShortcutOverlayOpen, isArchitectureOpen, speedDials, navigateTool,
    handleAction, setActiveTab, setArchitectureOpen, setCommandPaletteOpen,
    setDiagnosticConsoleOpen, setImporterOpen, setQuickEntryOpen,
    setShortcutOverlayOpen, toggleFocusMode
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


  const isGuest = useAuthStore(state => state.isGuest);
  const setIsGuest = useAuthStore(state => state.setIsGuest);

  const handleGuest = () => {
    setIsGuest(true);
    toast.info('Entered Guest Mode');
  };



  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    localStorage.removeItem('ledgerflow_use_sandbox_mode');
    localStorage.removeItem('ledgerflow_identity_email');
    localStorage.removeItem('ledgerflow_identity_name');
    
    try {
      await signInWithPopup(auth, provider);
      setIsGuest(false);
      toast.success('SUCCESSFULLY LOGGED IN WITH GOOGLE');
    } catch (e) {
      console.error("Google Sign-In failed:", e);
      toast.error('Google Sign-In failed or was cancelled.');
    }
  };

  const handleEmailSignup = async (email: string, pass: string) => {
    localStorage.removeItem('ledgerflow_use_sandbox_mode');
    localStorage.removeItem('ledgerflow_identity_email');
    localStorage.removeItem('ledgerflow_identity_name');
    
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await sendEmailVerification(cred.user);
      setIsGuest(false);
      toast.success('Account created! Please check your email for a verification link.');
    } catch (e: any) {
      console.error("Signup failed:", e);
      toast.error(e.message || 'Signup failed');
      throw e;
    }
  };

  const handlePasswordReset = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent! Please check your inbox.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to send reset email');
    }
  };

  const handleEmailLogin = async (email: string, pass: string) => {
    localStorage.removeItem('ledgerflow_use_sandbox_mode');
    localStorage.removeItem('ledgerflow_identity_email');
    localStorage.removeItem('ledgerflow_identity_name');
    
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setIsGuest(false);
      toast.success('SUCCESSFULLY LOGGED IN');
    } catch (e: any) {
      console.error("Login failed:", e);
      toast.error('Login failed: ' + e.message);
      throw e;
    }
  };

  

  

  

  

  



  
  const isPublicInvoice = window.location.pathname.startsWith('/i/');
  if (isPublicInvoice) {
    return <PublicInvoicePage />;
  }

  const isInviteRoute = window.location.pathname.startsWith('/invite/');
  if (isInviteRoute) {
    return (
      <Suspense fallback={<InitializationScreen language={language} />}>
        <RootLayout />
      </Suspense>
    );
  }

  if (isInitializing) {
    return <InitializationScreen language={language} />;
  }

  if (!user && !isGuest) {
    return <AuthScreen onLogin={handleLogin} onEmailLogin={handleEmailLogin} onEmailSignup={handleEmailSignup} onPasswordReset={handlePasswordReset} onGuest={handleGuest} language={language} />;
  }

  return (
    <FallbackBoundary>
      <div dir="ltr" className="h-[100dvh] w-full bg-[var(--ink)] overflow-hidden flex flex-col font-sans text-[var(--text)]">
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
        <RootLayout />
        <CookieConsent onOpenPrivacyPolicy={() => { setLegalModalTab('privacy'); setIsLegalModalOpen(true); }} />
        <LegalModal isOpen={isLegalModalOpen} onClose={() => setIsLegalModalOpen(false)} initialTab={legalModalTab} />
      </div>
    </FallbackBoundary>
  );
}