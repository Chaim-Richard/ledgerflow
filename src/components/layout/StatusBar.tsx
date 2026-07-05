import React from 'react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/useUIStore';

export default function StatusBar() {
  const { isOnline } = useUIStore();

  return (
    <div className="hidden md:flex h-8 bg-[#fbfbfc] border-t border-slate-200 items-center justify-between px-6 overflow-hidden text-slate-500 font-mono text-[10px] relative select-none shrink-0 z-50">
      <div className="flex items-center gap-3 sm:gap-6 shrink-0">
        <div className="flex items-center gap-2">
          <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              isOnline ? "bg-emerald-500" : "bg-slate-300"
            )} 
          />
          <span className="font-medium uppercase tracking-wider leading-none">
            {isOnline ? "System Online" : "Offline Mode"}
          </span>
        </div>
      </div>
    </div>
  );
}
