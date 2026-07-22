import React, { useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { APP_TABS } from '../../config/registry';
import { useAuthStore } from '../../stores/useAuthStore';

interface ModuleSubNavProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function ModuleSubNav({ activeTab, onTabChange }: ModuleSubNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore(s => s.user);
  const userProfile = useAuthStore(s => s.userProfile);
  
  useEffect(() => {
    if (scrollRef.current) {
      const activeElement = scrollRef.current.querySelector<HTMLButtonElement>('[data-state="active"]');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  const currentTabDef = APP_TABS.find(t => t.id === activeTab);
  if (!currentTabDef || !currentTabDef.groupId) return null;
  
  const isOwner = user?.email?.toLowerCase() === 'shmuelbiller@gmail.com' || userProfile?.role === 'admin';
  const groupTabs = APP_TABS.filter(t => t.groupId === currentTabDef.groupId && (!t.requiresOwner || isOwner));
  
  if (groupTabs.length <= 1) return null;

  return (
    <div className="bg-[var(--surface)] border-b border-[var(--line)] px-4 sm:px-6 z-20 shadow-2xs">
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto no-scrollbar items-center gap-1.5 py-2.5"
      >
        {groupTabs.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              data-state={isActive ? 'active' : 'inactive'}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border",
                isActive 
                  ? "bg-gradient-to-r from-[var(--brass)] via-[#e5be6b] to-[var(--brass)] text-black font-bold border-[var(--brass-line)] shadow-xs" 
                  : "bg-[var(--panel)]/80 text-[var(--muted)] border-[var(--line)] hover:text-[var(--text)] hover:border-[var(--brass-line)]/50 hover:bg-[var(--elevated)]"
              )}
            >
              {Icon && <Icon size={14} className={isActive ? "text-black" : "text-[var(--brass)]"} />}
              <span>{tab.label.en}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

