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
    <div className="bg-[#fafafa] border-b border-[#e5e5e5] px-4 sm:px-8 z-20">
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto no-scrollbar space-x-6 pt-3 -mb-px"
      >
        {groupTabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              data-state={isActive ? 'active' : 'inactive'}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "pb-3 text-[13px] font-medium whitespace-nowrap transition-all border-b-2",
                isActive 
                  ? "border-black text-black" 
                  : "border-transparent text-gray-500 hover:text-black hover:border-gray-300"
              )}
            >
              {tab.label.en}
            </button>
          );
        })}
      </div>
    </div>
  );
}
