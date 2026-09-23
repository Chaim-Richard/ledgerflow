import React, { Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { Minimize2 } from 'lucide-react';

import Sidebar from '../../components/layout/Sidebar';
import Header from '../../components/layout/Header';
import ModuleSubNav from '../../components/layout/ModuleSubNav';
import BottomNav from '../../components/layout/BottomNav';
import MainViewSwitcher from '../../components/layout/MainViewSwitcher';
import CommandPalette from '../../components/layout/CommandPalette';
import CommandPortal from '../../components/layout/CommandPortal';
import StatusBar from '../../components/layout/StatusBar';
import LedgerInterruptOverlay from '../../components/forensics/LedgerInterruptOverlay';

import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useUIStore } from '../../stores/useUIStore';

import ShortcutOverlay from '../../components/layout/ShortcutOverlay';
import DiagnosticConsole from '../../components/intelligence/DiagnosticConsole';
import ConnectionBanner from '../../components/platform/ConnectionBanner';
import LedgerBackupReminder from '../../components/platform/LedgerBackupReminder';

import { useCommandDispatcher } from '../../hooks/useSystemContext';
import { useTransactionActions } from '../../hooks/useTransactionActions';
import { useAIActions } from '../../hooks/useAIActions';

import { useSystemActions } from '../../hooks/useSystemActions';

