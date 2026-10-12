import React from 'react';
import { useAuthStore } from '../../stores/useAuthStore';
import { resolveSellerProfile, type TaxPlace } from '../../lib/tax/profile';
import { resolveLineTax, type LineTaxReason } from '../../lib/tax/resolveLineTax';
import { ruleRateTable } from '../../lib/tax/ruleRateTable';

// every rule pack, built once, so each place with a pack gets its rate (PLAN §10)
const packRates = ruleRateTable();
import { DEFAULT_WORKSPACE_DIMENSIONS } from '../../lib/dimensionUtils';

const SAYS: Record<Exclude<LineTaxReason, 'taxed'>, string> = {
  'exempt-certificate': 'no tax: the customer has an exemption certificate',
  export: 'no tax: sold to another country',
  'zero-area': 'no tax: a zero-rated area',
  'not-registered': 'no tax: the seller has no tax registration for the customer\'s place',
  'no-rate-table': 'LedgerFlow has no rates for this place yet; choose the tax yourself',
};

const pct = (rate: number) => `${Math.round(rate * 100000) / 1000}%`;

/**
 * On an invoice (PLAN §6): the tax this sale should carry, from the selling entity's tax profile (the
 * first line's entity label, else the books), the customer's tax place and the date, with a button
 * to use it when the invoice charges something else. Shown only once tax profiles are set up.
 */
export default function TaxPlaceSuggestion({ customer, date, lineLabels, currentRate, exempt, onUseRate }: {
  customer?: { metadata?: unknown } | null;
  date: string;
  lineLabels?: Record<string, string>;
  /** what the invoice charges now, as a fraction */
  currentRate: number;
  exempt: boolean;
  onUseRate: (rate: number) => void;
}) {
  const profiles = useAuthStore(s => s.getCurrentWorkspace()?.taxProfiles);
  const dimensions = useAuthStore(s => s.getCurrentWorkspace()?.dimensions) || DEFAULT_WORKSPACE_DIMENSIONS;
  if (!profiles || (!profiles.books && !profiles.labels) || !date) return null;
  const order = [...dimensions]
    .sort((a, b) => Number(Boolean(b.isWorld)) - Number(Boolean(a.isWorld)) || (a.sortOrder ?? 99) - (b.sortOrder ?? 99)).map(d => d.id);
  const seller = resolveSellerProfile(profiles, lineLabels, order);
  const buyer = (customer?.metadata as { taxPlace?: TaxPlace } | undefined)?.taxPlace;
  const tax = resolveLineTax({ seller, buyer, date, exempt, fallback: packRates });
  const who = seller.name ? `${seller.name}: ` : '';
  if (tax.reason !== 'taxed') {
    const differs = tax.reason !== 'no-rate-table' && currentRate > 0;
    return (
      <p role="status" className="text-xs text-[var(--muted)]">
        {who}{SAYS[tax.reason]}.
        {differs && <> <button type="button" onClick={() => onUseRate(0)} className="underline font-semibold text-[var(--text)]">Use no tax</button></>}
      </p>
    );
  }
  const same = Math.abs(tax.rate - currentRate) < 1e-6;
  return (
    <p role="status" className="text-xs text-[var(--muted)]">
      {who}expected tax {pct(tax.rate)} ({tax.components.map(c => `${c.name} ${pct(c.rate)}`).join(' + ')}).
      {!same && <> <button type="button" onClick={() => onUseRate(tax.rate)} className="underline font-semibold text-[var(--text)]">Use {pct(tax.rate)}</button></>}
    </p>
  );
}

