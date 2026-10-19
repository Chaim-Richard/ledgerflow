import { useState } from 'react';
import NeedsAttentionCard from './dashboard/NeedsAttentionCard';
import { Plus, CheckCircle2, Layers, UploadCloud, Sparkles, X } from 'lucide-react';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useUIStore } from '../stores/useUIStore';
import { useAuthStore } from '../stores/useAuthStore';
import { TaxReserveWidget } from './finance/TaxReserveWidget';
import OnboardingView from './onboarding/OnboardingView';
import SetupWizard from './onboarding/SetupWizard';
import { useDataNeedsStore } from '../stores/useDataNeedsStore';
import { LoadingState } from './ui/LoadingState';
import SavedViewsBar from './ui/SavedViewsBar';
import { cn } from '../lib/utils';
import DashboardWidgets from './dashboard/DashboardWidgets';

import { useShallow } from 'zustand/react/shallow';
import SinceLastVisitCard from './SinceLastVisitCard';
import GuestCountrySamplePicker from './onboarding/GuestCountrySamplePicker';

export default function Dashboard() {
  const { 
    rawTransactions, 
    accounts
  } = useLedgerStore(useShallow(s => ({
    rawTransactions: s.transactions,
    accounts: s.accounts,
  })));
  const setQuickEntryOpen = useUIStore(s => s.setQuickEntryOpen);
  const setTemplateSelectorOpen = useUIStore(s => s.setTemplateSelectorOpen);
  const setActiveTab = useUIStore(s => s.setActiveTab);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const workspaces = useAuthStore(s => s.workspaces);

  // Setup completion criteria:
  // Brand new workspace has 0 transactions AND 0 accounts.
  const isCompletelyEmpty = rawTransactions.length === 0 && accounts.length === 0;
  // First-run setup (L-19): a signed-in workspace not set up yet and without entries (once its
  // entries have loaded). The wizard stays until finished, even after it posts the first entry.
  const isGuest = useAuthStore(s => s.isGuest);
  const signedInUser = useAuthStore(s => s.user);
  const transactionsLoaded = useDataNeedsStore(s => Boolean(s.loaded.transactions));
  const accountsLoaded = useDataNeedsStore(s => Boolean(s.loaded.accounts));
  const loadedWorkspaceId = useDataNeedsStore(s => s.loadedWorkspaceId);
  const loadFailure = useDataNeedsStore(s => s.failed.transactions || s.failed.accounts);
  const workspaceForSetup = workspaces.find(w => w.id === currentWorkspaceId);
  const needsSetup = !isGuest && Boolean(workspaceForSetup) && !workspaceForSetup?.setupCompletedAt && rawTransactions.length === 0;
  // Setup activity belongs to one workspace. Switching books must not reuse another draft.
  const [setupStartedFor, setSetupStartedFor] = useState<string | null>(null);
  const [setupClosedFor, setSetupClosedFor] = useState<string | null>(null);
  const setupStarted = Boolean(currentWorkspaceId && setupStartedFor === currentWorkspaceId);
  const setupClosed = Boolean(currentWorkspaceId && setupClosedFor === currentWorkspaceId);

  // Lens state: 'owner' vs 'accountant'
  const [lens, setLens] = useState<'owner' | 'accountant'>('owner');

  // Track setup checklist banner dismissal in localStorage
  const [isChecklistDismissed, setIsChecklistDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`lf_checklist_dismissed_${currentWorkspaceId}`) === 'true';
    } catch {
      return false;
    }
  });

  const dismissChecklist = () => {
    setIsChecklistDismissed(true);
    try {
      if (currentWorkspaceId) {
        localStorage.setItem(`lf_checklist_dismissed_${currentWorkspaceId}`, 'true');
      }
    } catch {
      // ignore
    }
  };

  // Setup steps status
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);
  const hasSelectedTemplate = Boolean(currentWorkspace?.businessType && currentWorkspace.businessType !== 'custom');
  const hasAccounts = accounts.length > 0;
  const hasTransactions = rawTransactions.length > 0;
  const setupStepCount = [hasSelectedTemplate, hasAccounts, hasTransactions].filter(Boolean).length;
  const isSetupIncomplete = setupStepCount < 3 && !isChecklistDismissed;

  // Never interpret a cleared cache or an old workspace's ready flags as a new set of books.
  // Wait for the actual workspace and both core snapshots before choosing the first-run screen.
  if (!isGuest && !setupStarted && (
    !workspaceForSetup || loadedWorkspaceId !== currentWorkspaceId || !transactionsLoaded || !accountsLoaded
  )) {
    return loadFailure && loadedWorkspaceId === currentWorkspaceId
      ? <div role="alert" className="p-8 text-center text-sm text-[var(--text)]">Could not load your books. Use Data Status to retry the failed collection.</div>
      : <LoadingState what="your books" />;
  }

  if ((needsSetup || setupStarted) && !setupClosed) {
    return <SetupWizard onStarted={() => setSetupStartedFor(currentWorkspaceId)} onDone={() => setSetupClosedFor(currentWorkspaceId)} />;
  }

  // Only guest/demo books show the generic welcome screen. Signed-in workspaces use
  // their persisted setupCompletedAt and do not become 'new' when their history is empty.
  if (isGuest && isCompletelyEmpty) {
    return <OnboardingView />;
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1360px] mx-auto text-[var(--text)]">
      <SinceLastVisitCard />
      {isGuest && !signedInUser && <GuestCountrySamplePicker />}
      {/* DA-02: one queue of what needs doing */}
      <NeedsAttentionCard />

      {/* Header section with lens selector and subtle gold gradient backdrop */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[var(--brass-soft)] via-[var(--surface)]/40 to-[var(--panel)] p-6 rounded-2xl border border-[var(--brass-line)]/50 shadow-sm">
        {/* Subtle radial ambient glow */}
        <div className="absolute -top-16 -left-16 w-56 h-56 bg-[var(--brass)] opacity-10 rounded-full blur-3xl hidden md:block pointer-events-none" />
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-[var(--brass-soft)]/20 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--brass-soft)] border border-[var(--brass-line)]/60 text-[11px] font-mono text-[var(--brass)] font-semibold mb-2 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brass)] animate-pulse" />
              FINANCIAL COMMAND CENTER
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {lens === 'owner' ? 'Real-Time Financial Ledger' : 'Consolidated Double-Entry Trial Balance'}
            </h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Connected to live store —{' '}
              <span className="text-[var(--brass)] font-medium">
                {lens === 'owner' ? 'owner perspective on assets, cash & net worth.' : 'audit-ready debits and credits.'}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center bg-[var(--surface)]/80 border border-[var(--line)] rounded-xl p-1 text-xs font-medium shadow-inner backdrop-blur-sm">
              <button
                onClick={() => setLens('owner')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg transition-all cursor-pointer",
                  lens === 'owner' 
                    ? "bg-gradient-to-r from-[var(--brass)] to-[#e5be6b] text-black font-semibold shadow-sm" 
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                Owner Lens
              </button>
              <button
                onClick={() => setLens('accountant')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg transition-all cursor-pointer",
                  lens === 'accountant' 
                    ? "bg-gradient-to-r from-[var(--brass)] to-[#e5be6b] text-black font-semibold shadow-sm" 
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                Accountant Lens
              </button>
            </div>

            <button
              onClick={() => setQuickEntryOpen(true)}
              className="flex items-center gap-1.5 bg-gradient-to-r from-[var(--brass)] via-[#e5be6b] to-[var(--brass)] hover:opacity-95 text-black px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md hover:shadow-lg cursor-pointer active:scale-95"
            >
              <Plus size={15} />
              Add Entry
            </button>
          </div>
        </div>
      </div>

      {/* Setup Checklist Guidance Banner (when setup is incomplete) */}
      {isSetupIncomplete && (
        <div className="bg-gradient-to-r from-[var(--brass-soft)] via-[var(--panel)] to-[var(--surface)] border border-[var(--brass-line)] rounded-2xl p-4 sm:p-5 relative shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider bg-[var(--brass)] text-[var(--ink)] px-2 py-0.5 rounded-md font-bold">
                  Setup Progress ({setupStepCount}/3)
                </span>
                <h2 className="text-sm font-semibold text-[var(--text)]">Workspace Setup Checklist</h2>
              </div>
              <p className="text-xs text-[var(--muted)]">
                Ensure your chart of accounts and transactions are configured for complete algorithmic accuracy.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissChecklist}
              className="text-[var(--muted)] hover:text-[var(--text)] p-1 rounded-lg hover:bg-[var(--surface)] transition-colors cursor-pointer"
              title="Dismiss checklist"
             aria-label="Dismiss checklist">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            {/* Step 1: Chart Template */}
            <button
              type="button"
              onClick={() => setTemplateSelectorOpen(true)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer",
                hasAccounts
                  ? "bg-[var(--surface)]/80 border-[var(--brass-line)]/50"
                  : "bg-[var(--panel)] border-[var(--brass-line)] hover:border-[var(--brass)]"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                hasAccounts ? "bg-emerald-500/10 text-emerald-500" : "bg-[var(--brass)]/10 text-[var(--brass)]"
              )}>
                {hasAccounts ? <CheckCircle2 size={16} /> : <Layers size={16} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text)] truncate">1. Chart Template</p>
                <p className="text-[10px] text-[var(--muted)] truncate">
                  {hasAccounts ? `${accounts.length} accounts configured` : 'Select industry COA'}
                </p>
              </div>
            </button>

            {/* Step 2: Bank Lines / Import */}
            <button
              type="button"
              onClick={() => setActiveTab('banking')}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer",
                hasTransactions
                  ? "bg-[var(--surface)]/80 border-[var(--brass-line)]/50"
                  : "bg-[var(--panel)] border-[var(--line)] hover:border-[var(--brass-line)]"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                hasTransactions ? "bg-emerald-500/10 text-emerald-500" : "bg-indigo-500/10 text-indigo-500"
              )}>
                {hasTransactions ? <CheckCircle2 size={16} /> : <UploadCloud size={16} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text)] truncate">2. Import History</p>
                <p className="text-[10px] text-[var(--muted)] truncate">
                  {hasTransactions ? `${rawTransactions.length} entries recorded` : 'Connect bank or CSV'}
                </p>
              </div>
            </button>

            {/* Step 3: Recon / First Entry */}
            <button
              type="button"
              onClick={() => hasTransactions ? setActiveTab('reconciliation') : setQuickEntryOpen(true)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer",
                hasTransactions
                  ? "bg-[var(--surface)]/80 border-[var(--brass-line)]/50"
                  : "bg-[var(--panel)] border-[var(--line)] hover:border-[var(--brass-line)]"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                hasTransactions ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
              )}>
                {hasTransactions ? <CheckCircle2 size={16} /> : <Sparkles size={16} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text)] truncate">3. Reconcile & Verify</p>
                <p className="text-[10px] text-[var(--muted)] truncate">
                  {hasTransactions ? 'Verify balances & rules' : 'Record manual entry'}
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Saved Views & Default Lenses Bar */}
      <SavedViewsBar />

      <DashboardWidgets />
      <details className="border border-[var(--line)] rounded-xl p-4"><summary className="min-h-11 flex items-center cursor-pointer font-semibold">Live tax and spending planning</summary><p className="text-sm text-[var(--muted)] mb-3">This planner uses current cash and future assumptions independently of the dashboard reporting dates.</p><TaxReserveWidget /></details>
    </div>
  );
}
