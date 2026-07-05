import { useState } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useLedgerStore } from '../stores/useLedgerStore';
import { useUIStore } from '../stores/useUIStore';
import { IntentResolver } from '../lib/intentResolver';
import { StrategicEngine } from '../services/strategicEngine';
import { toast } from 'sonner';
import { reportError, OperationType } from '../lib/utils';

export function useAIActions() {
  const { currentWorkspaceId, workspaces, userProfile } = useAuthStore();
  const { transactions } = useLedgerStore();
  const uiStore = useUIStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [strategicInsights, setStrategicInsights] = useState<any>(null);

  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);
  const userKey = userProfile?.geminiApiKey;

  const handleAnalyzeTrends = async () => {
    if (!transactions.length) return;
    setIsAnalyzing(true);
    try {
      const metrics = { kpis: { revenue: 1000, expenses: 500, prevExpenses: 400, totalCash: 5000, runwayMonths: 10 } } as any; 
      const insights = StrategicEngine.analyze({ metrics, projects: [] }, transactions);
      
      const formattedInsights = {
        executiveSummary: "Algorithmic analysis completed.",
        strategicAdvice: insights.map(i => `${i.title}: ${i.description}`),
        anomalies: insights.filter(i => i.type === 'risk').map(i => i.description)
      };

      setStrategicInsights(formattedInsights);
      toast.success('Algorithmic trends synthesized');
    } catch (error) {
      reportError(error, OperationType.SYNC, 'analyze_trends');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAIQuery = async (query: string) => {
    // 1. Direct command detection for UI navigation and system shortcuts
    const lowQuery = query.toLowerCase();
    
    // NAVIGATION COMMANDS
    if (lowQuery === 'home' || lowQuery === 'dashboard') { uiStore.setActiveTab('dashboard'); return; }
    if (lowQuery === 'transactions' || lowQuery === 'journal') { uiStore.setActiveTab('transactions'); return; }
    if (lowQuery === 'ledger' || lowQuery === 'coa') { uiStore.setActiveTab('ledger'); return; }
    if (lowQuery === 'reports' || lowQuery === 'p&l') { uiStore.setActiveTab('reports'); return; }
    if (lowQuery === 'settings' || lowQuery === 'config') { uiStore.setActiveTab('settings'); return; }
    if (lowQuery === 'projects' || lowQuery === 'kanban') { uiStore.setActiveTab('projects'); return; }
    if (lowQuery === 'inventory' || lowQuery === 'stock') { uiStore.setActiveTab('inventory'); return; }
    if (lowQuery === 'assets' || lowQuery === 'equipment') { uiStore.setActiveTab('assets'); return; }
    if (lowQuery === 'compliance' || lowQuery === 'taxes') { uiStore.setActiveTab('taxes'); return; }
    if (lowQuery === 'forecaster' || lowQuery === 'prediction') { uiStore.setActiveTab('forecaster'); return; }
    if (lowQuery === 'reconciliation' || lowQuery === 'match' || lowQuery === 'align') { uiStore.setActiveTab('reconciliation'); return; }
    
    // MODAL COMMANDS
    if (lowQuery.includes('guide') || lowQuery.includes('help') || lowQuery.includes('how to')) {
      uiStore.setGuideOpen(true);
      return;
    }
    if (lowQuery.includes('architecture') || lowQuery.includes('blueprint') || lowQuery.includes('system')) {
      uiStore.setArchitectureOpen(true);
      return;
    }
    if (lowQuery.includes('integrity') || lowQuery.includes('audit log') || lowQuery.includes('security')) {
      uiStore.setIntegrityOpen(true);
      return;
    }
    if (lowQuery.includes('add') || lowQuery.includes('record') || lowQuery.includes('new tx')) {
      uiStore.setQuickEntryOpen(true);
      return;
    }
    if (lowQuery.includes('import') || lowQuery.includes('statement') || lowQuery.includes('csv')) {
      uiStore.setImporterOpen(true);
      return;
    }
    if (lowQuery.includes('convert') || lowQuery.includes('fx') || lowQuery.includes('currency')) {
      uiStore.setConverterOpen(true);
      return;
    }

    const loader = toast.loading(`Synthesizing intelligence: ${query}`);
    try {
      const result = IntentResolver.resolve(
        query, 
        useLedgerStore.getState().accounts.map(a => a.name),
        useLedgerStore.getState().transactions.map(t => t.project).filter((v, i, a) => v && a.indexOf(v) === i) as string[]
      ) as any;
      
      // Map AI response to Filter Criteria format
      const filter: any = {};
      if (result?.category) filter.category = result.category;
      if (result?.project) filter.project = result.project;
      
      // Handle Amount (Algorithmic or Neural)
      if (result?.minAmountCents !== undefined) filter.minAmount = result.minAmountCents / 100;
      if (result?.maxAmountCents !== undefined) filter.maxAmount = result.maxAmountCents / 100;
      
      // Handle Temporal
      if (result?.startDate) filter.startDate = result.startDate;
      if (result?.endDate) filter.endDate = result.endDate;
      
      if (result?.isAuditQuery) filter.isAuditQuery = true;
      
      // Search Term fallback
      filter.searchTerm = result.searchTerm || query;
      
      uiStore.setFilterCriteria(filter);
      uiStore.setActiveTab('transactions');
      toast.success(`Neural resolution complete: "${query}"`, { id: loader });
      
      return result;
    } catch (error) {
      reportError(error, OperationType.SYNC, 'ai_query', { query });
      toast.dismiss(loader);
    }
  };

  return { isAnalyzing, strategicInsights, handleAnalyzeTrends, handleAIQuery };
}
