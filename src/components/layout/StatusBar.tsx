import React from 'react';
import { cn } from '../../lib/utils';
import { useUIStore } from '../../stores/useUIStore';

export default function StatusBar() {
  const isOnline = useUIStore(s => s.isOnline);

  return (
    <div className="hidden md:flex h-8 bg-[var(--surface)] border-t border-[var(--line)] items-center justify-between px-6 overflow-hidden text-[var(--faint)] font-mono text-[10.5px] relative select-none shrink-0 z-50">
      <div className="flex items-center gap-3 sm:gap-6 shrink-0">
        <div className="flex items-center gap-2">
          <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              isOnline ? "bg-[var(--pos)]" : "bg-[var(--faint)]"
            )} 
          />
          <span className="font-semibold uppercase tracking-wider leading-none text-[var(--muted)]">
            {isOnline ? "ledgerflow ONLINE" : "OFFLINE MODE"}
          </span>
        </div>
        <span className="text-[var(--brass)]">·</span>
        <span>tamper-evident · chain head 7f3a…c2e1</span>
      </div>

      <div className="flex items-center gap-4 text-[var(--faint)]">
        <span>42.36°N 71.06°W</span>
        <span className="text-[var(--brass)]">·</span>
        <span>verified FY 2026</span>
      </div>
    </div>
  );
}
