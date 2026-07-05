import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useUIStore } from '../stores/useUIStore';
import { useEntityOperations } from './useEntityOperations';
import { useTransactionActions } from './useTransactionActions';
import { useFinancialReporting } from './useFinancialReporting';
import { useAIActions } from './useAIActions';
import { useAuditTelemetry } from './useAuditTelemetry';

export function useCommandDispatcher() {
  const setQuickEntryOpen = useUIStore(state => state.setQuickEntryOpen);
  const setImporterOpen = useUIStore(state => state.setImporterOpen);
  const setCommandPaletteOpen = useUIStore(state => state.setCommandPaletteOpen);
  const setTemplateSelectorOpen = useUIStore(state => state.setTemplateSelectorOpen);
  const setConverterOpen = useUIStore(state => state.setConverterOpen);
  const setIntegrityOpen = useUIStore(state => state.setIntegrityOpen);
  const setGuideOpen = useUIStore(state => state.setGuideOpen);
  const setCommandCenterOpen = useUIStore(state => state.setCommandCenterOpen);
  const setActiveTab = useUIStore(state => state.setActiveTab);
  const setFilterCriteria = useUIStore(state => state.setFilterCriteria);
  const activeTab = useUIStore(state => state.activeTab);
  const { updateEntity } = useEntityOperations();

  const txActions = useTransactionActions();
  const aiActions = useAIActions();

  const handleAction = useCallback((action: string, details?: any) => {
    const actionMap: Record<string, () => void> = {
      'open-converter': () => setConverterOpen(true),
      'open-integrity': () => setIntegrityOpen(true),
      'open-guide': () => setGuideOpen(true),
      'open-command-palette': () => setCommandPaletteOpen(true),
      'quick-entry': () => setQuickEntryOpen(true),
      'new-entry': () => setQuickEntryOpen(true),
      'bulk-repair-ledger': () => txActions.handleBulkRepair(details?.transactions || []),
      'update': () => updateEntity(details?.entityType, details?.id, details?.updates),
      'fix-ledger-imbalances': () => {
        // Usually handled by bulk update, or directly in UI
        if(details?.imbalances) {
          toast.info('Fixing imbalances');
        }
      },
      'export': () => txActions.handleExport(useLedgerStore.getState().transactions),
      'reset-workspace': () => txActions.handleResetWorkspace(),
      'analyze-trends': () => aiActions.handleAnalyzeTrends(),
      'select-architecture': () => setTemplateSelectorOpen(true),
      'settings': () => setActiveTab('settings'),
      'reports': () => setActiveTab('reports'),
      'switch-tab': () => {
        setActiveTab(details?.tab);
        if (details?.channel) {
           useUIStore.getState().setActiveIntelChannel(details.channel);
        }
      },
      'drill-down': () => {
        setFilterCriteria(details);
        if (activeTab !== 'intelligence' && activeTab !== 'situation' && activeTab !== 'forecaster') {
          setActiveTab('transactions');
        }
      },
      'start-reconciliation': () => setActiveTab('reconciliation'),
      'paste-statement': () => setImporterOpen(true),
      'import_bank_csv': () => txActions.handleImportTransactions(details),
      'open-command-center': () => setCommandCenterOpen(true),
      'toggle-focus-mode': () => useUIStore.getState().toggleFocusMode(),
    };

    if (action.startsWith('select-template:')) {
       // Currently delegated inside App or via specific component. We will handle select template as a specific callback separately or inject it.
      return;
    }

    if (actionMap[action]) {
      actionMap[action]();
    } else {
      console.warn(`Unmapped command received: ${action}`);
    }
  }, [
    setConverterOpen, setIntegrityOpen, setGuideOpen, setCommandPaletteOpen, 
    setQuickEntryOpen, txActions, aiActions, setTemplateSelectorOpen, 
    setActiveTab, setFilterCriteria, activeTab, setImporterOpen, setCommandCenterOpen, 
  ]);

  return { handleAction };
}

