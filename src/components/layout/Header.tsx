import React from 'react';
import { Menu, Search, Briefcase } from 'lucide-react';
import QuickCreateMenu from './QuickCreateMenu';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUIStore } from '../../stores/useUIStore';

export default function Header() {
  const user = useAuthStore(state => state.user);
  const currentWorkspaceId = useAuthStore(state => state.currentWorkspaceId);
  const workspaces = useAuthStore(state => state.workspaces);
  const { setSidebarOpen, setCommandPaletteOpen } = useUIStore();
  
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);

  return (
    <header className="h-16 bg-[#fafafa] flex items-center justify-between px-4 sm:px-8 shrink-0 relative z-30">
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-black transition-colors"
        >
          <Menu size={20} />
        </button>
        
        <div className="hidden lg:flex items-center gap-2 text-black font-medium text-[13px]">
          <Briefcase size={16} className="text-gray-400" />
          <span>{currentWorkspace?.name || 'Workspace'}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-1 justify-center max-w-md w-full hidden md:flex">
        <button 
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-400 px-4 py-2.5 rounded-lg text-[13px] border border-[#e5e5e5] shadow-sm transition-all"
        >
          <Search size={16} />
          <span>Search or type a command...</span>
          <div className="ml-auto flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-[#e5e5e5] rounded font-mono text-gray-400">⌘</kbd>
            <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-[#e5e5e5] rounded font-mono text-gray-400">K</kbd>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-4 flex-1 justify-end">
        <QuickCreateMenu />
        <div className="h-8 w-8 rounded-full bg-black flex items-center justify-center text-white text-[11px] font-medium cursor-pointer hover:bg-gray-800 transition-colors">
          {user?.email?.[0]?.toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  );
}
