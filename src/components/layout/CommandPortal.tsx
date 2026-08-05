import React, { lazy, Suspense } from 'react';
import { toast } from 'sonner';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useAuthStore } from '../../stores/useAuthStore';

// Highly Optimized Lazy Loading of heavy overlay system modals
const CommandPalette = lazy(() => import('./CommandPalette'));
const MagicEntry = lazy(() => import('../ledger/MagicEntry'));
const StatementImporter = lazy(() => import('../ledger/StatementImporter'));
const TemplateSelector = lazy(() => import('./TemplateSelector'));
const AICustomBlueprint = lazy(() => import('../intelligence/AICustomBlueprint'));
const AICommandCenter = lazy(() => import('../intelligence/AICommandCenter'));
const CurrencyConverter = lazy(() => import('../finance/CurrencyConverter'));
const SystemArchitecture = lazy(() => import('../platform/SystemArchitecture'));
const HealthCheckModal = lazy(() => import('../system/HealthCheckModal'));

interface CommandPortalProps {
  modals: {
    commandPalette: boolean;
    quickEntry: boolean;
    importer: boolean;
    template: boolean;
    aiBlueprint: boolean;
    commandCenter: boolean;
    converter: boolean;
    integrity: boolean;
    healthCheck: boolean;
    architecture: boolean;
  };
  handlers: {
    closeCommandPalette: () => void;
    closeQuickEntry: () => void;
    closeImporter: () => void;
    closeTemplate: () => void;
    closeAIBlueprint: () => void;
    closeCommandCenter: () => void;
    closeConverter: () => void;
    closeIntegrity: () => void;
    closeHealthCheck: () => void;
    closeArchitecture: () => void;
    handleAIQuery: (q: string) => Promise<any>;
    handleFilter: (f: any) => void;
    handleQuickAdd: (d: any) => void;
    handleImportTransactions: (t: any[]) => void;
    handleIntegrityAction: (a: string) => void;
    handleSelectTemplate: (id: string) => void;
    handleOpenAIBlueprint: () => void;
    handleSaveCurrentTemplate: () => void;
    handleApplyAITemplate: (t: any) => void;
  };
}

export default function CommandPortal({ modals, handlers }: CommandPortalProps) {
  const transactions = useLedgerStore(state => state.transactions);
  const accounts = useLedgerStore(state => state.accounts);
  const projects = useLedgerStore(state => state.projects);
  const autoRules = useLedgerStore(state => state.autoRules || []);
  const patternCache = useLedgerStore(state => state.analyticalPatternCache || {});
  const customTemplates = useLedgerStore(state => state.customTemplates || []);
  
  const currentWorkspaceId = useAuthStore(state => state.currentWorkspaceId);
  const workspaces = useAuthStore(state => state.workspaces);
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);
  
  const businessContext = currentWorkspace?.description || '';
  const baseCurrency = currentWorkspace?.currency || 'USD';
  const currentTemplateId = currentWorkspace?.businessType || 'generic';
  
  const categories = Array.from(new Set(accounts.filter((a: any) => a.type === 'income' || a.type === 'expense').map((a: any) => a.name)));
  
  return (
    <Suspense fallback={null}>
      {modals.quickEntry && (
        <MagicEntry 
          isOpen={modals.quickEntry} 
          onClose={handlers.closeQuickEntry} 
          onAdd={handlers.handleQuickAdd}
          categories={categories}
          accounts={accounts}
          projects={projects.map((p: any) => p.name)}
          autoRules={autoRules}
          patternCache={patternCache}
        />
      )}
      {modals.importer && (
        <StatementImporter 
          isOpen={modals.importer}
          onClose={handlers.closeImporter}
          onImport={handlers.handleImportTransactions}
          existingTransactions={transactions}
          businessContext={businessContext}
          accounts={accounts}
          autoRules={autoRules}
          patternCache={patternCache}
        />
      )}
      {modals.aiBlueprint && (
        <AICustomBlueprint 
          isOpen={modals.aiBlueprint}
          onClose={handlers.closeAIBlueprint}
          onGenerated={handlers.handleApplyAITemplate}
        />
      )}
      {modals.template && (
        <TemplateSelector 
          isOpen={modals.template}
          onClose={handlers.closeTemplate}
          onSelect={handlers.handleSelectTemplate}
          onOpenAI={handlers.handleOpenAIBlueprint}
          currentType={currentTemplateId}
          customTemplates={customTemplates}
          onSaveCurrent={handlers.handleSaveCurrentTemplate}
        />
      )}
      {modals.commandCenter && (
        <AICommandCenter 
          isOpen={modals.commandCenter}
          onClose={handlers.closeCommandCenter}
          onFilter={handlers.handleFilter}
          businessContext={businessContext}
        />
      )}
      {modals.converter && (
        <CurrencyConverter 
          isOpen={modals.converter}
          onClose={handlers.closeConverter}
          baseCurrency={baseCurrency}
        />
      )}
      {modals.healthCheck && (
        <HealthCheckModal 
          isOpen={modals.healthCheck} 
          onClose={handlers.closeHealthCheck} 
        />
      )}
      {modals.architecture && (
        <SystemArchitecture 
          isOpen={modals.architecture}
          onClose={handlers.closeArchitecture}
          
          accounts={accounts}
        />
      )}
    </Suspense>
  );
}
