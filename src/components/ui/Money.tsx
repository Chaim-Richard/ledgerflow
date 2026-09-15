import React from 'react';
import { formatCurrency, cn } from '../../lib/utils';

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
  isPrivacyMode = false
}) => {
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
    <span
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
