import React from 'react';
import { cn } from '../../lib/utils';
import { LayoutGrid, Layers, Briefcase, BarChart3, Settings } from 'lucide-react';
import { APP_TABS, NAV_GROUPS } from '../../config/registry';
import { useUIStore } from '../../stores/useUIStore';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const GROUP_ICONS: Record<string, React.ElementType> = {
  pulse: LayoutGrid,
  finance: Layers,
  operations: Briefcase,
  planning: BarChart3,
  system: Settings
};

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const isProMode = useUIStore(s => s.isProMode);
  const currentTabDef = APP_TABS.find(t => t.id === activeTab);
  const activeGroupId = currentTabDef?.groupId || 'pulse';

  const visibleGroups = ['pulse', 'finance', 'operations', 'planning'];

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 h-[64px] bg-[var(--surface)] border-t border-[var(--line)] flex items-center justify-around z-50 px-2 pb-[env(safe-area-inset-bottom)]">
      {visibleGroups.map(groupId => {
        const Icon = GROUP_ICONS[groupId];
        const isActive = activeGroupId === groupId;
        const firstTab = APP_TABS.find(t => t.groupId === groupId && (!t.isAdvanced || isProMode));
        const groupLabel = NAV_GROUPS[groupId]?.en;
        
        if (!firstTab) return null;

        return (
          <button
            key={groupId}
            onClick={() => onTabChange(firstTab.id)}
            className="flex flex-col items-center justify-center w-full h-full space-y-1 relative"
          >
            <div className={cn(
              "p-1.5 rounded-full transition-colors",
              isActive ? "bg-black/5 text-black" : "text-gray-400"
            )}>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className={cn(
              "text-[10px] font-medium transition-colors",
              isActive ? "text-black" : "text-gray-400"
            )}>
              {groupLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}