export function RootLayout() {
  const { handleAction } = useCommandDispatcher();
  const txActions = useTransactionActions();
  const ai = useAIActions();
  const { handleLoginPrompt, handleLogout, handleApplyAITemplate, handleSelectTemplate, handleSaveCurrentTemplate, handleCreateWorkspace } = useSystemActions();
  const isPending = false;
  const activeTab = useUIStore(state => state.activeTab);
  const setActiveTab = useUIStore(state => state.setActiveTab);
  
  const user = useAuthStore(state => state.user);
  const isGuest = useAuthStore(state => state.isGuest);
  const workspaces = useAuthStore(state => state.workspaces);
  const currentWorkspaceId = useAuthStore(state => state.currentWorkspaceId);
  const projects = useLedgerStore(state => state.projects);

  const isPrivacyMode = useUIStore(state => state.isPrivacyMode);
  const isSidebarOpen = useUIStore(state => state.isSidebarOpen);
  const toggleSidebar = useUIStore(state => state.toggleSidebar);
  const isFocusMode = useUIStore(state => state.isFocusMode);

  // Modal States
  const isCommandPaletteOpen = useUIStore(state => state.isCommandPaletteOpen);
  const setCommandPaletteOpen = useUIStore(state => state.setCommandPaletteOpen);
  
  const isShortcutOverlayOpen = useUIStore(state => state.isShortcutOverlayOpen);
  const setShortcutOverlayOpen = useUIStore(state => state.setShortcutOverlayOpen);
  
  const isGuideOpen = useUIStore(state => state.isGuideOpen);
  const setGuideOpen = useUIStore(state => state.setGuideOpen);

  const isDiagnosticConsoleOpen = useUIStore(state => state.isDiagnosticConsoleOpen);
  const setDiagnosticConsoleOpen = useUIStore(state => state.setDiagnosticConsoleOpen);

  const isDataTruncated = useLedgerStore(state => state.isDataTruncated);

  const modals = {
    commandPalette: useUIStore(state => state.isCommandPaletteOpen),
    quickEntry: useUIStore(state => state.isQuickEntryOpen),
    importer: useUIStore(state => state.isImporterOpen),
    qboMigration: useUIStore(state => (state as any).isQBOMigrationOpen),
    template: useUIStore(state => state.isTemplateSelectorOpen),
    aiBlueprint: useUIStore(state => state.isAIBlueprintOpen),
    commandCenter: useUIStore(state => state.isCommandCenterOpen),
    converter: useUIStore(state => state.isConverterOpen),
    integrity: useUIStore(state => state.isIntegrityOpen),
    healthCheck: useUIStore(state => state.isHealthCheckOpen),
    entanglement: useUIStore(state => state.isEntanglementOpen),
    architecture: useUIStore(state => state.isArchitectureOpen)
  };

  const handlers = {
    closeCommandPalette: () => useUIStore.getState().setCommandPaletteOpen(false),
    closeQuickEntry: () => useUIStore.getState().setQuickEntryOpen(false),
    closeImporter: () => useUIStore.getState().setImporterOpen(false),
    closeQBOMigration: () => (useUIStore.getState() as any).setQBOMigrationOpen(false),
    closeTemplate: () => useUIStore.getState().setTemplateSelectorOpen(false),
    closeAIBlueprint: () => useUIStore.getState().setAIBlueprintOpen(false),
    closeCommandCenter: () => useUIStore.getState().setCommandCenterOpen(false),
    closeConverter: () => useUIStore.getState().setConverterOpen(false),
    closeIntegrity: () => useUIStore.getState().setIntegrityOpen(false),
    closeHealthCheck: () => useUIStore.getState().setHealthCheckOpen(false),
    closeEntanglement: () => useUIStore.getState().setEntanglementOpen(false),
    closeArchitecture: () => useUIStore.getState().setArchitectureOpen(false),
    handleAction,
    txActions,
    handleQuickAdd: txActions?.handleQuickAdd,
    handleImportTransactions: txActions?.handleImportTransactions,
    handleOpenAIBlueprint: () => {
      useUIStore.getState().setTemplateSelectorOpen(false);
      useUIStore.getState().setAIBlueprintOpen(true);
    },
    handleAIQuery: async (q: string) => {
      if (ai?.handleAIQuery) return await ai.handleAIQuery(q);
      return { response: `Analyzed query: ${q}` };
    },
    handleFilter: (filter: any) => {
      useUIStore.getState().setFilterCriteria(filter);
      useUIStore.getState().setActiveTab('transactions' as any);
      useUIStore.getState().setCommandCenterOpen(false);
    },
    handleSelectTemplate,
    handleSaveCurrentTemplate,
    handleApplyAITemplate
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile/Tablet Backdrop Dimmer */}
        {isSidebarOpen && !isFocusMode && (
          <div role="button" tabIndex={0} 
            className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-[95] transition-opacity duration-300 animate-fade-in"
            onClick={toggleSidebar}
          />
        )}

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
        onLoginPrompt={handleLoginPrompt}
        workspaces={workspaces}
        currentWorkspaceId={currentWorkspaceId}
        onSelectWorkspace={(id) => useAuthStore.getState().setCurrentWorkspaceId(id)}
        onNewWorkspace={handleCreateWorkspace}
        projects={projects}
        onNewProject={() => setActiveTab('projects' as any)}
        onAction={handleAction}
      />

      <main className={cn(
        "flex-1 flex flex-col overflow-hidden relative transition-all duration-300 bg-[var(--ink)] text-[var(--text)] pb-[env(safe-area-inset-bottom)] lg:pb-0",
        "pb-[64px] lg:pb-0" // Add 64px padding on mobile specifically for the BottomNav
      )}>
        <ConnectionBanner />
        <LedgerBackupReminder />
        {!user && isGuest && (
          <div className="bg-purple-600/10 text-purple-800 dark:text-purple-300 border-b border-purple-500/20 px-4 py-1.5 text-xs text-center font-semibold">
            Demo data — sign up to save your own
          </div>
        )}
        {isDataTruncated && (
          <div className="bg-amber-500/10 text-amber-500 border-b border-amber-500/20 px-4 py-2 text-sm text-center font-medium">
            Showing 2,000 of N transactions — totals are incomplete without server sync.
          </div>
        )}
        {!isFocusMode && <Header onLogout={handleLogout} onLoginPrompt={handleLoginPrompt} />}
        {!isFocusMode && <ModuleSubNav activeTab={activeTab as any} onTabChange={setActiveTab as any} />}
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative custom-scrollbar">
          <MainViewSwitcher activeTab={activeTab as any} />
        </div>

      </main>

      </div>
      
      {/* Overlays & Global Components */}
      <BottomNav activeTab={activeTab as any} onTabChange={setActiveTab as any} />
         <Suspense fallback={null}><CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} onAction={handleAction} /></Suspense>
         <Suspense fallback={null}><CommandPortal modals={modals} handlers={handlers as any} /></Suspense>
         <Suspense fallback={null}><ShortcutOverlay isOpen={isShortcutOverlayOpen} onClose={() => setShortcutOverlayOpen(false)} /></Suspense>
         
         <Suspense fallback={null}><DiagnosticConsole isOpen={isDiagnosticConsoleOpen} onClose={() => setDiagnosticConsoleOpen(false)} /></Suspense>

      <Suspense fallback={null}><LedgerInterruptOverlay /></Suspense>
      <StatusBar />
    </div>
  );
}
