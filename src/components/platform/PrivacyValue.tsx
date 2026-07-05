import React from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { cn } from '../../lib/utils';

interface PrivacyValueProps {
  value: string | number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export default function PrivacyValue({ value, className, prefix, suffix }: PrivacyValueProps) {
  const isPrivacyMode = useLedgerStore(state => state.isPrivacyMode);

  return (
    <span className={cn(
      "transition-all duration-500 relative inline-flex items-center",
      isPrivacyMode && "blur-[6px] select-none pointer-events-none opacity-40 scale-95",
      className
    )}>
      {prefix}{value}{suffix}
      {isPrivacyMode && (
        <span className="absolute inset-0 bg-slate-200/5 rounded-sm" />
      )}
    </span>
  );
}
