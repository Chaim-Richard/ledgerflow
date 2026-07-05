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
  const { user, userProfile } = useAuthStore();
  
  // Auto-scroll the active tab into view on mobile
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
  
  // If there's only one tab in this group, we might not need the subnav, but show it for consistency if desired.
  // Actually, if length is <= 1, it's a standalone screen, so don't show the nested nav!
  if (groupTabs.length <= 1) return null;

  return (
    <div className="bg-white border-b border-slate-200 px-4 sm:px-6 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-hide space-x-1 sm:space-x-4 pt-2 -mb-px"
      >
        {groupTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              data-state={isActive ? "active" : "inactive"}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-all whitespace-nowrap border-b-2",
                isActive 
                  ? "text-slate-900 border-slate-900" 
                  : "text-slate-500 border-transparent hover:text-slate-800 hover:border-slate-300"
              )}
            >
              {Icon && (
                <Icon 
                  size={16} 
                  className={cn(
                    "transition-colors",
                    isActive ? "text-indigo-600" : "text-slate-400"
                  )} 
                />
              )}
              {tab.label.en}
            </button>
          )
        })}
      </div>
    </div>
  );
}
