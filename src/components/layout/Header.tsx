import React, { useEffect } from 'react';
import { Menu, Search, Sun, Moon, Plus, Compass, ShieldCheck, HelpCircle, Bell } from 'lucide-react';
import QuickCreateMenu from './QuickCreateMenu';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUIStore } from '../../stores/useUIStore';
import { useNotificationStore } from '../../stores/useNotificationStore';
import NotificationDrawer from './NotificationDrawer';
import { t } from '../../locales/i18n';

import { useCurrentRole } from '../../hooks/useCurrentRole';

interface HeaderProps {
  onLogout?: () => void;
  onLoginPrompt?: () => void;
}

const Header = React.memo(function Header({ onLogout, onLoginPrompt }: HeaderProps) {
  const user = useAuthStore(state => state.user);
  const currentWorkspaceId = useAuthStore(state => state.currentWorkspaceId);
  const workspaces = useAuthStore(state => state.workspaces);
  const setSidebarOpen = useUIStore(s => s.setSidebarOpen);
  const setCommandPaletteOpen = useUIStore(s => s.setCommandPaletteOpen);
  const theme = useUIStore(s => s.theme);
  const setTheme = useUIStore(s => s.setTheme);
  const currentRole = useCurrentRole();

  const { notifications, setDrawerOpen, runScheduledChecks } = useNotificationStore();
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (currentWorkspaceId) {
      runScheduledChecks(currentWorkspaceId);
    }
  }, [currentWorkspaceId, runScheduledChecks]);
  
  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    setTheme(nextTheme);
    if (typeof document !== 'undefined') {
      if (nextTheme === 'light') {
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
      }
    }
  };

  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);


  const language = useUIStore(s => s.language) || 'en';
  const isAdmin = useAuthStore(state => state.isAdmin);
  const setActiveTab = useUIStore(state => state.setActiveTab);

  return (
    <header className="h-16 bg-[var(--surface)] border-b border-[var(--line)] flex items-center justify-between px-4 sm:px-6 shrink-0 relative z-30 text-[var(--text)]">
      <div className="flex items-center gap-3 flex-1">
        <button 
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-2 -ml-2 text-[var(--muted)] hover:text-[var(--text)] transition-colors"
        >
          <Menu size={20} />
        </button>
        
        <div className="hidden lg:flex items-center gap-2 font-mono text-[12px] text-[var(--muted)]">
          <Compass size={15} className="text-[var(--brass)]" />
          <span className="text-[var(--text)] font-semibold">{currentWorkspace?.name || 'Main Ledger'}</span>
          <span className="text-[var(--faint)]">·</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            currentRole === 'owner' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' :
            currentRole === 'accountant' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
            currentRole === 'bookkeeper' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
            'bg-slate-500/10 text-slate-400 border border-slate-500/20'
          }`} title={`Your current role in this workspace is ${currentRole}`}>
            {currentRole}
          </span>
        </div>
      </div>

      {/* Coordinate Search Command Bar */}
      <div className="flex items-center gap-4 flex-1 justify-center max-w-xl w-full hidden md:flex">
        <button 
          onClick={() => setCommandPaletteOpen(true)}
          className="w-full flex items-center gap-2.5 bg-[var(--panel)] hover:bg-[var(--elevated)] text-[var(--muted)] px-3.5 py-2 rounded-lg text-[13px] border border-[var(--line)] shadow-sm transition-all group"
        >
          <Search size={15} className="text-[var(--faint)] group-hover:text-[var(--brass)] transition-colors" />
          <span className="font-mono text-[12px] text-[var(--faint)] truncate">
            world:realestate property:homes/* amount:&gt;1000
          </span>
          <div className="ml-auto flex items-center gap-1 shrink-0">
            <kbd className="px-1.5 py-0.5 text-[10px] bg-[var(--surface)] border border-[var(--line)] rounded font-mono text-[var(--faint)]">⌘K</kbd>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-3 flex-1 justify-end">
        {/* Help & Guide Button */}
        <button
          onClick={() => setActiveTab('help' as any)}
          className="p-2 text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--elevated)] rounded-lg transition-colors"
          title="Open Help & Operational Guide"
          aria-label="Open Help & Operational Guide"
        >
          <HelpCircle size={17} />
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--elevated)] rounded-lg transition-colors relative cursor-pointer"
          title="Open Notifications"
          aria-label="Open Notifications"
        >
          <Bell size={17} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] font-bold bg-indigo-600 text-white rounded-full leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--elevated)] rounded-lg transition-colors"
          title="Toggle light/dark map view"
         aria-label="Toggle light/dark map view">
          {isDark ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <QuickCreateMenu />

        {user ? (
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setActiveTab('system-command-center' as any)}
                title="Open Admin Control Panel"
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold text-[var(--brass)] bg-[var(--brass-soft)] hover:bg-[var(--brass)] hover:text-black border border-[var(--brass-line)] rounded-md transition-colors cursor-pointer"
              >
                <ShieldCheck size={12} />
                <span>ADMIN PANEL</span>
              </button>
            )}
            <div 
              role="button" 
              tabIndex={0} 
              onClick={onLogout}
              title={`Logged in as ${user.email}${isAdmin ? ' (Administrator)' : ''}. Click to Log Out.`}
              className="h-8 w-8 rounded-full bg-[var(--brass-soft)] border border-[var(--brass-line)] flex items-center justify-center text-[var(--brass)] text-[11px] font-mono font-bold cursor-pointer hover:bg-[var(--brass)] hover:text-black transition-colors"
            >
              {user.email?.[0]?.toUpperCase() || 'S'}
            </div>
          </div>
        ) : (
          <button
            onClick={onLoginPrompt || onLogout}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md hover:bg-amber-500/20 transition-all"
            title="Currently in Guest Mode. Click to sign in."
           aria-label="Currently in Guest Mode. Click to sign in.">
            <span>Guest</span>
            <span className="text-[10px] text-amber-300 underline font-semibold">Sign In</span>
          </button>
        )}
      </div>
      <NotificationDrawer />
    </header>
  );
});

export default Header;

