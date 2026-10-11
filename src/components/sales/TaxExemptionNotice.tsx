import React from 'react';
import { exemptionOn } from '../../lib/taxExemption';
import TaxPlaceSuggestion from './TaxPlaceSuggestion';

/**
 * On an invoice (T-05): the customer is tax-exempt, with the certificate's number, and a button to
 * charge no tax while tax is charged; or their certificate ran out, so tax is charged again.
 */
export default function TaxExemptionNotice({ customer, date, charging, onNoTax, lineLabels, currentRate = 0, onUseRate }: {
  customer?: { name?: string; metadata?: unknown } | null;
  date: string;
  /** whether the invoice charges tax now */
  charging: boolean;
  onNoTax: () => void;
  /** PLAN §6: the first line's labels (its entity), what the invoice charges now and how to change it */
  lineLabels?: Record<string, string>;
  currentRate?: number;
  onUseRate?: (rate: number) => void;
}) {
  const found = exemptionOn(customer, date);
  const suggestion = onUseRate ? <TaxPlaceSuggestion customer={customer} date={date} lineLabels={lineLabels} currentRate={currentRate} exempt={found?.state === 'exempt'} onUseRate={onUseRate} /> : null;
  if (!found) return suggestion;
  const { state, certificate } = found;
  if (state === 'expired') {
    return <><p role="status" className="text-xs text-amber-600">Their tax exemption certificate {certificate.number} ran out on {certificate.expires}: tax is charged until a new one comes in.</p>{suggestion}</>;
  }
  return (
    <p role="status" className="text-xs text-[var(--muted)]">
      Tax-exempt: certificate {certificate.number}{certificate.expires ? `, good until ${certificate.expires}` : ''}.
      {charging && <> <button type="button" onClick={onNoTax} className="underline font-semibold text-[var(--text)]">Charge no tax</button></>}
    </p>
  );
}
