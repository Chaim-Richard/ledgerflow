import React from 'react';
import { cleanMerchantName } from '../../lib/merchantNames';

/**
 * A bank line's payee as people read it (K-36): the cleaned name, with the bank's own text underneath
 * when it differs (and always on hover), so nothing the bank sent is hidden.
 */
export default function BankLineName({ text, className }: { text: string; className?: string }) {
  const name = cleanMerchantName(text) || text;
  return (
    <span className={`flex flex-col min-w-0 ${className || ''}`} title={text}>
      <span className="truncate">{name}</span>
      {name !== text && <span className="truncate text-[10px] font-normal font-mono text-[var(--muted)]">{text}</span>}
    </span>
  );
}
