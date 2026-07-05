import React from 'react';
import { Menu, Search, Briefcase } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUIStore } from '../../stores/useUIStore';

export default function Header() {
  const user = useAuthStore(state => state.user);
  const currentWorkspaceId = useAuthStore(state => state.currentWorkspaceId);
  const workspaces = useAuthStore(state => state.workspaces);
  const { setSidebarOpen, setCommandPaletteOpen } = useUIStore();
  
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 shrink-0 relative z-30">
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={() => setSidebarOpen(true)}
          className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <Menu size={20} />
        </button>
        
        <div className="hidden md:flex items-center gap-2 text-slate-500 font-medium">
          <Briefcase size={18} className="text-slate-400" />
          <span>{currentWorkspace?.name || 'Workspace'}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-1 justify-center max-w-sm w-full hidden md:flex">
        <button 
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-400 px-4 py-2 rounded-xl text-sm border border-slate-200 transition-all"
        >
          <Search size={16} />
          <span>Search or type a command...</span>
          <div className="ml-auto flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded font-mono text-slate-400">⌘</kbd>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-slate-200 rounded font-mono text-slate-400">K</kbd>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-4 flex-1 justify-end">
        <div className="h-8 w-8 rounded-full bg-slate-900 border-2 border-white shadow-sm flex items-center justify-center text-white text-xs font-bold ring-2 ring-slate-100">
          {user?.email?.[0]?.toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  );
}
