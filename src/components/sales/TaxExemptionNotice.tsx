import React from 'react';
import { exemptionOn } from '../../lib/taxExemption';

/**
 * On an invoice (T-05): the customer is tax-exempt, with the certificate's number, and a button to
 * charge no tax while tax is charged; or their certificate ran out, so tax is charged again.
 */
export default function TaxExemptionNotice({ customer, date, charging, onNoTax }: {
  customer?: { name?: string; metadata?: unknown } | null;
  date: string;
  /** whether the invoice charges tax now */
  charging: boolean;
  onNoTax: () => void;
}) {
  const found = exemptionOn(customer, date);
  if (!found) return null;
  const { state, certificate } = found;
  if (state === 'expired') {
    return <p role="status" className="text-xs text-amber-600">Their tax exemption certificate {certificate.number} ran out on {certificate.expires}: tax is charged until a new one comes in.</p>;
  }
  return (
    <p role="status" className="text-xs text-[var(--muted)]">
      Tax-exempt: certificate {certificate.number}{certificate.expires ? `, good until ${certificate.expires}` : ''}.
      {charging && <> <button type="button" onClick={onNoTax} className="underline font-semibold text-[var(--text)]">Charge no tax</button></>}
    </p>
  );
}
