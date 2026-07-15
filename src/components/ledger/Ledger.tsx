import { TruthEngine } from '../../modules/truth/TruthEngine';
import React, { useState, useMemo, useCallback } from 'react';
import { useZenithTrace } from '../../hooks/useZenithTrace';
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
import JournalEntryModal from './JournalEntryModal';
import { LexiconText } from '../../hooks/useLexicon';

// Sub-views (Dynamically loaded to optimize bundle footprint and ensure near-instant initial tab rendering)
const ChartOfAccountsView = React.lazy(() => import('./ChartOfAccountsView'));
const JournalView = React.lazy(() => import('./JournalView'));
const TrialBalanceView = React.lazy(() => import('./TrialBalanceView'));
const BalanceSheetView = React.lazy(() => import('./BalanceSheetView'));
const CashFlowView = React.lazy(() => import('./CashFlowView'));
const FractionalView = React.lazy(() => import('./FractionalView'));
const ProfitAndLossView = React.lazy(() => import('./ProfitAndLossView'));
const AgingReport = React.lazy(() => import('./AgingReport'));
const PeriodsView = React.lazy(() => import('./PeriodsView'));
const ProjectProfitabilityView = React.lazy(() => import('./ProjectProfitabilityView'));
const AuditTrailView = React.lazy(() => import('./AuditTrailView'));
const TaxManager = React.lazy(() => import('../finance/TaxManager'));
const BudgetManager = React.lazy(() => import('../planning/BudgetManager'));
const Reconciliation = React.lazy(() => import('./Reconciliation'));

const ReconciliationWizard = React.lazy(() => import('./ReconciliationWizard'));
const BankFeedImport = React.lazy(() => import('./BankFeedImport'));
const InboxView = React.lazy(() => import('./InboxView'));

interface LedgerProps {
  transactions: Transaction[];
  accounts: ChartAccount[];
  journalEntries: JournalEntry[];
  reconciliations: any[];
  bankLines?: any[];
  partners: any[];
  auditLogs: any[];
  budgets: Budget[];
  user: any;
  workspaceId: string;
  onAction: (action: string, details?: any) => void;
  onStartReconciliation: (data: any) => void;
  onCompleteReconciliation: (data: any) => void;
  onMatch?: (bankLineId: string, transactionId: string) => Promise<void>;
  onIgnore?: (bankLineId: string) => Promise<void>;
  onAddFromBank?: (bankLine: any) => Promise<void>;
  onUndoMatch?: (bankLineId: string, transactionId?: string) => Promise<void>;
  onAutoReconcile?: () => Promise<void>;
  onBulkCategorize: (ids: string[], category: string, account: string) => void;
  onParseReceipt: (file: File, transactionId?: string) => void;
  taxRates: TaxRate[];
  onAddTaxRate: (data: Partial<TaxRate>) => Promise<void>;
  onUpdateTaxRate: (id: string, data: Partial<TaxRate>) => Promise<void>;
  onDeleteTaxRate: (id: string) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
}

type SubTab = 'coa' | 'journal' | 'trial' | 'balance' | 'pnl' | 'cashflow' | 'aging' | 'fractional' | 'reconciliation' | 'periods' | 'projects' | 'audit' | 'tax' | 'inbox' | 'budgets';
type ModalType = 'account' | 'journal' | 'recon' | 'period' | 'bank_import' | null;

interface LedgerSubTabConfig {
  id: SubTab;
  label: string;
  icon: any;
  cardKey: string;
}

const LEDGER_SUB_TABS: LedgerSubTabConfig[] = [
  { id: 'inbox', label: 'Transaction Inbox', icon: Inbox, cardKey: 'ledger.tab.inbox' },
  { id: 'coa', label: 'Chart of Accounts', icon: BookOpen, cardKey: 'ledger.tab.coa' },
  { id: 'journal', label: 'General Journal', icon: ArrowRightLeft, cardKey: 'ledger.tab.journal' },
  { id: 'trial', label: 'Trial Balance', icon: Scale, cardKey: 'ledger.tab.trial' },
  { id: 'pnl', label: 'Profit & Loss', icon: BarChart3, cardKey: 'ledger.tab.pnl' },
  { id: 'balance', label: 'Balance Sheet', icon: ShieldCheck, cardKey: 'ledger.tab.balance' },
  { id: 'cashflow', label: 'Cash Flow', icon: Activity, cardKey: 'ledger.tab.cashflow' },
  { id: 'aging', label: 'AP/AR Aging', icon: Clock, cardKey: 'ledger.tab.aging' },
  { id: 'reconciliation', label: 'Reconciliation', icon: RefreshCw, cardKey: 'ledger.tab.reconciliation' },
  { id: 'budgets', label: 'Budgets', icon: Target, cardKey: 'ledger.tab.budgets' },
  { id: 'tax', label: 'Tax Estimator', icon: Scale, cardKey: 'ledger.tab.tax' },
  { id: 'audit', label: 'Audit Trail', icon: History, cardKey: 'ledger.tab.audit' },
];

