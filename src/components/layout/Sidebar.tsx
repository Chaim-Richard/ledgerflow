import React, { useState } from 'react';
import { 
  LogOut,
  Briefcase,
  ChevronDown,
  Command,
  Home,
  Database,
  Building2,
  Target,
  Settings,
  LogIn,
  ShieldAlert
, Moon, Sun } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Project, Workspace, AppTab } from '../../types';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { getVisibleTabs } from '../../config/registry';
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
  const { user, userProfile } = useAuthStore();
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    primary: true,
    pulse: true,
    finance: true,
    operations: true,
    strategy: true,
    core: true,
    activity: true,
    planning: true,
    system: true,
    admin: true
  });

  const isOwner = user?.email?.toLowerCase() === 'shmuelbiller@gmail.com' || userProfile?.role === 'admin';
  const groups = getVisibleTabs(uiStore.language, isOwner, uiStore.hiddenTabs);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleItemClick = (tabId: AppTab) => {
    setActiveTab(tabId);
    if (window.innerWidth < 1024 && uiStore.isSidebarOpen) {
      uiStore.toggleSidebar();
    }
  };
  
  return (
      <div 
        id="sidebar-container"
        className={cn(
          "h-[100ddvh] bg-slate-50 flex flex-col z-[100] border-r border-slate-200 overflow-hidden shrink-0 transition-all duration-300",
          "fixed lg:sticky top-0 left-0",
          uiStore.isSidebarOpen ? "translate-x-0 opacity-100" : "w-0 -translate-x-full opacity-0 pointer-events-none border-r-0 lg:w-0",
          uiStore.language === 'he' && "rtl"
        )}
        style={{
          width: uiStore.isSidebarOpen ? '290px' : '0px'
        }}
      >
        {/* Brand */}
        <div className="h-16 flex items-center px-6 shrink-0 border-b border-slate-200">
          <div className="flex items-center gap-3 w-full">
             <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-google-blue to-[#6366f1] flex items-center justify-center text-white shadow-sm"><Briefcase size={16} /></div>
             <div>
                <h1 className="text-[15px] font-medium text-slate-800 tracking-tight leading-none">
                  <LexiconText cardKey="appName" defaultVal="LedgerFlow" />
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">Corporate Portal</p>
             </div>
          </div>
        </div>

      {/* Workspace Selector */}
      <div className="px-4 py-3 shrink-0 border-b border-slate-200">
        <button 
          onClick={() => setIsWorkspaceMenuOpen(!isWorkspaceMenuOpen)}
          className={cn(
            "w-full flex justify-between p-3 rounded-[32px] border transition-all text-left group",
            isWorkspaceMenuOpen 
              ? "bg-white border-indigo-600 shadow-[0_1px_3px_0_rgba(60,64,67,0.3)] ring-1 ring-indigo-600" 
              : "bg-transparent border-transparent hover:bg-black/5"
          )}
        >
          <div className="flex flex-col w-full">
             <div className="flex items-center justify-between w-full mb-1">
               <span className={cn(
                 "text-[11px] font-medium tracking-wide transition-colors uppercase",
                 isWorkspaceMenuOpen ? "text-indigo-600" : "text-slate-500"
               )}>
                 <LexiconText cardKey="sidebar.workspaceLabel" defaultVal="Active Workspace" />
               </span>
               <div className="flex items-center gap-1.5">
                 <span className={cn(
                   "w-1.5 h-1.5 rounded-full animate-pulse", 
                   currentWorkspaceId ? "bg-emerald-500" : "bg-amber-500"
                 )} />
               </div>
             </div>
             
             <div className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "p-1.5 rounded-full shrink-0",
                    isWorkspaceMenuOpen ? "bg-blue-50 text-indigo-600" : "bg-transparent text-slate-600"
                  )}>
                    <Briefcase size={14} strokeWidth={2} />
                  </div>
                  <span className={cn(
                    "text-[13px] font-medium truncate max-w-[130px]",
                    isWorkspaceMenuOpen ? "text-slate-800" : "text-slate-700 group-hover:text-slate-800"
                  )}>
                    {workspaces.find(w => w.id === currentWorkspaceId)?.name || (
                      <LexiconText cardKey="sidebar.selectWorkspace" defaultVal="Select Workspace" />
                    )}
                  </span>
                </div>
                <ChevronDown size={14} className={cn("transition-transform duration-300", 
                  isWorkspaceMenuOpen ? "rotate-180 text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                )} />
             </div>
          </div>
        </button>

        <AnimatePresence>
          {isWorkspaceMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -5, scale: 0.98 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: -5, scale: 0.98 }}
              className="mt-2 border border-slate-200 rounded-[32px] shadow-google-md bg-white overflow-hidden absolute w-[calc(100%-2rem)] z-[200] origin-top"
            >
              <div className="px-3 py-2 border-b border-slate-100 flex justify-between items-center">
                <span className="text-xs font-medium text-slate-500 tracking-normal">Select Operation</span>
                <span className="text-xs text-slate-400">{workspaces.length} Nodes</span>
              </div>
              <div className="max-h-64 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                {workspaces.map(w => (
                  <button
                    key={w.id}
                    onClick={() => { onSelectWorkspace(w.id); setIsWorkspaceMenuOpen(false); }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-full transition-all",
                      currentWorkspaceId === w.id 
                        ? "bg-blue-50 text-indigo-600" 
                        : "bg-white text-slate-600 hover:bg-black/5"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-1.5 rounded-full shrink-0",
                        currentWorkspaceId === w.id ? "bg-white shadow-sm text-indigo-600" : "text-slate-400"
                      )}>
                        <Briefcase size={12} strokeWidth={2.5} />
                      </div>
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-medium truncate max-w-[120px]">{w.name}</span>
                        {w.businessType && (
                          <span className={cn(
                            "text-[10px] tracking-normal truncate max-w-[120px]",
                            currentWorkspaceId === w.id ? "text-blue-600/70" : "text-slate-400"
                          )}>
                            {w.businessType}
                          </span>
                        )}
                      </div>
                    </div>
                    {currentWorkspaceId === w.id ? (
                      <span className="flex h-1.5 w-1.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-900 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-900"></span>
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
              <div className="p-2 border-t border-slate-100 bg-slate-50 grid grid-cols-2 gap-2">
                 <button onClick={() => { onNewWorkspace(); setIsWorkspaceMenuOpen(false); }} className="py-2 px-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-full text-xs font-medium text-slate-700 transition-all text-center flex justify-center items-center gap-1.5">
                   <LexiconText cardKey="sidebar.new" defaultVal="New Node" />
                 </button>
                 <button onClick={() => { onAction('select-architecture'); setIsWorkspaceMenuOpen(false); }} className="py-2 px-2 bg-slate-900 hover:bg-blue-700 rounded-full text-xs font-medium text-white transition-all text-center flex justify-center items-center gap-1.5">
                   <LexiconText cardKey="sidebar.setup" defaultVal="Setup" />
                 </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation Matrix */}
      <div className="flex-1 overflow-y-auto py-4 px-3 custom-scrollbar space-y-1">
         {currentWorkspaceId ? (
           groups.map((group) => {
             // Determine if this group is active by checking if the activeTab is in it
             const isActiveGroup = group.items.some(item => item.id === activeTab);
             const firstItem = group.items[0];
             
             // Base icon mapping for groups
             let GroupIcon = firstItem?.icon;
             if (group.id === 'pulse') GroupIcon = Home;
             if (group.id === 'finance') GroupIcon = Database;
             if (group.id === 'operations') GroupIcon = Building2;
             if (group.id === 'strategy') GroupIcon = Briefcase;
             if (group.id === 'planning') GroupIcon = Target;
             if (group.id === 'system') GroupIcon = Settings;
             if (group.id === 'admin') GroupIcon = ShieldAlert;
             
             return (
               <button
                 key={group.id}
                 onClick={() => {
                   if (firstItem) handleItemClick(firstItem.id as any);
                 }}
                 className={cn(
                   "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all relative group overflow-hidden mb-1",
                   isActiveGroup
                     ? "text-indigo-600"
                     : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                 )}
               >
                 {isActiveGroup && (
                   <motion.div 
                     layoutId="sidebar-active-group"
                     className="absolute inset-0 bg-blue-50 border border-blue-100/50 rounded-xl z-0"
                     transition={{ type: "spring", stiffness: 300, damping: 25 }}
                   />
                 )}
                 <div className="relative z-10 flex items-center gap-3">
                   {GroupIcon && <GroupIcon size={18} className={cn("transition-colors", isActiveGroup ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600")} strokeWidth={isActiveGroup ? 2.5 : 2} />}
                   <LexiconText cardKey={`sidebar.group.${group.id}`} defaultVal={group.label} className="truncate tracking-wide" />
                 </div>
               </button>
             );
           })
         ) : (
           <div className="h-full flex items-center justify-center px-6 text-center text-xs text-slate-500 leading-relaxed font-medium">
             <LexiconText cardKey="sidebar.selectWorkspaceNotice" defaultVal="Select a workspace to access operations and insights." />
           </div>
         )}
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-slate-200 shrink-0 space-y-1">
         <button 
           onClick={() => onAction('open-command-palette')}
           className="w-full flex items-center justify-between px-3 py-2 rounded-full text-xs font-medium text-slate-600 hover:bg-black/5 transition-all cursor-pointer group"
         >
           <span className="flex items-center gap-3 transition-colors group-hover:text-slate-800"><Command size={14} className="text-slate-400 group-hover:text-indigo-600 transition-colors" /> <LexiconText cardKey="sidebar.globalSearch" defaultVal="Global Search" /></span>
           <span className="text-[10px] font-mono text-slate-400 group-hover:text-slate-500 transition-colors">⌘K</span>
         </button>

         {user ? (
           <button 
             onClick={onLogout}
             className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-600 hover:text-rose-500 rounded-full hover:bg-red-50 transition-all w-full cursor-pointer group"
           >
             <LogOut size={14} className="text-slate-400 group-hover:text-rose-500 transition-colors" />
             <span><LexiconText cardKey="sidebar.logout" defaultVal="Log Out" /></span>
           </button>
         ) : (
           <button 
             onClick={onLoginPrompt}
             className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-indigo-600 hover:text-white rounded-full hover:bg-slate-900 transition-all w-full cursor-pointer group"
           >
             <LogIn size={14} className="text-indigo-600 group-hover:text-white transition-colors" />
             <span>Sign In</span>
           </button>
         )}
      </div>

    </div>
  );
});

export default Sidebar;

