import React, { useState } from 'react';
import { 
  LogOut,
  Command,
  LayoutGrid,
  Briefcase,
  Layers,
  BarChart3,
  Settings,
  ShieldAlert
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';
import { Project, Workspace, AppTab } from '../../types';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { NAV_GROUPS, APP_TABS } from '../../config/registry';
import { LexiconText } from '../../hooks/useLexicon';

interface SidebarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  onLogout: () => void;
  onLoginPrompt?: () => void;
  projects: Project[];
  onNewProject: () => void;
  workspaces: Workspace[];
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

const Sidebar = React.memo(({ 
  activeTab, 
  setActiveTab, 
  onLogout, 
  workspaces, 
  currentWorkspaceId, 
  onSelectWorkspace,
  onAction 
}: SidebarProps) => {
  const uiStore = useUIStore();
  const { user } = useAuthStore();
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);

  const currentTabDef = APP_TABS.find(t => t.id === activeTab);
  const activeGroupId = currentTabDef?.groupId || 'pulse';

  return (
    <div 
      className={cn(
        "h-[100ddvh] bg-[#fdfdfc] flex flex-col z-[100] border-r border-[#e5e5e5] shrink-0 transition-all duration-300",
        "fixed lg:sticky top-0 left-0",
        uiStore.isSidebarOpen ? "w-[260px] translate-x-0 opacity-100" : "w-0 -translate-x-full opacity-0 pointer-events-none border-r-0 lg:w-[70px] lg:translate-x-0 lg:opacity-100",
        uiStore.language === 'he' && "rtl"
      )}
    >
      {/* Brand */}
      <div className="h-16 flex items-center justify-center lg:justify-start px-5 shrink-0 border-b border-[#e5e5e5]">
        <div className="flex items-center gap-3 w-full">
           <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white shrink-0 shadow-sm">
              <Briefcase size={16} />
           </div>
           {uiStore.isSidebarOpen && (
             <div className="overflow-hidden">
                <h1 className="text-[14px] font-semibold text-black tracking-tight leading-none truncate">
                  <LexiconText cardKey="appName" defaultVal="LedgerFlow Zenith" />
                </h1>
                <p className="text-[11px] text-gray-500 mt-1 truncate font-medium">Corporate Portal</p>
             </div>
           )}
        </div>
      </div>

      {/* Main Nav (Groups Only) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5 mt-2">
         {Object.entries(NAV_GROUPS).map(([groupId, groupLabel]) => {
            if (groupId === 'admin' && user?.email !== 'shmuelbiller@gmail.com') return null;

            const Icon = GROUP_ICONS[groupId] || LayoutGrid;
            const isActive = activeGroupId === groupId;
            // When clicking a group, navigate to its first available tab
            const firstTabInGroup = APP_TABS.find(t => t.groupId === groupId);

            return (
              <button
                key={groupId}
                onClick={() => {
                  if (firstTabInGroup) setActiveTab(firstTabInGroup.id as any);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all relative group overflow-hidden",
                  isActive
                    ? "text-black bg-black/5"
                    : "text-gray-500 hover:bg-black/5 hover:text-black"
                )}
                title={uiStore.isSidebarOpen ? undefined : groupLabel[uiStore.language as 'en' | 'he'] || groupLabel.en}
              >
                <Icon size={18} className={cn("shrink-0", isActive ? "text-black" : "text-gray-400 group-hover:text-black")} strokeWidth={isActive ? 2.5 : 2} />
                {uiStore.isSidebarOpen && (
                  <span className="truncate">
                    {groupLabel[uiStore.language as 'en' | 'he'] || groupLabel.en}
                  </span>
                )}
              </button>
            );
         })}
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-[#e5e5e5] shrink-0 space-y-1">
         <button
            onClick={() => onAction('open-command-palette')}
           className={cn(
             "w-full flex items-center px-3 py-2.5 rounded-xl text-[13px] font-medium text-gray-500 hover:bg-black/5 transition-all group",
             uiStore.isSidebarOpen ? "justify-between" : "justify-center"
           )}
           title={uiStore.isSidebarOpen ? undefined : "Global Search"}
         >
           <span className="flex items-center gap-3 group-hover:text-black">
             <Command size={18} className="shrink-0 text-gray-400 group-hover:text-black transition-colors" strokeWidth={2} /> 
             {uiStore.isSidebarOpen && <span>Search</span>}
           </span>
           {uiStore.isSidebarOpen && <span className="text-[10px] font-mono text-gray-400">⌘K</span>}
         </button>
         
         {user && (
           <button
              onClick={onLogout}
             className={cn(
               "flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium text-gray-500 hover:text-red-600 rounded-xl hover:bg-red-50 transition-all w-full group",
               !uiStore.isSidebarOpen && "justify-center"
             )}
             title={uiStore.isSidebarOpen ? undefined : "Log Out"}
           >
             <LogOut size={18} className="shrink-0 text-gray-400 group-hover:text-red-600 transition-colors" strokeWidth={2} />
             {uiStore.isSidebarOpen && <span>Log Out</span>}
           </button>
         )}
      </div>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';
export default Sidebar;
