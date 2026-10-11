import React, { useEffect, useId, useState } from 'react';
import { formatCurrency } from '../../lib/utils';
import { calculateDocumentTax } from '../../lib/documentMath';
import { withheldCents, withholdingOn } from '../../lib/tax/withholding';
import type { DocumentTaxInput } from '../../lib/documentMath';

export interface Withholding { withheldCents: number; ratePercent: number; certificate?: string }

/**
 * Tax withheld at source on a payment to a vendor (PLAN IL-5): the rate from the vendor's
 * certificate (Vendors → Edit) or typed here, on the part of each bill paid that is not VAT. The
 * vendor gets the rest; the server books the withheld tax as owed. Home currency only.
 */
export default function WithholdingField({ vendor, date, allocations, bills, currency, onChange }: {
  vendor?: { metadata?: unknown } | null;
  date: string;
  /** bill id → cents paid on it */
  allocations: Record<string, number>;
  bills: Array<DocumentTaxInput & { id: string; amountCents?: number }>;
  currency: string;
  onChange: (w: Withholding | null) => void;
}) {
  const id = useId();
  const found = withholdingOn(vendor, date);
  const [rate, setRate] = useState<string>(() => (found?.state === 'good' ? String(found.certificate.ratePercent) : ''));
  const [vendorShown, setVendorShown] = useState(vendor);
  if (vendor !== vendorShown) { setVendorShown(vendor); setRate(found?.state === 'good' ? String(found.certificate.ratePercent) : ''); }

  const ratePercent = Number(rate);
  const valid = rate !== '' && Number.isFinite(ratePercent) && ratePercent >= 0 && ratePercent <= 100;
  let paid = 0;
  let vat = 0;
  for (const [billId, cents] of Object.entries(allocations)) {
    const bill = bills.find(b => b.id === billId);
    if (!bill || cents <= 0) continue;
    paid += cents;
    const total = bill.amountCents || 0;
    vat += total > 0 ? Math.round(cents * calculateDocumentTax(bill) / total) : 0;
  }
  const withheld = valid ? withheldCents(paid, vat, ratePercent) : 0;
  const certificate = found?.state === 'good' ? found.certificate.number : undefined;

  useEffect(() => {
    onChange(withheld > 0 ? { withheldCents: withheld, ratePercent, ...(certificate ? { certificate } : {}) } : null);
  }, [withheld, ratePercent, certificate, onChange]);

  return (
    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs space-y-1">
      <label htmlFor={id} className="font-semibold text-slate-700 dark:text-slate-300">Tax withheld at source, %</label>
      <input id={id} type="number" min="0" max="100" step="0.01" value={rate} onChange={e => setRate(e.target.value)} placeholder="0"
        className="w-24 ml-2 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-right" />
      {found?.state === 'good' && <p className="text-[var(--muted)]">Certificate {found.certificate.number || ''}: {found.certificate.ratePercent}%{found.certificate.expires ? `, good until ${found.certificate.expires}` : ''}.</p>}
      {found?.state === 'expired' && <p role="status" className="text-amber-600">Their withholding certificate ran out on {found.certificate.expires}: ask for a new one, or withhold at the full rate.</p>}
      {withheld > 0 && <p role="status">Withheld {formatCurrency(withheld, currency)} on {formatCurrency(paid - vat, currency)} before VAT; the vendor gets {formatCurrency(paid - withheld, currency)}.</p>}
    </div>
  );
}