export function useSystemProps(handleAction: (act: string, data?: any) => void) {
  const { addEntity, updateEntity, deleteEntity } = useEntityOperations();
  const txActions = useTransactionActions();
  const ai = useAIActions();
  const reports = useFinancialReporting();

  const user = useAuthStore(state => state.user);
  const currentWorkspaceId = useAuthStore(state => state.currentWorkspaceId);
  const currentProjectId = useAuthStore(state => state.currentProjectId);
  const workspaces = useAuthStore(state => state.workspaces);
  
  const currentWorkspace = useMemo(() => workspaces.find(w => w.id === currentWorkspaceId), [workspaces, currentWorkspaceId]);

  const transactions = useLedgerStore(state => state.transactions);
  const accounts = useLedgerStore(state => state.accounts);
  const journalEntries = useLedgerStore(state => state.journalEntries);
  const budgets = useLedgerStore(state => state.budgets);
  const reconciliations = useLedgerStore(state => state.reconciliations);
  const activityThreads = useLedgerStore(state => state.activityFeed || []);
  const auditLogs = useLedgerStore(state => state.auditLogs || []);
  const taxRates = useLedgerStore(state => state.taxRates);
  const computedAccounts = useLedgerStore(state => state.computedAccounts);
  const projects = useLedgerStore(state => state.projects);
  const autoRules = useLedgerStore(state => state.autoRules || []);
  
  const bankLines = useLedgerStore(state => state.bankLines || []);
  const customers = useLedgerStore(state => state.customers);
  const vendors = useLedgerStore(state => state.vendors);
  const bills = useLedgerStore(state => state.bills);
  const invoices = useLedgerStore(state => state.invoices);
  const partners = useLedgerStore(state => state.partners);
  const employees = useLedgerStore(state => state.employees);
  const payRuns = useLedgerStore(state => state.payRuns);

  const isCompactMode = useUIStore(state => state.isCompactMode);
  const setCompactMode = useUIStore(state => state.setCompactMode);
  const isProMode = useUIStore(state => state.isProMode);
  const setProMode = useUIStore(state => state.setProMode);
  const setQuickEntryOpen = useUIStore(state => state.setQuickEntryOpen);
  const setImporterOpen = useUIStore(state => state.setImporterOpen);
  const filterCriteria = useUIStore(state => state.filterCriteria);
  const setFilterCriteria = useUIStore(state => state.setFilterCriteria);

  const filteredTransactions = useMemo(() => {
    if (!currentProjectId) return transactions;
    return transactions.filter(t => t.project === currentProjectId || (t as any).projectId === currentProjectId);
  }, [transactions, currentProjectId]);

  const categories = useMemo(() => 
    Array.from(new Set(accounts.filter(a => a.type === 'income' || a.type === 'expense').map(a => a.name))),
  [accounts]);

  const metrics = useAuditTelemetry(filteredTransactions, computedAccounts);

  const formatCurrency = useCallback((cents: number) => 
    new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: currentWorkspace?.currency || 'USD' 
    }).format(cents / 100), [currentWorkspace]);

  const onToggleCompactMode = useCallback(() => setCompactMode(!isCompactMode), [isCompactMode, setCompactMode]);
  const onToggleProMode = useCallback(() => setProMode(!isProMode), [isProMode, setProMode]);
  const onNewEntry = useCallback(() => setQuickEntryOpen(true), [setQuickEntryOpen]);
  const onOpenImporter = useCallback(() => setImporterOpen(true), [setImporterOpen]);
  const onFilterApplied = useCallback((criteria: any) => setFilterCriteria(criteria), [setFilterCriteria]);

  return useMemo(() => ({
    transactions: filteredTransactions,
    accounts: computedAccounts,
    categories,
    projects,
    budgets,
    journalEntries,
    reconciliations,
    activityThreads,
    auditLogs,
    taxRates,
    employees,
    payRuns,
    bankLines,
    bills,
    invoices,
    vendors,
    customers,
    partners,
    metrics,
    strategicInsights: ai.strategicInsights,
    isAnalyzingTrends: ai.isAnalyzing,
    user,
    workspaceId: currentWorkspaceId,
    workspace: currentWorkspace,
    businessContext: currentWorkspace?.description || '',
    businessType: currentWorkspace?.businessType || 'generic',
    isCompactMode,
    isProMode,
    filterCriteria,
    rules: autoRules,
    formatCurrency,
    onAnalyzeTrends: ai.handleAnalyzeTrends,
    onToggleCompactMode,
    onToggleProMode,
    onAction: handleAction,
    onFilterApplied,
    onNewEntry,
    onOpenImporter,
    onVoid: txActions.handleVoidTransaction,
    onUpdate: txActions.handleUpdateTransaction,
    onImport: txActions.handleImportTransactions,
    onParseReceipt: txActions.handleParseReceipt,
    onDeleteAccount: txActions.handleDeleteAccount,
    onMatch: txActions.handleReconcileMatch,
    onIgnore: txActions.handleReconcileIgnore,
    onAddFromBank: txActions.handleReconcileCreate,
    onUndoMatch: txActions.handleReconcileUndo,
    onAutoReconcile: txActions.handleAutoReconcile,
    onAddTaxRate: (data: any) => addEntity('taxRates', data),
    onUpdateTaxRate: (id: string, data: any) => updateEntity('taxRates', id, data),
    onDeleteTaxRate: (id: string) => deleteEntity('taxRates', id),
    onFetchPL: reports.fetchPL,
    onFetchAging: reports.fetchAging,
    reports: reports.reports,
    loading: reports.loading,
    onAddProject: (data: any) => addEntity('projects', data),
    onUpdateProject: (id: string, data: any) => updateEntity('projects', id, data),
    onDeleteProject: (id: string) => deleteEntity('projects', id),
    onUpdateWorkspace: (updates: any) => updateEntity('workspaces', currentWorkspaceId!, updates),
    onResetSystem: txActions.handleResetWorkspace,
    onAddInvoice: (data: any) => addEntity('invoices', data),
    onAddCustomer: (data: any) => addEntity('customers', data),
    onAddBill: (data: any) => addEntity('bills', data),
    onAddVendor: (data: any) => addEntity('vendors', data),
    onUpdateBill: (id: string, updates: any) => updateEntity('bills', id, updates),
    onUpdateBudget: (id: string, data: any) => updateEntity('budgets', id, data),
    onProcessPayRun: (data: any) => addEntity('payRuns', data),
    onAddRule: txActions.handleAddRule,
    onDeleteRule: txActions.handleDeleteRule,
    onUpdateRule: txActions.handleUpdateRule,
    onApplyRules: txActions.handleApplyRules,
    onSmartCluster: txActions.handleSmartCluster,
  }), [
    filteredTransactions, computedAccounts, categories, projects, budgets, journalEntries, 
    reconciliations, activityThreads, auditLogs, taxRates, employees, payRuns, bankLines, 
    bills, invoices, vendors, customers, partners, metrics, ai, user, currentWorkspaceId, 
    currentWorkspace, isCompactMode, isProMode, filterCriteria, autoRules, formatCurrency, 
    onToggleCompactMode, onToggleProMode, handleAction, onFilterApplied, onNewEntry, 
    onOpenImporter, txActions, reports, addEntity, updateEntity, deleteEntity
  ]);
}
