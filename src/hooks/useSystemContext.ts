import { useCallback } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useUIStore } from '../stores/useUIStore';
import { useEntityOperations } from './useEntityOperations';
import { useTransactionActions } from './useTransactionActions';
import { useAIActions } from './useAIActions';
import { VIEW_COMPONENTS, APP_TABS } from '../config/registry';

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
      'open-health-check': () => useUIStore.getState().setHealthCheckOpen(true),
      'open-guide': () => setGuideOpen(true),
      'open-command-palette': () => setCommandPaletteOpen(true),
      'open-shortcuts': () => useUIStore.getState().setShortcutOverlayOpen(true),
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
        if (details?.subTab) {
           useUIStore.getState().setActiveSettingsTab(details.subTab);
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
    } else if (VIEW_COMPONENTS[action] || APP_TABS.some(t => t.id === action)) {
      setActiveTab(action as any);
      if (details?.channel) {
        useUIStore.getState().setActiveIntelChannel(details.channel);
      }
    } else if (action === 'print') {
      window.print();
    } else if (action === 'generate') {
      toast.success('Report updated successfully.');
    } else if (action === 'filter_project') {
      if (details?.projectId) {
        useAuthStore.setState({ currentProjectId: details.projectId });
        toast.info('Filtered view by selected project');
      }
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

