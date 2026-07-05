import React, { lazy, Suspense } from 'react';
import { toast } from 'sonner';

// Highly Optimized Lazy Loading of heavy overlay system modals
const CommandPalette = lazy(() => import('./CommandPalette'));
const MagicEntry = lazy(() => import('../ledger/MagicEntry'));
const StatementImporter = lazy(() => import('../ledger/StatementImporter'));
const TemplateSelector = lazy(() => import('./TemplateSelector'));
const AICustomBlueprint = lazy(() => import('../intelligence/AICustomBlueprint'));
const AICommandCenter = lazy(() => import('../intelligence/AICommandCenter'));
const CurrencyConverter = lazy(() => import('../finance/CurrencyConverter'));
const DocumentEntanglement = lazy(() => import('../forensics/DocumentEntanglement'));
const SystemArchitecture = lazy(() => import('../platform/SystemArchitecture'));

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
    entanglement: boolean;
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
    closeEntanglement: () => void;
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
  data: {
    transactions: any[];
    categories: string[];
    accounts: any[];
    projects: any[];
    workspaceId: string | null;
    businessContext: string;
    baseCurrency: string;
    customTemplates: any[];
    currentTemplateId: string;
    recentQueries?: string[];
    autoRules: any[];
    analyticalPatternCache: Record<string, any>;
  };
}

export default function CommandPortal({ modals, handlers, data }: CommandPortalProps) {
  return (
    <Suspense fallback={null}>
      {modals.commandPalette && (
        <CommandPalette 
          isOpen={modals.commandPalette}
          onClose={handlers.closeCommandPalette}
          onQuery={handlers.handleAIQuery}
          recentQueries={data.recentQueries || []}
        />
      )}
      {modals.quickEntry && (
        <MagicEntry 
          isOpen={modals.quickEntry} 
          onClose={handlers.closeQuickEntry} 
          onAdd={handlers.handleQuickAdd}
          categories={data.categories}
          accounts={data.accounts}
          projects={data.projects.map((p: any) => p.name)}
          autoRules={data.autoRules}
          patternCache={data.analyticalPatternCache}
        />
      )}
      {modals.importer && (
        <StatementImporter 
          isOpen={modals.importer}
          onClose={handlers.closeImporter}
          onImport={handlers.handleImportTransactions}
          existingTransactions={data.transactions}
          businessContext={data.businessContext}
          accounts={data.accounts}
          autoRules={data.autoRules}
          patternCache={data.analyticalPatternCache}
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
          currentType={data.currentTemplateId}
          customTemplates={data.customTemplates}
          onSaveCurrent={handlers.handleSaveCurrentTemplate}
        />
      )}
      {modals.commandCenter && (
        <AICommandCenter 
          isOpen={modals.commandCenter}
          onClose={handlers.closeCommandCenter}
          onFilter={handlers.handleFilter}
          businessContext={data.businessContext}
        />
      )}
      {modals.converter && (
        <CurrencyConverter 
          isOpen={modals.converter}
          onClose={handlers.closeConverter}
          baseCurrency={data.baseCurrency}
        />
      )}
      {modals.entanglement && (
        <DocumentEntanglement 
          isOpen={modals.entanglement}
          onClose={handlers.closeEntanglement}
          onVerify={() => {
            toast.success("Document structure verified and entangled with ledger.");
            handlers.closeEntanglement();
          }}
        />
      )}
      {modals.architecture && (
        <SystemArchitecture 
          isOpen={modals.architecture}
          onClose={handlers.closeArchitecture}
          transactions={data.transactions}
          accounts={data.accounts}
        />
      )}
    </Suspense>
  );
}
