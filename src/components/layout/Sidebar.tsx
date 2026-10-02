import React from 'react';
import { RefreshCw, LogOut, Command, LayoutGrid, Layers, BarChart3, Settings, ShieldCheck, Compass, ChevronDown, Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { AppTab } from '../../types';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Download } from 'lucide-react';
import { NAV_GROUPS, APP_TABS } from '../../config/registry';

interface SidebarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  onLogout: () => void;
  onLoginPrompt?: () => void;
  projects: import("../../types").Project[];
  onNewProject: () => void;
  workspaces: import("../../types").Workspace[];
  currentWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  onNewWorkspace: () => void;
  onAction: (action: string) => void;
}

const GROUP_ICONS: Record<string, React.ElementType> = {
  dashboard: LayoutGrid,
  transactions: Layers,
  reconcile: RefreshCw,
  money_in: ArrowUpRight,
  money_out: ArrowDownRight,
  reports: BarChart3,
  settings: Settings
};

const WORLD_COLORS = [
  'var(--w-personal)',
  'var(--w-charity)',
  'var(--w-book)',
  'var(--w-estate)'
];

const Sidebar = React.memo(({ 
  activeTab, 
  setActiveTab, 
  onLogout, 
  onLoginPrompt,
  workspaces,
  currentWorkspaceId,
  onSelectWorkspace,
  onNewWorkspace,
  onAction 
}: SidebarProps) => {
  const uiStore = useUIStore();
  const { isInstallable, promptInstall } = usePWAInstall();
  const user = useAuthStore(s => s.user);
  useAuthStore(s => s.userProfile);
  const isAdmin = useAuthStore(s => s.isAdmin);
  const realProjects = useLedgerStore(s => s.projects);
  const rawAccounts = useLedgerStore(s => s.accounts);
  const computedAccounts = useLedgerStore(s => s.computedAccounts);
  const accounts = computedAccounts && computedAccounts.length > 0 ? computedAccounts : rawAccounts;

  const currentTabDef = APP_TABS.find(t => t.id === activeTab);
  const activeGroupId = currentTabDef?.groupId || 'dashboard';

  const worldItems = React.useMemo(() => {
    if (realProjects && realProjects.length > 0) {
      return realProjects.map((p, idx) => ({
        id: p.id,
        name: p.name,
        color: (p as typeof p & { color?: string; spentCents?: number }).color || WORLD_COLORS[idx % WORLD_COLORS.length],
        val: formatCurrency(p.budgetCents || (p as typeof p & { color?: string; spentCents?: number }).spentCents || 0)
      }));
    }

    const typeTotals: Record<string, number> = {};
    accounts.forEach(acc => {
      const typeLabel = acc.type.toUpperCase();
      typeTotals[typeLabel] = (typeTotals[typeLabel] || 0) + Math.abs(acc.balanceCents || 0);
    });

    if (Object.keys(typeTotals).length > 0) {
      return Object.entries(typeTotals).slice(0, 4).map(([name, total], idx) => ({
        id: name,
        name: name.charAt(0) + name.slice(1).toLowerCase(),
        color: WORLD_COLORS[idx % WORLD_COLORS.length],
        val: formatCurrency(total)
      }));
    }

    return [
      { id: '1', name: 'Main Ledger', color: WORLD_COLORS[0], val: formatCurrency(0) }
    ];
  }, [realProjects, accounts]);

  return (
    <div 
      className={cn(
        "h-[100dvh] lg:h-full bg-[var(--surface)] text-[var(--text)] flex flex-col z-[100] border-r border-[var(--line)] shrink-0 transition-all duration-300",
        "fixed lg:sticky top-0 left-0",
        uiStore.isSidebarOpen ? "w-[240px] translate-x-0 opacity-100" : "w-0 -translate-x-full opacity-0 pointer-events-none border-r-0 lg:w-[70px] lg:translate-x-0 lg:opacity-100"
      )}
    >
      {/* Brand & Workspace Switcher */}
      <div className="h-16 flex items-center px-4 shrink-0 border-b border-[var(--line)]">
        {uiStore.isSidebarOpen ? (
          <div className="w-full relative group/workspace cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--brass-soft)] border border-[var(--brass-line)] flex items-center justify-center text-[var(--brass)] shrink-0 shadow-sm">
                 <Compass aria-hidden="true" size={18} className="animate-spin-slow" />
              </div>
              <div className="flex-1 overflow-hidden">
                 <div className="flex items-center justify-between">
                   <h1 className="text-[14px] font-bold text-[var(--text)] tracking-tight leading-none truncate">
                     {workspaces.find(w => w.id === currentWorkspaceId)?.name || 'LedgerFlow'}
                   </h1>
                   <ChevronDown aria-hidden="true" size={14} className="text-[var(--faint)] group-hover/workspace:text-[var(--text)] transition-colors" />
                 </div>
                 <p className="text-[10px] font-mono text-[var(--faint)] mt-1 truncate uppercase tracking-wider">Workspace</p>
              </div>
            </div>
            {/* Workspace Dropdown */}
            <div className="absolute top-full left-0 mt-1 w-full bg-[var(--surface)] border border-[var(--line)] rounded-lg shadow-xl opacity-0 invisible group-hover/workspace:opacity-100 group-hover/workspace:visible transition-all z-50 py-1">
              {workspaces.map(w => (
                <button
                  key={w.id}
                  onClick={() => onSelectWorkspace(w.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-[13px] hover:bg-[var(--elevated)] transition-colors truncate",
                    currentWorkspaceId === w.id ? "text-[var(--brass)] font-semibold" : "text-[var(--text)]"
                  )}
                >
                  {w.name}
                </button>
              ))}
              <div className="h-px bg-[var(--line)] my-1" />
              <button
                onClick={onNewWorkspace}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--elevated)] transition-colors"
               aria-label="New Workspace">
                <Plus aria-hidden="true" size={14} />
                <span>New Workspace</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full">
            <div className="w-8 h-8 rounded-lg bg-[var(--brass-soft)] border border-[var(--brass-line)] flex items-center justify-center text-[var(--brass)] shrink-0 shadow-sm" title={workspaces.find(w => w.id === currentWorkspaceId)?.name || 'LedgerFlow'}>
              <Compass aria-hidden="true" size={18} className="animate-spin-slow" />
            </div>
          </div>
        )}
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4 mt-1">
         <div>
            {uiStore.isSidebarOpen && (
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-[var(--faint)] px-2 mb-2 font-semibold">Navigate</h4>
            )}
            <div className="space-y-1">
              {Object.entries(NAV_GROUPS).map(([groupId, groupLabel]) => {
                 if (groupId === 'admin' && !isAdmin) return null;

                 const Icon = GROUP_ICONS[groupId] || LayoutGrid;
                 const isActive = activeGroupId === groupId;
                 const firstTabInGroup = APP_TABS.find(t => t.groupId === groupId && (!t.isAdvanced || uiStore.isProMode));

                 return (
                   <button aria-label={groupLabel[uiStore.language as "en" | "he"] || groupLabel.en}
                     key={groupId}
                     data-testid={`nav-${firstTabInGroup?.id || groupId}`}
                     onClick={() => {
                       if (firstTabInGroup) setActiveTab(firstTabInGroup.id as unknown as string);
                     }}
                     className={cn(
                       "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all relative group overflow-hidden",
                       isActive
                         ? "text-[var(--text)] bg-[var(--brass-soft)] border border-[var(--brass-line)]"
                         : "text-[var(--muted)] hover:bg-[var(--elevated)] hover:text-[var(--text)]"
                     )}
                     title={uiStore.isSidebarOpen ? undefined : groupLabel[uiStore.language as 'en' | 'he'] || groupLabel.en}
                   >
                     <Icon size={16} className={cn("shrink-0", isActive ? "text-[var(--brass)]" : "text-[var(--faint)] group-hover:text-[var(--text)]")} strokeWidth={isActive ? 2.5 : 2} />
                     {uiStore.isSidebarOpen && (
                       <span className="truncate">
                         {groupLabel[uiStore.language as 'en' | 'he'] || groupLabel.en}
                       </span>
                     )}
                   </button>
                 );
              })}
            </div>
         </div>

         {/* Worlds Rail Section */}
         {uiStore.isSidebarOpen && (
           <div className="pt-2 border-t border-[var(--line)]">
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-[var(--faint)] px-2 mb-2 font-semibold">Worlds</h4>
              <div className="space-y-1">
                 {worldItems.map((w) => (
                   <div 
                     key={w.id || w.name}
                     className="flex items-center justify-between px-3 py-1.5 rounded-md hover:bg-[var(--elevated)] text-[12.5px] cursor-pointer transition-colors"
                   >
                     <div className="flex items-center gap-2.5 truncate">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: w.color }} />
                        <span className="truncate text-[var(--text)]">{w.name}</span>
                     </div>
                     <span className="font-mono text-[11px] text-[var(--muted)] tabular-nums">{w.val}</span>
                   </div>
                 ))}
              </div>
           </div>
         )}
      </div>

      {/* Bottom Actions */}
      <div className="p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:pb-3 border-t border-[var(--line)] shrink-0 space-y-1 bg-[var(--surface)]">
         <button
            onClick={() => onAction('open-command-palette')}
           className={cn(
             "w-full flex items-center px-3 py-2 rounded-lg text-[12.5px] font-medium text-[var(--muted)] hover:bg-[var(--elevated)] hover:text-[var(--text)] transition-all group",
             uiStore.isSidebarOpen ? "justify-between" : "justify-center"
           )}
           title={uiStore.isSidebarOpen ? undefined : "Global Coordinate Search"}
         >
           <span className="flex items-center gap-2.5">
             <Command aria-hidden="true" size={16} className="shrink-0 text-[var(--faint)] group-hover:text-[var(--text)] transition-colors" />
             {uiStore.isSidebarOpen && <span>Command Bar</span>}
           </span>
           {uiStore.isSidebarOpen && <span className="text-[10px] font-mono text-[var(--faint)] border border-[var(--line)] rounded px-1">⌘K</span>}
         </button>
         
         {isAdmin && uiStore.developerMode && (
           <button
             onClick={() => setActiveTab('system-command-center' as unknown as string)}
             className={cn(
               "flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-all w-full group mb-1 shadow-sm cursor-pointer",
               uiStore.isSidebarOpen ? "justify-between" : "justify-center",
               activeTab === 'system-command-center' && "bg-amber-500/25 border-amber-400 text-amber-200"
             )}
             title={uiStore.isSidebarOpen ? undefined : "Admin Control Panel"}
           >
             <div className="flex items-center gap-2.5">
               <ShieldCheck aria-hidden="true" size={16} className="shrink-0 text-amber-400 group-hover:scale-110 transition-transform" />
               {uiStore.isSidebarOpen && <span>Admin Panel</span>}
             </div>
             {uiStore.isSidebarOpen && (
               <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase tracking-wider">
                 Admin
               </span>
             )}
           </button>
         )}

         {isInstallable && (
           <button
             onClick={promptInstall}
             className={cn(
               "flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 rounded-lg transition-all w-full group mb-1 shadow-sm",
               uiStore.isSidebarOpen ? "justify-between" : "justify-center"
             )}
             title={uiStore.isSidebarOpen ? undefined : "Install App"}
            aria-label="Install App">
             <div className="flex items-center gap-2.5">
               <Download aria-hidden="true" size={16} className="shrink-0 text-emerald-400 group-hover:scale-110 transition-transform" />
               {uiStore.isSidebarOpen && <span>Install App</span>}
             </div>
             {uiStore.isSidebarOpen && (
               <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                 App
               </span>
             )}
           </button>
         )}
         <button
           onClick={user ? onLogout : (onLoginPrompt || onLogout)}
           className={cn(
             "flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-medium text-[var(--muted)] hover:text-red-400 rounded-lg hover:bg-rose-500/10 transition-all w-full group",
             !uiStore.isSidebarOpen && "justify-center"
           )}
           title={uiStore.isSidebarOpen ? undefined : (user ? "Log Out" : "Exit Guest / Sign In")}
          aria-label="Log Out">
           <LogOut aria-hidden="true" size={16} className="shrink-0 text-[var(--faint)] group-hover:text-red-400 transition-colors" />
           {uiStore.isSidebarOpen && <span>{user ? "Log Out" : "Exit Guest / Sign In"}</span>}
         </button>
      </div>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';
export default Sidebar;

