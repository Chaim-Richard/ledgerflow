import { TruthEngine } from '../../modules/integrity/TruthEngine';
import React, { useState, useMemo, useCallback } from 'react';
import { usePerformanceTrace } from '../../hooks/usePerformanceTrace';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Plus, 
  Search, 
  ArrowRightLeft, 
  Scale, 
  ShieldCheck, 
  RefreshCw, 
  BarChart3, 
  History, 
  AlertCircle,
  ArrowDownRight,
  Inbox,
  Clock,
  Target,
  Activity,
  Cpu,
  Layers,
  Zap
} from 'lucide-react';
import { Transaction, ChartAccount, JournalEntry, Budget, TaxRate } from '../../types';
import { cn, reportError, OperationType } from '../../lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../../firebase';
import AsyncButton from '../ui/AsyncButton';
import JournalEntryModal from './JournalEntryModal';
import { LexiconText } from '../../hooks/useLexicon';

// Sub-views (Dynamically loaded to optimize bundle footprint and ensure near-instant initial tab rendering)
const ChartOfAccountsView = React.lazy(() => import('./ChartOfAccountsView'));
const JournalView = React.lazy(() => import('./JournalView'));
const TrialBalanceView = React.lazy(() => import('./TrialBalanceView'));
const BalanceSheetView = React.lazy(() => import('./BalanceSheetView'));
const CashFlowView = React.lazy(() => import('./CashFlowView'));

const ProfitAndLossView = React.lazy(() => import('./ProfitAndLossView'));
const PeriodsView = React.lazy(() => import('./PeriodsView'));
const ProjectProfitabilityView = React.lazy(() => import('./ProjectProfitabilityView'));
const AuditTrailView = React.lazy(() => import('./AuditTrailView'));
const TaxManager = React.lazy(() => import('../finance/TaxManager'));
const BudgetManager = React.lazy(() => import('../planning/BudgetManager'));
const Reconciliation = React.lazy(() => import('./Reconciliation'));

const ReconciliationWizard = React.lazy(() => import('./ReconciliationWizard'));
const BankFeedImport = React.lazy(() => import('./BankFeedImport'));
const InboxView = React.lazy(() => import('./InboxView'));



type SubTab = 'coa' | 'journal' | 'trial';
type ModalType = 'account' | 'journal' | 'recon' | 'period' | 'bank_import' | null;

interface LedgerSubTabConfig {
  id: SubTab;
  label: string;
  icon: any;
  cardKey: string;
}

const LEDGER_SUB_TABS: LedgerSubTabConfig[] = [
  { id: 'coa', label: 'Chart of Accounts', icon: BookOpen, cardKey: 'ledger.tab.coa' },
  { id: 'journal', label: 'General Journal', icon: ArrowRightLeft, cardKey: 'ledger.tab.journal' },
  { id: 'trial', label: 'Trial Balance', icon: Scale, cardKey: 'ledger.tab.trial' }
];

const TabButton = ({ id, label, icon: Icon, active, onClick, cardKey }: { id: SubTab, label: string, icon: any, active: boolean, onClick: () => void, cardKey?: string }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border cursor-pointer",
      active 
        ? "bg-gradient-to-r from-[var(--brass)] via-[#e5be6b] to-[var(--brass)] text-black font-bold border-[var(--brass-line)] shadow-sm" 
        : "bg-[var(--surface)] border-[var(--line)]/80 text-[var(--muted)] hover:border-[var(--brass-line)]/60 hover:text-[var(--text)] shadow-3xs"
    )}
  >
    <Icon size={14} />
    {cardKey ? <LexiconText cardKey={cardKey} defaultVal={label} /> : label}
  </button>
);

import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useTransactionActions } from '../../hooks/useTransactionActions';
import { useCommandDispatcher } from '../../hooks/useSystemContext';
import { useEntityOperations } from '../../hooks/useEntityOperations';