const TabButton = ({ id, label, icon: Icon, active, onClick, cardKey }: { id: SubTab, label: string, icon: any, active: boolean, onClick: () => void, cardKey?: string }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border",
      active 
        ? "bg-slate-900 border-slate-950 text-white shadow-xs" 
        : "bg-white border-slate-200/80 text-slate-500 hover:border-slate-300 hover:text-slate-800 shadow-3xs"
    )}
  >
    <Icon size={14} />
    {cardKey ? <LexiconText cardKey={cardKey} defaultVal={label} /> : label}
  </button>
);

const Ledger = React.memo(({ 
  transactions = [], 
  accounts = [], 
  journalEntries = [], 
  reconciliations = [], 
  bankLines = [],
  partners = [], 
  auditLogs = [], 
  budgets = [],
  user, 
  workspaceId = 'TEMP_WS',
  onAction, 
  onStartReconciliation,
  onCompleteReconciliation,
  onMatch,
  onUndoMatch,
  onIgnore,
  onAddFromBank,
  onAutoReconcile,
  onBulkCategorize,
  onParseReceipt,
  taxRates = [],
  onAddTaxRate,
  onUpdateTaxRate,
  onDeleteTaxRate,
  onDeleteAccount
}: LedgerProps) => {
  useZenithTrace("Ledger");

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('inbox');
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
        uid: user.uid,
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
        uid: user.uid,
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
      {/* Neural Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate mb-1">
            <Layers size={12} />
            <LexiconText cardKey="ledger.unifiedFinancialLedger" defaultVal="Unified Financial Ledger" />
          </div>
          <LexiconText cardKey="ledger.coreMatrix" defaultVal="Core Matrix" as="h1" className="text-2xl font-black text-slate-800 tracking-tight" />
          <LexiconText 
            cardKey="ledger.coreMatrixSubtitle" 
            defaultVal="High-fidelity double-entry synchronization with immutable forensic trails." 
            as="p" 
            className="text-xs text-slate-500 font-medium" 
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setActiveModal('journal')}
            className="h-10 px-4 bg-white text-slate-800 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all border border-slate-200 shadow-3xs flex items-center gap-2"
          >
            <ArrowRightLeft size={14} />
            <LexiconText cardKey="ledger.button.journalEntry" defaultVal="Journal Entry" />
          </button>
          <button 
            onClick={() => setActiveModal('account')}
            className="h-10 px-5 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold font-sans transition-all flex items-center justify-center gap-2 shadow-xs"
          >
            <Plus size={14} className="stroke-[3px]" />
            <LexiconText cardKey="ledger.button.appendNode" defaultVal="Append Node" />
          </button>
        </div>
      </div>

      {/* Deterministic Ledger Pulse */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-3xs hover:border-slate-350 transition-all relative overflow-hidden group">
          <div className="absolute technical-grid inset-0 opacity-[0.01] pointer-events-none" />
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate mb-2 relative z-10 flex items-center gap-1.5">
            <Scale size={12} className="text-blue-500" />
            <LexiconText cardKey="ledger.stabilityVector" defaultVal="Stability Vector" />
          </p>
          <div className="flex items-center gap-3 relative z-10 mt-1">
            <div className={cn("w-2 h-2 rounded-full shrink-0", totalProfitCents !== undefined ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-rose-500")} />
            <LexiconText cardKey="ledger.verifiedStatus" defaultVal="Verified" as="p" className="text-lg font-black text-slate-800 uppercase tracking-tight" />
          </div>
          <div className="mt-3 text-[8px] font-bold text-slate-400 uppercase tracking-wider opacity-60">
            <LexiconText cardKey="ledger.equilibriumSyncActive" defaultVal="Equilibrium Sync Active" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-3xs hover:border-slate-350 transition-all relative overflow-hidden group">
          <div className="absolute technical-grid inset-0 opacity-[0.01] pointer-events-none" />
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate mb-2 relative z-10">
            <LexiconText cardKey="ledger.netInternalFlux" defaultVal="Net Internal Flux" />
          </p>
          <p className={cn("text-xl font-bold font-mono tracking-tight relative z-10 truncate mt-1", totalProfitCents >= 0 ? "text-emerald-700" : "text-rose-700")}>
            {formatCurrency(totalProfitCents)}
          </p>
          <div className="mt-3 flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase tracking-wider opacity-60">
             <Activity size={11} className="text-amber-550 shrink-0" />
             <LexiconText cardKey="ledger.liveThrottling" defaultVal="Live Throttling" />
          </div>
        </div>

        <div className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-3xs hover:border-slate-350 transition-all relative overflow-hidden group">
          <div className="absolute technical-grid inset-0 opacity-[0.01] pointer-events-none" />
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate mb-2 relative z-10">
            <LexiconText cardKey="ledger.forensicIntegrity" defaultVal="Forensic Integrity" />
          </p>
          <div className="flex items-center gap-2 mt-1">
             <ShieldCheck size={18} className="text-emerald-500 shrink-0 animate-pulse" />
             <LexiconText cardKey="ledger.absoluteStatus" defaultVal="Absolute" as="p" className="text-lg font-black text-slate-800 uppercase tracking-tight relative z-10" />
          </div>
          <div className="mt-3 flex items-center gap-1 text-[8px] font-bold text-emerald-600 uppercase tracking-wider opacity-80">
             <Zap size={11} className="shrink-0" />
             <LexiconText cardKey="ledger.immutableStatus" defaultVal="100% Immutable" />
          </div>
        </div>

        <div className="p-5 bg-slate-900 text-white rounded-xl shadow-sm relative overflow-hidden group">
          <div className="absolute technical-grid inset-0 opacity-10 pointer-events-none" />
          <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider truncate mb-2 relative z-10">
            <LexiconText cardKey="ledger.coreBackboneProtocol" defaultVal="Core Backbone Protocol" />
          </p>
          <div className="flex items-center gap-3 mt-1 relative z-10">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/15 shrink-0">
               <Cpu size={16} className="text-amber-300" />
            </div>
            <p className="text-[11px] font-mono font-bold text-amber-300 tracking-wider truncate">LF-0x{(workspaceId || 'TEMP_WS').slice(0, 6).toUpperCase()}</p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-[8px] font-bold text-white/30 uppercase tracking-wider">
             <ShieldCheck size={11} className="shrink-0" />
             <LexiconText cardKey="ledger.nexusSecurityActive" defaultVal="Nexus Security Active" />
          </div>
        </div>
      </div>

       {/* Navigation Matrix */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
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
              className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-slate-950 focus:bg-white transition-all text-sm font-medium text-slate-800 placeholder:text-slate-400"
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
          {activeSubTab === 'inbox' && (
            <InboxView 
              accounts={accounts} 
              onCategorize={onBulkCategorize}
              formatCurrency={formatCurrency}
              onParseReceipt={onParseReceipt}
            />
          )}
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
              onDrillDown={(id) => onAction('drill-down', { account: accounts.find(a => a.id === id)?.name })}
            />
          )}
          {activeSubTab === 'balance' && (
            <BalanceSheetView 
              accounts={accounts} 
              journalEntries={journalEntries || []} 
              formatCurrency={formatCurrency} 
            />
          )}
          {activeSubTab === 'pnl' && (
            <ProfitAndLossView workspaceId={workspaceId} />
          )}
          {activeSubTab === 'cashflow' && (
            <CashFlowView />
          )}
          {activeSubTab === 'aging' && (
            <AgingReport workspaceId={workspaceId} />
          )}
          {activeSubTab === 'reconciliation' && (
            <div className="space-y-8">
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setActiveModal('bank_import')}
                  className="flex items-center gap-3 px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-[32px] text-sm font-medium uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm"
                >
                  <ArrowDownRight size={18} />
                  Import CSV
                </button>
                <button 
                  onClick={() => setActiveModal('recon')}
                  className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-[32px] text-sm font-medium uppercase tracking-wider hover:bg-slate-900/90 transition-all shadow-2xl"
                >
                  <RefreshCw size={18} />
                  Initiate Sync
                </button>
              </div>
              
              <Reconciliation
                user={user}
                workspaceId={workspaceId}
                bankLines={bankLines}
                accounts={accounts}
                onMatch={onMatch || (async () => {})}
                onUndoMatch={onUndoMatch || (async () => {})}
                onIgnore={onIgnore || (async () => {})}
                onAddFromBank={onAddFromBank || (async () => {})}
                onAutoReconcile={onAutoReconcile || (async () => {})}
              />
            </div>
          )}
          {activeSubTab === 'audit' && (
            <AuditTrailView auditLogs={auditLogs} />
          )}
          {activeSubTab === 'tax' && (
            <TaxManager 
              user={user} 
              workspaceId={workspaceId} 
              accounts={accounts} 
              taxRates={taxRates}
              onAddTaxRate={onAddTaxRate}
              onUpdateTaxRate={onUpdateTaxRate}
              onDeleteTaxRate={onDeleteTaxRate}
            />
          )}
          {activeSubTab === 'budgets' && (
            <BudgetManager budgets={budgets} accounts={accounts} user={user} />
          )}
        </React.Suspense>
      </motion.div>

      {/* Bank Feed Import Modal */}
      <AnimatePresence>
        {activeModal === 'bank_import' && (
          <BankFeedImport 
            workspaceId={workspaceId}
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
              className="relative w-full max-w-lg bg-slate-50 rounded-[40px] shadow-2xl border border-slate-200 overflow-hidden p-4 md:p-10"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Add New Account</h2>
                <button onClick={() => setActiveModal(null)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
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
                      className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-slate-50 transition-all font-mono text-slate-900"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-50">Account Type</label>
                    <select 
                      value={newAccount.type}
                      onChange={(e) => setNewAccount({ ...newAccount, type: e.target.value as any })}
                      className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-slate-50 transition-all font-bold text-slate-900 appearance-none cursor-pointer"
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
                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-slate-50 transition-all font-bold text-slate-900"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-50">Category (Optional)</label>
                  <input 
                    type="text" 
                    value={newAccount.category}
                    onChange={(e) => setNewAccount({ ...newAccount, category: e.target.value })}
                    placeholder="e.g. Current Assets"
                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-slate-50 transition-all text-slate-900"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-50">Description</label>
                  <textarea 
                    value={newAccount.description}
                    onChange={(e) => setNewAccount({ ...newAccount, description: e.target.value })}
                    placeholder="Briefly describe the purpose of this account..."
                    rows={3}
                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-slate-50 transition-all resize-none text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-50">Parent Account</label>
                    <select 
                      value={newAccount.parentId}
                      onChange={(e) => setNewAccount({ ...newAccount, parentId: e.target.value })}
                      className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-slate-50 transition-all font-bold text-slate-900 appearance-none cursor-pointer"
                    >
                      <option value="">None (Root)</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                      ))}
                    </select>
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
                      className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-slate-50 transition-all font-mono text-slate-900 text-right"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-50">As of Date</label>
                  <input 
                    type="date" 
                    value={newAccount.asOfDate}
                    onChange={(e) => setNewAccount({ ...newAccount, asOfDate: e.target.value })}
                    className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-[32px] focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-slate-50 transition-all font-bold text-slate-900"
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="flex-1 py-4 bg-slate-50 text-slate-500 rounded-[32px] font-black hover:text-slate-900 transition-all uppercase tracking-widest text-[10px]"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-indigo-600 text-white rounded-[32px] font-black hover:opacity-90 transition-all shadow-xl shadow-ledger-accent/20 uppercase tracking-widest text-[10px]"
                  >
                    Establish Node
                  </button>
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
              className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl border border-zinc-200 overflow-hidden p-4 md:p-10"
            >
              <div className="flex items-center gap-5 mb-8">
                <div className="w-16 h-16 bg-amber-50 rounded-[32px] flex items-center justify-center text-amber-600 border border-amber-100">
                  <ShieldCheck size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Close Period</h2>
                  <p className="text-sm text-zinc-500">Locking {format(new Date(), 'MMMM yyyy')}</p>
                </div>
              </div>

              <div className="space-y-8">
                <div className="p-4 md:p-8 bg-zinc-50 rounded-[32px] border border-zinc-100 space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 text-sm font-medium">Net Income</span>
                    <span className="font-black text-zinc-900 text-lg">{formatCurrency(totalProfitCents)}</span>
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
                  <button 
                    onClick={() => {
                      setActiveModal(null);
                      toast.success('Period closed successfully');
                    }}
                    className="flex-1 py-4 bg-zinc-900 text-white rounded-[32px] font-black hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20"
                  >
                    Confirm Close
                  </button>
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
        user={user}
        accounts={accounts}
        workspaceId={workspaceId}
      />
    </div>
  );
});

export default Ledger;
