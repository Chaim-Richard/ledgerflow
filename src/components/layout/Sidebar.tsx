import React from 'react';
import { 
  LogOut,
  Command,
  LayoutGrid,
  Briefcase,
  Layers,
  BarChart3,
  Settings,
  ShieldAlert,
  Compass
} from 'lucide-react';
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
  projects: any[];
  onNewProject: () => void;
  workspaces: any[];
  currentWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  onNewWorkspace: () => void;
  onAction: (action: string) => void;
}

const GROUP_ICONS: Record<string, any> = {
  pulse: LayoutGrid,
  finance: Layers,
  operations: Briefcase,
  planning: BarChart3,
  system: Settings,
  admin: ShieldAlert
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
  onAction 
}: SidebarProps) => {
  const uiStore = useUIStore();
  const { isInstallable, promptInstall } = usePWAInstall();
  const user = useAuthStore(s => s.user);
  const userProfile = useAuthStore(s => s.userProfile);
  const realProjects = useLedgerStore(s => s.projects);
  const accounts = useLedgerStore(s => s.accounts);

  const currentTabDef = APP_TABS.find(t => t.id === activeTab);
  const activeGroupId = currentTabDef?.groupId || 'pulse';

  const worldItems = React.useMemo(() => {
    if (realProjects && realProjects.length > 0) {
      return realProjects.map((p, idx) => ({
        id: p.id,
        name: p.name,
        color: (p as any).color || WORLD_COLORS[idx % WORLD_COLORS.length],
        val: formatCurrency(p.budgetCents || (p as any).spentCents || 0)
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
        "h-[100dvh] bg-[var(--surface)] text-[var(--text)] flex flex-col z-[100] border-r border-[var(--line)] shrink-0 transition-all duration-300",
        "fixed lg:sticky top-0 left-0",
        uiStore.isSidebarOpen ? "w-[240px] translate-x-0 opacity-100" : "w-0 -translate-x-full opacity-0 pointer-events-none border-r-0 lg:w-[70px] lg:translate-x-0 lg:opacity-100",
        uiStore.language === 'he' && "rtl"
      )}
    >
      {/* Brand */}
      <div className="h-16 flex items-center justify-between px-4 shrink-0 border-b border-[var(--line)]">
        <div className="flex items-center gap-3 overflow-hidden">
           <div className="w-8 h-8 rounded-lg bg-[var(--brass-soft)] border border-[var(--brass-line)] flex items-center justify-center text-[var(--brass)] shrink-0 shadow-sm">
              <Compass size={18} className="animate-spin-slow" />
           </div>
           {uiStore.isSidebarOpen && (
             <div className="overflow-hidden">
                <h1 className="text-[15px] font-bold text-[var(--text)] tracking-tight leading-none truncate">
                  LedgerFlow
                </h1>
                <p className="text-[10px] font-mono text-[var(--faint)] mt-1 truncate uppercase tracking-wider">Financial Intelligence Ledger</p>
             </div>
           )}
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4 mt-1">
         <div>
            {uiStore.isSidebarOpen && (
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-[var(--faint)] px-2 mb-2 font-semibold">Navigate</h4>
            )}
            <div className="space-y-1">
              {Object.entries(NAV_GROUPS).map(([groupId, groupLabel]) => {
                 if (groupId === 'admin' && userProfile?.role !== 'admin') return null;

                 const Icon = GROUP_ICONS[groupId] || LayoutGrid;
                 const isActive = activeGroupId === groupId;
                 const firstTabInGroup = APP_TABS.find(t => t.groupId === groupId);

                 return (
                   <button
                     key={groupId}
                     onClick={() => {
                       if (firstTabInGroup) setActiveTab(firstTabInGroup.id as any);
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
                     <span className="font-mono text-[11px] text-[var(--muted)]">{w.val}</span>
                   </div>
                 ))}
              </div>
           </div>
         )}
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-[var(--line)] shrink-0 space-y-1 bg-[var(--surface)]">
         <button
            onClick={() => onAction('open-command-palette')}
           className={cn(
             "w-full flex items-center px-3 py-2 rounded-lg text-[12.5px] font-medium text-[var(--muted)] hover:bg-[var(--elevated)] hover:text-[var(--text)] transition-all group",
             uiStore.isSidebarOpen ? "justify-between" : "justify-center"
           )}
           title={uiStore.isSidebarOpen ? undefined : "Global Coordinate Search"}
         >
           <span className="flex items-center gap-2.5">
             <Command size={16} className="shrink-0 text-[var(--faint)] group-hover:text-[var(--text)] transition-colors" /> 
             {uiStore.isSidebarOpen && <span>Command Bar</span>}
           </span>
           {uiStore.isSidebarOpen && <span className="text-[10px] font-mono text-[var(--faint)] border border-[var(--line)] rounded px-1">⌘K</span>}
         </button>
         
         {isInstallable && (
           <button
             onClick={promptInstall}
             className={cn(
               "flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-medium text-[var(--muted)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-hover)] transition-all w-full group mb-1",
               !uiStore.isSidebarOpen && "justify-center"
             )}
             title={uiStore.isSidebarOpen ? undefined : "Install App"}
           >
             <Download size={16} className="shrink-0 text-[var(--faint)] group-hover:text-[var(--text)] transition-colors" />
             {uiStore.isSidebarOpen && <span>Install App</span>}
           </button>
         )}
         {user && (
           <button
             onClick={onLogout}
             className={cn(
               "flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-medium text-[var(--muted)] hover:text-red-400 rounded-lg hover:bg-rose-500/10 transition-all w-full group",
               !uiStore.isSidebarOpen && "justify-center"
             )}
             title={uiStore.isSidebarOpen ? undefined : "Log Out"}
           >
             <LogOut size={16} className="shrink-0 text-[var(--faint)] group-hover:text-red-400 transition-colors" />
             {uiStore.isSidebarOpen && <span>Log Out</span>}
           </button>
         )}
      </div>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';
export default Sidebar;