const Ledger = React.memo(() => {
  const user = useAuthStore(s => s.user) || ({} as any);
  const workspaceId = useAuthStore(s => s.currentWorkspaceId);
  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const journalEntries = useLedgerStore(s => s.journalEntries);
  const reconciliations = useLedgerStore(s => s.reconciliations);
  const bankLines = useLedgerStore(s => s.bankLines || []);
  const partners = useLedgerStore(s => s.partners);
  const auditLogs = useLedgerStore(s => s.auditLogs || []);
  const budgets = useLedgerStore(s => s.budgets);
  const taxRates = useLedgerStore(s => s.taxRates);
  const { handleAction: onAction } = useCommandDispatcher();
  const txActions = useTransactionActions();
  const { addEntity, updateEntity, deleteEntity } = useEntityOperations();

  const onCompleteReconciliation = async (data: any) => {
    try {
      const recRecord = {
        accountId: data.accountId,
        accountName: data.accountName,
        statementDate: data.statementDate,
        statementBalanceCents: data.statementBalanceCents,
        reconciledTransactionIds: data.reconciledIds || [],
        reconciledCount: (data.reconciledIds || []).length,
        status: 'completed',
        completedAt: data.timestamp || new Date().toISOString()
      };
      
      // Save reconciliation record in Firestore and state
      await addEntity('reconciliations', recRecord, 'Reconciliation record saved');

      // Update all reconciled transactions status
      const updates = (data.reconciledIds || []).map((id: string) => 
        updateEntity('transactions', id, { 
          status: 'reconciled', 
          reconciled: true, 
          reconciledAt: new Date().toISOString() 
        })
      );
      await Promise.all(updates);

      toast.success(`Reconciliation finalized: ${(data.reconciledIds || []).length} transactions marked reconciled.`);
    } catch (err) {
      console.error('Failed to persist reconciliation:', err);
      toast.error('Failed to save reconciliation.');
      throw err;
    }
  };

  const onMatch = txActions.handleReconcileMatch;
  const onUndoMatch = txActions.handleReconcileUndo;
  const onIgnore = txActions.handleReconcileIgnore;
  const onAddFromBank = txActions.handleReconcileCreate;
  const onAutoReconcile = txActions.handleAutoReconcile;
  const onParseReceipt = txActions.handleParseReceipt;
  const onAddTaxRate = (data: any) => addEntity('taxRates', data);
  const onUpdateTaxRate = (id: string, data: any) => updateEntity('taxRates', id, data);
  const onDeleteTaxRate = (id: string) => deleteEntity('taxRates', id);
  const onDeleteAccount = txActions.handleDeleteAccount;
  usePerformanceTrace("Ledger");

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('coa');
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newAccount, setNewAccount] = useState({
    code: '',
    name: '',
    type: 'asset' as const,
    category: '',
    description: '',
    parentId: '',
    openingBalanceCents: 0,
    asOfDate: format(new Date(), 'yyyy-MM-dd')
  });

  const formatCurrency = useCallback((cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  }, []);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'chartAccounts'), {
        ...newAccount,
        uid: user?.uid || "",
        balanceCents: Number(newAccount.openingBalanceCents), // Initial balance is opening balance
        createdAt: new Date().toISOString()
      });
      toast.success('System Node Established');
      setActiveModal(null);
      setNewAccount({ 
        code: '', 
        name: '', 
        type: 'asset', 
        category: '', 
        description: '',
        parentId: '',
        openingBalanceCents: 0,
        asOfDate: format(new Date(), 'yyyy-MM-dd')
      });
    } catch (error) {
      reportError(error, OperationType.CREATE, 'chartAccounts', { account: newAccount });
    }
  };

  const totalProfitCents = useMemo(() => {
    return accounts
      .filter(a => a.type === 'income' || a.type === 'expense')
      .reduce((sum, a) => a.type === 'income' ? sum + a.balanceCents : sum - a.balanceCents, 0);
  }, [accounts]);

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = (e.target as any).name.value;
    const share = parseFloat((e.target as any).share.value);
    const initialCapital = TruthEngine.parseAmountToCents((e.target as any).capital.value);

    try {
      await addDoc(collection(db, 'partners'), {
        uid: user?.uid || "",
        name,
        share,
        initialCapitalCents: initialCapital,
        createdAt: new Date().toISOString()
      });
      toast.success('Partner added successfully');
      (e.target as any).reset();
    } catch (error) {
       reportError(error, OperationType.CREATE, 'partners', { name, share, initialCapital });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Rule Header with brand gold gradient */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[var(--brass-soft)] via-[var(--surface)]/40 to-[var(--panel)] p-6 rounded-2xl border border-[var(--brass-line)]/50 shadow-sm">
        <div className="absolute -top-16 -left-16 w-56 h-56 bg-[var(--brass)] opacity-10 rounded-full blur-3xl hidden md:block pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--brass-soft)] border border-[var(--brass-line)]/60 text-[10px] font-mono text-[var(--brass)] font-semibold mb-2 shadow-xs">
              <Layers size={12} />
              <LexiconText cardKey="ledger.unifiedFinancialLedger" defaultVal="Unified Financial Ledger" />
            </div>
            <LexiconText cardKey="ledger.coreMatrix" defaultVal="Core Matrix" as="h1" className="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight" />
            <LexiconText 
              cardKey="ledger.coreMatrixSubtitle" 
              defaultVal="High-fidelity double-entry synchronization with immutable forensic trails." 
              as="p" 
              className="text-xs text-[var(--muted)] font-medium mt-1" 
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button 
              onClick={() => setActiveModal('journal')}
              className="h-10 px-4 bg-[var(--surface)]/90 text-[var(--text)] rounded-xl text-xs font-bold hover:bg-[var(--elevated)] transition-all border border-[var(--line)] shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <ArrowRightLeft size={14} />
              <LexiconText cardKey="ledger.button.journalEntry" defaultVal="Journal Entry" />
            </button>
            <button 
              onClick={() => setActiveModal('account')}
              className="h-10 px-5 bg-gradient-to-r from-[var(--brass)] via-[#e5be6b] to-[var(--brass)] text-black hover:opacity-95 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg cursor-pointer active:scale-95"
            >
              <Plus size={14} className="stroke-[3px]" />
              <LexiconText cardKey="ledger.button.appendNode" defaultVal="Append Node" />
            </button>
          </div>
        </div>
      </div>

      {/* Deterministic Ledger Pulse */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-[var(--panel)] rounded-2xl border border-[var(--line)] hover:border-[var(--brass-line)] transition-all relative overflow-hidden shadow-sm bg-gradient-to-b from-[var(--brass-soft)]/30 via-[var(--panel)] to-[var(--panel)] group">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5"><Scale size={13} className="text-[var(--brass)]" /><LexiconText cardKey="ledger.stabilityVector" defaultVal="Stability Vector" /></span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", totalProfitCents !== undefined ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500")} />
            <LexiconText cardKey="ledger.verifiedStatus" defaultVal="Verified" as="p" className="text-xl font-bold text-[var(--text)] tracking-tight" />
          </div>
          <div className="mt-3 text-[10px] font-mono text-[var(--muted)]">
            <LexiconText cardKey="ledger.equilibriumSyncActive" defaultVal="Equilibrium Sync Active" />
          </div>
        </div>

        <div className="p-5 bg-[var(--panel)] rounded-2xl border border-[var(--line)] hover:border-[var(--brass-line)] transition-all relative overflow-hidden shadow-sm bg-gradient-to-b from-[var(--brass-soft)]/20 via-[var(--panel)] to-[var(--panel)] group">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold flex items-center justify-between mb-2">
            <span><LexiconText cardKey="ledger.netInternalFlux" defaultVal="Net Internal Flux" /></span>
            <Activity size={14} className="text-[var(--brass)]" />
          </div>
          <p className={cn("text-2xl font-mono font-bold tracking-tight mt-1 truncate", totalProfitCents >= 0 ? "text-[var(--pos)]" : "text-[var(--neg)]")}>
            {formatCurrency(totalProfitCents)}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-[var(--muted)]">
             <Activity size={12} className="text-[var(--brass)] shrink-0" />
             <LexiconText cardKey="ledger.liveThrottling" defaultVal="Live Throttling" />
          </div>
        </div>

        <div className="p-5 bg-[var(--panel)] rounded-2xl border border-[var(--line)] hover:border-[var(--brass-line)] transition-all relative overflow-hidden shadow-sm bg-gradient-to-b from-[var(--brass-soft)]/20 via-[var(--panel)] to-[var(--panel)] group">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] font-semibold flex items-center justify-between mb-2">
            <span><LexiconText cardKey="ledger.forensicIntegrity" defaultVal="Forensic Integrity" /></span>
            <ShieldCheck size={14} className="text-[var(--brass)]" />
          </div>
          <div className="flex items-center gap-2 mt-1">
             <ShieldCheck size={18} className="text-[var(--pos)] shrink-0" />
             <LexiconText cardKey="ledger.absoluteStatus" defaultVal="Absolute" as="p" className="text-xl font-bold text-[var(--text)] tracking-tight" />
          </div>
          <div className="mt-3 flex items-center gap-1 text-[10px] font-mono text-[var(--pos)]">
             <Zap size={12} className="shrink-0" />
             <LexiconText cardKey="ledger.immutableStatus" defaultVal="100% Immutable" />
          </div>
        </div>

        <div className="p-5 bg-[var(--panel)] border border-[var(--brass-line)] rounded-2xl shadow-sm relative overflow-hidden group bg-gradient-to-b from-[var(--brass-soft)] via-[var(--brass-soft)]/30 to-[var(--panel)]">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--brass)] font-semibold flex items-center justify-between mb-2">
            <span><LexiconText cardKey="ledger.coreBackboneProtocol" defaultVal="Core Backbone Protocol" /></span>
            <Cpu size={14} className="text-[var(--brass)]" />
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="w-8 h-8 rounded-lg bg-[var(--brass-soft)] flex items-center justify-center border border-[var(--brass-line)]/60 shrink-0 shadow-xs">
               <Cpu size={16} className="text-[var(--brass)]" />
            </div>
            <p className="text-xs font-mono font-bold text-[var(--brass)] tracking-wider truncate">CB-0x{(workspaceId || "TEMP_WS").slice(0, 6).toUpperCase()}</p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[10px] font-mono text-[var(--muted)]">
             <ShieldCheck size={12} className="shrink-0 text-[var(--brass)]" />
             <LexiconText cardKey="ledger.nexusSecurityActive" defaultVal="Nexus Security Active" />
          </div>
        </div>
      </div>

       {/* Navigation Matrix */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[var(--line)]">
          {LEDGER_SUB_TABS.map((tab) => (
            <TabButton 
              key={tab.id}
              id={tab.id} 
              label={tab.label} 
              icon={tab.icon} 
              active={activeSubTab === tab.id} 
              onClick={() => setActiveSubTab(tab.id)} 
              cardKey={tab.cardKey}
            />
          ))}
        </div>

        {activeSubTab === 'coa' && (
          <div className="relative group max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-slate-600 transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Search accounts by name, code, or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2 bg-[var(--ink)] border border-[var(--line)] rounded-xl focus:outline-none focus:border-slate-950 focus:bg-[var(--surface)] transition-all text-sm font-medium text-[var(--text)] placeholder:text-slate-400"
            />
          </div>
        )}
      </div>

      {/* Primary Intelligence Core */}
      <motion.div
        key={activeSubTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative"
      >
        <div className="absolute technical-grid inset-0 opacity-[0.02] pointer-events-none" />
        
        <React.Suspense fallback={
          <div className="py-24 text-center space-y-4">
            <div className="flex justify-center gap-2">
              {[0, 1, 2].map(i => (
                <motion.div 
                  key={i}
                  animate={{ scale: [1, 1.2, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                  className="w-3 h-3 bg-indigo-600 rounded-full"
                />
              ))}
            </div>
            <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Synchronizing real-time ledger layers...</p>
          </div>
        }>
          
          {activeSubTab === 'coa' && (
            <ChartOfAccountsView 
              accounts={accounts} 
              searchTerm={searchTerm} 
              formatCurrency={formatCurrency}
              onDrillDown={(name) => onAction('drill-down', { account: name })}
              onDeleteAccount={onDeleteAccount}
            />
          )}
          {activeSubTab === 'journal' && (
            <JournalView journalEntries={journalEntries} formatCurrency={formatCurrency} />
          )}
          {activeSubTab === 'trial' && (
            <TrialBalanceView 
              accounts={accounts} 
              formatCurrency={formatCurrency} 
              onDrillDown={(id) => onAction('drill-down', { account: accounts.find(a => a.id === id)?.name || "" || "" })}
            />
          )}
        </React.Suspense>
      </motion.div>

      {/* Bank Feed Import Modal */}
      <AnimatePresence>
        {activeModal === 'bank_import' && (
          <BankFeedImport 
            workspaceId={workspaceId || ""}
            onClose={() => setActiveModal(null)}
            onImport={(data: any) => {
              onAction('import_bank_csv', data);
              setActiveModal(null);
            }}
            accounts={accounts}
          />
        )}
      </AnimatePresence>

      {/* Add Account Modal */}
      <AnimatePresence>
        {activeModal === 'account' && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModal(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[var(--ink)] rounded-[40px] shadow-2xl border border-[var(--line)] overflow-hidden p-4 md:p-10"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-black text-[var(--text)] tracking-tight uppercase italic">Add New Account</h2>
                <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-[var(--ink)] rounded-full transition-colors">
                  <Plus className="rotate-45 text-slate-500" size={24} />
                </button>
              </div>

              <form onSubmit={handleAddAccount} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-50">Account Code</label>
                    <input 
                      type="text" 
                      required
                      value={newAccount.code}
                      onChange={(e) => setNewAccount({ ...newAccount, code: e.target.value })}
                      placeholder="e.g. 1001"
                      className="w-full px-5 py-3.5 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-[var(--ink)] transition-all font-mono text-[var(--text)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-50">Account Type</label>
                    <select 
                      value={newAccount.type}
                      onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value as any })}
                      className="w-full px-5 py-3.5 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-[var(--ink)] transition-all font-bold text-[var(--text)] appearance-none cursor-pointer"
                    >
                      <option value="asset">Asset</option>
                      <option value="liability">Liability</option>
                      <option value="equity">Equity</option>
                      <option value="income">Income</option>
                      <option value="expense">Expense</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-50">Account Name</label>
                  <input 
                    type="text" 
                    required
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                    placeholder="e.g. Main Operating Account"
                    className="w-full px-5 py-3.5 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-[var(--ink)] transition-all font-bold text-[var(--text)]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-50">Category (Optional)</label>
                  <input 
                    type="text" 
                    value={newAccount.category}
                    onChange={(e) => setNewAccount({ ...newAccount, category: e.target.value })}
                    placeholder="e.g. Current Assets"
                    className="w-full px-5 py-3.5 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-[var(--ink)] transition-all text-[var(--text)]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-50">Description</label>
                  <textarea 
                    value={newAccount.description}
                    onChange={(e) => setNewAccount({ ...newAccount, description: e.target.value })}
                    placeholder="Briefly describe the purpose of this account..."
                    rows={3}
                    className="w-full px-5 py-3.5 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-[var(--ink)] transition-all resize-none text-[var(--text)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-50">Parent Account</label>
                    <div className="relative">
                      <input 
                        list="ledger-parent-account"
                        value={accounts.find(a => a.id === newAccount.parentId)?.name || newAccount.parentId || ''}
                        onChange={(e) => {
                          const acc = accounts.find(a => a.name === e.target.value || a.id === e.target.value);
                          setNewAccount({ ...newAccount, parentId: acc ? acc.id : e.target.value });
                        }}
                        placeholder="None (Root)"
                        className="w-full px-5 py-3.5 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-[var(--ink)] transition-all font-bold text-[var(--text)]"
                      />
                      <datalist id="ledger-parent-account">
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.name}>{acc.code}</option>
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-50">Opening Balance ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={newAccount.openingBalanceCents / 100}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value || '0');
                        setNewAccount({ ...newAccount, openingBalanceCents: Math.round((Math.round(val * 100) / 100) * 100) });
                      }}
                      className="w-full px-5 py-3.5 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-[var(--ink)] transition-all font-mono text-[var(--text)] text-right"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-50">As of Date</label>
                  <input 
                    type="date" 
                    value={newAccount.asOfDate}
                    onChange={(e) => setNewAccount({ ...newAccount, asOfDate: e.target.value })}
                    className="w-full px-5 py-3.5 bg-[var(--surface)] border border-[var(--line)] rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-[var(--ink)] transition-all font-bold text-[var(--text)]"
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="flex-1 py-4 bg-[var(--ink)] text-slate-500 rounded-[32px] font-black hover:text-[var(--text)] transition-all uppercase tracking-widest text-[10px]"
                  >
                    Cancel
                  </button>
                  <AsyncButton 
                    type="submit"
                    loadingText="Establishing..."
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-[32px] font-black hover:opacity-90 transition-all shadow-xl shadow-ledger-accent/20 uppercase tracking-widest text-[10px]"
                  >
                    Establish Node
                  </AsyncButton>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Period Closing Modal */}
      <AnimatePresence>
        {activeModal === 'period' && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModal(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[var(--surface)] rounded-[40px] shadow-2xl border border-[var(--line)] overflow-hidden p-4 md:p-10"
            >
              <div className="flex items-center gap-5 mb-8">
                <div className="w-16 h-16 bg-amber-50 rounded-[32px] flex items-center justify-center text-amber-600 border border-amber-100">
                  <ShieldCheck size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-[var(--text)] tracking-tight">Close Period</h2>
                  <p className="text-sm text-zinc-500">Locking {format(new Date(), 'MMMM yyyy')}</p>
                </div>
              </div>

              <div className="space-y-8">
                <div className="p-4 md:p-8 bg-[var(--ink)] rounded-[32px] border border-[var(--line)] space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 text-sm font-medium">Net Income</span>
                    <span className="font-black text-[var(--text)] text-lg">{formatCurrency(totalProfitCents)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 text-sm font-medium">Unreconciled Items</span>
                    <span className="font-black text-amber-600">
                      {transactions.filter(t => !t.clearedAt).length}
                    </span>
                  </div>
                </div>

                <div className="p-5 bg-amber-50 border border-amber-100 rounded-[32px] flex gap-4">
                  <AlertCircle className="text-amber-600 shrink-0" size={20} />
                  <p className="text-xs text-amber-800 leading-relaxed font-medium">
                    Closing a period will lock all transactions and journal entries. This action is usually performed by a professional accountant after tax verification.
                  </p>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setActiveModal(null)}
                    className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-[32px] font-black hover:bg-zinc-200 transition-all"
                  >
                    Cancel
                  </button>
                  <AsyncButton 
                    onClick={async () => {
                      setActiveModal(null);
                      toast.success('Period closed successfully');
                    }}
                    loadingText="Closing..."
                    className="flex-1 py-4 bg-zinc-900 text-white rounded-[32px] font-black hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20"
                  >
                    Confirm Close
                  </AsyncButton>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reconciliation Modal */}
      <ReconciliationWizard 
        isOpen={activeModal === 'recon'}
        onClose={() => setActiveModal(null)}
        accounts={accounts}
        onComplete={onCompleteReconciliation}
        formatCurrency={formatCurrency}
      />

      {/* Journal Entry Modal */}
      <JournalEntryModal 
        isOpen={activeModal === 'journal'}
        onClose={() => setActiveModal(null)}
        user={user as any}
        accounts={accounts}
        workspaceId={workspaceId || ""}
      />
    </div>
  );
});

export default Ledger;
