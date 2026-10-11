/**
 * A-23 (PLAN IL-5): the yearly report of tax withheld at source from vendor payments — Israel's
 * Form 856 (טופס 856). The report lists, per vendor for one tax year: what was paid, what was
 * withheld and the certificate number(s) the payments relied on, so a person can fill the form and
 * hand the vendor their certificate.
 *
 * Read-only arithmetic over recorded payments (withheldCents/withholdingRatePercent/
 * withholdingCertificate, landed 11 Oct). Nothing is filed, nothing is posted, and a payment
 * without a certificate number is reported as needing attention rather than guessed. Pure.
 */

/** One recorded payment (the part of Payment the report reads). */
export interface Form856Payment {
  id: string;
  date: string;
  /** received = from a customer; made = to a vendor (only 'made' counts here) */
  direction?: 'received' | 'made';
  contactId: string;
  contactName?: string;
  /** the vendor's tax id as recorded, when the workspace has it */
  contactTaxId?: string;
  amountCents: number;
  /** VAT inside the payment, when the workspace knows it (the withholding base is payment − VAT) */
  vatCents?: number;
  withheldCents?: number;
  withholdingRatePercent?: number;
  withholdingCertificate?: string;
}

export interface Form856Row {
  contactId: string;
  name: string;
  taxId: string;
  payments: number;
  /** everything paid to this vendor in the year */
  paidCents: number;
  /** payment − VAT, the base the rate applied to */
  baseCents: number;
  withheldCents: number;
  /** the effective rate over the year: withheld ÷ base, two decimals */
  effectiveRatePercent: number;
  /** the certificate numbers seen, in first-seen order */
  certificates: string[];
  /** months (YYYY-MM) in which money was paid */
  months: string[];
  /** payments in the year with no certificate number recorded */
  missingCertificates: number;
}

export interface Form856Summary {
  vendors: number;
  payments: number;
  paidCents: number;
  withheldCents: number;
  missingCertificates: number;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** The tax year a payment belongs to (empty when the date is not a date). */
export function form856Year(date: string): string {
  return YMD.test(String(date).slice(0, 10)) ? String(date).slice(0, 4) : '';
}

/** A payment the report includes: money out to a vendor with tax withheld on it. */
export function isForm856Payment(payment: Form856Payment): boolean {
  return payment.direction !== 'received' && Number(payment.withheldCents) > 0;
}

/** The report rows for one year (default: the year of `onDate`), by vendor name. */
export function form856Rows(payments: Form856Payment[], year: string): Form856Row[] {
  const rows = new Map<string, Form856Row>();
  for (const payment of payments) {
    if (!isForm856Payment(payment) || form856Year(payment.date) !== year) continue;
    const base = Math.max(0, payment.amountCents - Math.max(0, payment.vatCents || 0));
    const row = rows.get(payment.contactId) || {
      contactId: payment.contactId, name: payment.contactName || payment.contactId, taxId: payment.contactTaxId || '',
      payments: 0, paidCents: 0, baseCents: 0, withheldCents: 0, effectiveRatePercent: 0, certificates: [], months: [], missingCertificates: 0,
    };
    if (!row.taxId && payment.contactTaxId) row.taxId = payment.contactTaxId;
    row.payments += 1;
    row.paidCents += payment.amountCents;
    row.baseCents += base;
    row.withheldCents += Number(payment.withheldCents) || 0;
    const certificate = String(payment.withholdingCertificate || '').trim();
    if (certificate) { if (!row.certificates.includes(certificate)) row.certificates.push(certificate); }
    else row.missingCertificates += 1;
    const month = String(payment.date).slice(0, 7);
    if (YMD.test(String(payment.date).slice(0, 10)) && !row.months.includes(month)) row.months.push(month);
    rows.set(payment.contactId, row);
  }
  return [...rows.values()]
    .map(row => ({ ...row, effectiveRatePercent: row.baseCents > 0 ? Math.round((row.withheldCents / row.baseCents) * 10_000) / 100 : 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function form856Summary(rows: Form856Row[]): Form856Summary {
  return {
    vendors: rows.length,
    payments: rows.reduce((s, r) => s + r.payments, 0),
    paidCents: rows.reduce((s, r) => s + r.paidCents, 0),
    withheldCents: rows.reduce((s, r) => s + r.withheldCents, 0),
    missingCertificates: rows.reduce((s, r) => s + r.missingCertificates, 0),
  };
}

/**
 * What a person still has to collect before the form is complete, in the order it matters:
 * certificate numbers for payments that lack them, then vendors with no tax id on the record.
 */
export function form856Notes(rows: Form856Row[]): string[] {
  const notes: string[] = [];
  const missing = rows.reduce((s, r) => s + r.missingCertificates, 0);
  if (missing) notes.push(`${missing} payment${missing === 1 ? '' : 's'} in the year have no certificate number recorded; ask the vendor for it.`);
  const noTaxId = rows.filter(r => !r.taxId);
  if (noTaxId.length) notes.push(`${noTaxId.length} vendor${noTaxId.length === 1 ? ' has' : 's have'} no tax id on the record: ${noTaxId.map(r => r.name).join(', ')}.`);
  if (!notes.length && rows.length) notes.push('Every reported payment has a certificate number and every vendor has a tax id.');
  return notes;
}

export const FORM_856_CSV_HEADERS = ['Vendor', 'Tax id', 'Payments', 'Paid', 'Base', 'Withheld', 'Effective rate %', 'Certificates', 'Months', 'Missing certificates'];

export function form856CsvRows(rows: Form856Row[]): Array<Array<string | number>> {
  return rows.map(r => [
    r.name, r.taxId, r.payments, r.paidCents / 100, r.baseCents / 100, r.withheldCents / 100,
    r.effectiveRatePercent, r.certificates.join(' '), r.months.join(' '), r.missingCertificates,
  ]);
}
