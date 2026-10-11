import React from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { formatCurrency, cn } from '../../lib/utils';
import { useLedgerStore } from '../../stores/useLedgerStore';

export interface MoneyProps {
  cents: number | undefined | null;
  currency?: string;
  className?: string;
  colored?: boolean;
  sign?: boolean;
  prefix?: string;
  suffix?: string;
  isPrivacyMode?: boolean;
}

export const Money: React.FC<MoneyProps> = ({
  cents,
  currency,
  className,
  colored = false,
  sign = false,
  prefix = '',
  suffix = '',
  isPrivacyMode: explicitPrivacyMode
}) => {
  // Reformat when workspace preferences change, including memoized list cells.
  useAuthStore(s => s.workspaces);
  useAuthStore(s => s.currentWorkspaceId);
  const storePrivacyMode = useLedgerStore(s => s.isPrivacyMode);
  const isPrivacyMode = explicitPrivacyMode !== undefined ? explicitPrivacyMode : (storePrivacyMode || false);

  const safeCents = cents ?? 0;
  const isPositive = safeCents > 0;
  const isNegative = safeCents < 0;

  const colorClass = colored
    ? isPositive
      ? 'text-emerald-600 dark:text-emerald-400'
      : isNegative
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-[var(--text)]'
    : '';

  const formatted = formatCurrency(safeCents, currency);
  const signPrefix = sign && isPositive ? '+' : '';

  return (
    <span dir="auto" style={{ unicodeBidi: 'isolate' }}
      className={cn(
        'tabular-nums font-mono',
        colorClass,
        isPrivacyMode && 'blur-[6px] select-none pointer-events-none opacity-20 transition-all',
        className
      )}
    >
      {prefix}{signPrefix}{formatted}{suffix}
    </span>
  );
};

export default Money;
