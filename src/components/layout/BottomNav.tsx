import React from 'react';
import { Home, Database, Briefcase, Menu, Building2 } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { cn } from '../../lib/utils';
import { AppTab } from '../../types';
import { APP_TABS } from '../../config/registry';

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tabId: AppTab) => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const { toggleSidebar } = useUIStore();

  const activeTabDef = APP_TABS.find(t => t.id === activeTab);
  const activeGroupId = activeTabDef?.groupId;

  const navGroups: any[] = [];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around h-[64px] px-2">
        {navGroups.map((group) => {
          const Icon = group.icon;
          const isActive = (activeGroupId === group.id && !group.isAction) || (activeTab === group.firstTab && !group.isAction);
          
          return (
            <button
              key={group.id}
              onClick={() => {
                if (group.isAction) {
                  toggleSidebar();
                } else if (group.firstTab) {
                  onTabChange(group.firstTab as AppTab);
                  useUIStore.getState().setSidebarOpen(false);
                }
              }}
              className="flex flex-col items-center justify-center w-full h-full space-y-[2px] relative"
            >
              <div className={cn(
                "p-1.5 rounded-full transition-all duration-200",
                isActive ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
              )}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-colors duration-200",
                isActive ? "text-slate-900 font-bold" : "text-slate-500"
              )}>
                {group.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
