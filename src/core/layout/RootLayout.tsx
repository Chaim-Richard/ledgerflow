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
import ContextualToolbelt from '../../components/layout/ContextualToolbelt';
import LedgerInterruptOverlay from '../../components/forensics/LedgerInterruptOverlay';
import { ProtocolGuard } from '../../components/forensics/ProtocolGuard';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useUIStore } from '../../stores/useUIStore';

const ShortcutOverlay = React.lazy(() => import('../../components/layout/ShortcutOverlay'));
const InstructionGuide = React.lazy(() => import('../../components/layout/InstructionGuide'));
const DiagnosticConsole = React.lazy(() => import('../../components/intelligence/DiagnosticConsole'));

export function RootLayout({ 
  handleAction, 
  coreSystemProps, 
  handleLogout, 
  handleLoginPrompt,
  portalData, 
  isPending, 
  txActions,
  ai,
  handleSelectTemplate,
  handleSaveCurrentTemplate,
  handleApplyAITemplate,
  handleCreateWorkspace
}: any) {
  const activeTab = useUIStore(state => state.activeTab);
  const setActiveTab = useUIStore(state => state.setActiveTab);
  
  const workspaces = useAuthStore(state => state.workspaces);
  const currentWorkspaceId = useAuthStore(state => state.currentWorkspaceId);
  const setCurrentWorkspaceId = useAuthStore(state => state.setCurrentWorkspaceId);
  const user = useAuthStore(state => state.user);
  
  const projects = useLedgerStore(state => state.projects);
  const isPrivacyMode = useLedgerStore(state => state.isPrivacyMode);
  const setPrivacyMode = useLedgerStore(state => state.setPrivacyMode);
  const integrityStatus = useLedgerStore(state => state.integrityStatus);
  const reconcileIntegrity = useLedgerStore(state => state.reconcileIntegrity);

  const isFocusMode = useUIStore(state => state.isFocusMode);
  const isSidebarOpen = useUIStore(state => state.isSidebarOpen);
  const toggleSidebar = useUIStore(state => state.toggleSidebar);
  const isGuideOpen = useUIStore(state => state.isGuideOpen);
  const setGuideOpen = useUIStore(state => state.setGuideOpen);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile/Tablet Backdrop Dimmer */}
        {isSidebarOpen && !isFocusMode && (
          <div 
            className="lg:hidden fixed inset-0 bg-black/55 backdrop-blur-xs z-[95] transition-opacity duration-300 animate-fade-in"
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
        onSelectWorkspace={(id) => setCurrentWorkspaceId(id)}
        onNewWorkspace={handleCreateWorkspace}
        projects={projects}
        onNewProject={() => setActiveTab('projects')}
        onAction={handleAction}
      />

      <main className={cn(
        "flex-1 flex flex-col overflow-hidden relative transition-all duration-300 bg-[#fbfbfc] pb-[env(safe-area-inset-bottom)] lg:pb-0",
        "pb-[64px] lg:pb-0" // Add 64px padding on mobile specifically for the BottomNav
      )}>
        {!isFocusMode && <Header />}
        {!isFocusMode && <ModuleSubNav activeTab={activeTab} onTabChange={setActiveTab} />}
        
        {!isFocusMode && (<ContextualToolbelt 
        activeTab={activeTab}
        currentWorkspaceId={currentWorkspaceId}
        onAction={handleAction}
        isPrivacyMode={isPrivacyMode}
        onTogglePrivacy={() => setPrivacyMode(!isPrivacyMode)}
        onTriggerReconcile={reconcileIntegrity}
        isConsistent={integrityStatus.isConsistent}
      />)}

        {isFocusMode && (
          <div className="fixed right-6 top-6 z-[999] flex items-center md:right-8 md:top-8 pointer-events-auto">
            <button 
              onClick={() => handleAction('toggle-focus-mode')}
              className="flex items-center gap-2 px-5 py-3 bg-google-blue border border-slate-800 text-white hover:bg-slate-800 rounded-xl text-xs font-medium uppercase tracking-wider transition-all shadow-lg hover:shadow-xl cursor-pointer select-none active:scale-95"
              title="Minimize View & Re-expand Workspace"
            >
              <Minimize2 size={13} className="text-slate-300 animate-pulse" />
              <span>Restore Side Panel & Tools</span>
            </button>
          </div>
        )}

        <div className={cn(
          "flex-1 flex flex-col overflow-auto scrollbar-thin relative",
          isFocusMode ? "p-4 md:p-8 lg:p-12 min-h-0 max-w-[1400px] mx-auto w-full" : "p-0 min-h-0"
        )}>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              transition={{ duration: 0.4, ease: [0.19, 1, 0.22, 1] }}
              className="flex-1 flex flex-col w-full h-full"
            >
              <ProtocolGuard>
                <MainViewSwitcher activeTab={activeTab} props={coreSystemProps} />
              </ProtocolGuard>
            </motion.div>
          </AnimatePresence>
        </div>
      
      </main>

      {!isFocusMode && <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />}

      {/* Command Layer Portals */}
      <CommandPalette 
        isOpen={useUIStore(state => state.isCommandPaletteOpen)}
        onClose={() => useUIStore.getState().setCommandPaletteOpen(false)}
        onAction={handleAction}
      />
      
      <CommandPortal 
        modals={{
          commandPalette: false, // Disabling old command palette in favor of CortexSearch
          quickEntry: useUIStore(state => state.isQuickEntryOpen),
          importer: useUIStore(state => state.isImporterOpen),
          template: useUIStore(state => state.isTemplateSelectorOpen),
          aiBlueprint: useUIStore(state => state.isAIBlueprintOpen),
          commandCenter: useUIStore(state => state.isCommandCenterOpen),
          converter: useUIStore(state => state.isConverterOpen),
          integrity: useUIStore(state => state.isIntegrityOpen),
          entanglement: useUIStore(state => state.isEntanglementOpen),
          architecture: useUIStore(state => state.isArchitectureOpen)
        }}
        handlers={{
          closeCommandPalette: () => useUIStore.getState().setCommandPaletteOpen(false),
          closeQuickEntry: () => useUIStore.getState().setQuickEntryOpen(false),
          closeImporter: () => useUIStore.getState().setImporterOpen(false),
          closeTemplate: () => useUIStore.getState().setTemplateSelectorOpen(false),
          closeCommandCenter: () => useUIStore.getState().setCommandCenterOpen(false),
          closeConverter: () => useUIStore.getState().setConverterOpen(false),
          closeAIBlueprint: () => useUIStore.getState().setAIBlueprintOpen(false),
          closeIntegrity: () => useUIStore.getState().setIntegrityOpen(false),
          closeEntanglement: () => useUIStore.getState().setEntanglementOpen(false),
          closeArchitecture: () => useUIStore.getState().setArchitectureOpen(false),
          handleAIQuery: ai.handleAIQuery,
          handleFilter: (criteria: any) => {
            useUIStore.getState().setFilterCriteria(criteria);
            useUIStore.getState().setActiveTab('transactions');
          },
          handleQuickAdd: txActions.handleQuickAdd,
          handleImportTransactions: txActions.handleImportTransactions,
          handleIntegrityAction: txActions.handleIntegrityAction,
          handleSelectTemplate: handleSelectTemplate,
          handleOpenAIBlueprint: () => useUIStore.getState().setAIBlueprintOpen(true),
          handleSaveCurrentTemplate: handleSaveCurrentTemplate,
          handleApplyAITemplate: handleApplyAITemplate
        }}
        data={portalData}
      />

      <LedgerInterruptOverlay />
      
      <Suspense fallback={null}>
        {useUIStore(state => state.isShortcutOverlayOpen) && (
          <ShortcutOverlay 
            isOpen={true}
            onClose={() => useUIStore.getState().setShortcutOverlayOpen(false)}
          />
        )}
        {useUIStore(state => state.isDiagnosticConsoleOpen) && (
          <DiagnosticConsole 
            isOpen={true} 
            onClose={() => useUIStore.getState().setDiagnosticConsoleOpen(false)} 
          />
        )}
        {isGuideOpen && (
          <InstructionGuide isOpen={isGuideOpen} onClose={() => setGuideOpen(false)} />
        )}
      </Suspense>

      </div>
      <StatusBar />
    </div>
  );
}
