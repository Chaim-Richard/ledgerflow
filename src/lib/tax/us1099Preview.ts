/**
 * E-10: conservative 1099 draft review from already-aggregated, verified payments.
 * Not an IRS paper filing form or compliant IRIS upload. Payer/recipient TINs,
 * state data, corrections and other specialized boxes require the tax workflow.
 * Thresholds based on IRS 2026 1099-MISC/NEC instructions.
 */
export type Form1099Kind = '1099-NEC' | '1099-MISC';
export type Form1099Box = '1a' | '1' | '2' | '3' | '10';
export interface Form1099Total {
  vendorId: string;
  vendorName: string;
  form: Form1099Kind;
  box: Form1099Box;
  paidCents: number;
  tinLastFour?: string; // never store a complete TIN in this preview
}
export interface Form1099Draft {
  vendorId: string;
  vendorName: string;
  form: Form1099Kind;
  box: Form1099Box;
  amountCents: number;
  thresholdCents: number;
  taxYear: number;
  tinLastFour?: string;
  needsTaxDetails: true;
}
export interface Form1096Draft {
  form: Form1099Kind;
  taxYear: number;
  forms: number;
  totalCents: number;
}
export interface Form1099Preview {
  forms: Form1099Draft[];
  form1096: Form1096Draft[];
  excluded: number;
  /** Deliberately not an official IRS/IRIS filing export. */
  filingReady: false;
}
export const US1099_THRESHOLDS = [
  { validFrom: '1900-01-01', validTo: '2025-12-31', necCents: 60000, miscOrdinaryCents: 60000, source: 'https://www.irs.gov/businesses/small-businesses-self-employed/am-i-required-to-file-a-form-1099-or-other-information-return' },
  { validFrom: '2026-01-01', validTo: null, necCents: 200000, miscOrdinaryCents: 200000, source: 'https://www.irs.gov/instructions/i1099mec' },
] as const;
/** Special 1099-MISC royalty and attorney gross-proceeds boxes do not use ordinary threshold. */
export function threshold1099Cents(year: number, form: Form1099Kind, box: Form1099Box): number {
  if (!Number.isInteger(year) || year < 2020 || year > 2099) throw new Error('Unsupported 1099 tax year.');
  if (form === '1099-NEC') {
    if (box !== '1a') throw new Error('1099-NEC box must be 1a.');
    return year >= 2026 ? 200000 : 60000;
  }
  if (box === '2') return 1000; // royalties
  if (box === '10') return 60000; // gross attorney proceeds, exception
  if (box !== '1' && box !== '3') throw new Error('Unsupported 1099-MISC box.');
  return year >= 2026 ? 200000 : 60000;
}
export function build1099Preview(totals: readonly Form1099Total[], taxYear: number): Form1099Preview {
  // validate year even for empty input
  threshold1099Cents(taxYear, '1099-NEC', '1a');
  const grouped = new Map<string, Form1099Total>();
  for (const total of totals) {
    if (!total.vendorId || !total.vendorName.trim() || !Number.isSafeInteger(total.paidCents) || total.paidCents < 0)
      throw new Error('Invalid 1099 vendor or whole-cent total.');
    threshold1099Cents(taxYear, total.form, total.box);
    if (total.tinLastFour !== undefined && !/^\d{4}$/.test(total.tinLastFour))
      throw new Error('Only the final four TIN digits may be displayed.');
    const key = JSON.stringify([total.form, total.box, total.vendorId]);
    const current = grouped.get(key);
    const paidCents = (current?.paidCents || 0) + total.paidCents;
    if (!Number.isSafeInteger(paidCents)) throw new Error('1099 total exceeds safe cent range.');
    grouped.set(key, { ...total, paidCents });
  }
  const forms: Form1099Draft[] = [];
  let excluded = 0;
  for (const row of grouped.values()) {
    const thresholdCents = threshold1099Cents(taxYear, row.form, row.box);
    if (row.paidCents < thresholdCents) { excluded++; continue; }
    forms.push({ vendorId: row.vendorId, vendorName: row.vendorName, form: row.form, box: row.box, amountCents: row.paidCents, thresholdCents, taxYear, tinLastFour: row.tinLastFour, needsTaxDetails: true });
  }
  forms.sort((a, b) => a.form.localeCompare(b.form) || a.vendorName.localeCompare(b.vendorName) || a.vendorId.localeCompare(b.vendorId));
  const form1096: Form1096Draft[] = (['1099-NEC', '1099-MISC'] as const).map(form => {
    const rows = forms.filter(row => row.form === form);
    return { form, taxYear, forms: rows.length, totalCents: rows.reduce((sum, row) => sum + row.amountCents, 0) };
  });
  return { forms, form1096, excluded, filingReady: false };
}
/** Financial reconciliation data only. This CSV is NOT an IRIS portal template. */
export function us1099ReviewCsvRows(preview: Form1099Preview): Array<Array<string | number>> {
  return preview.forms.map(row => [row.taxYear, row.form, row.box, row.vendorId, row.vendorName, row.tinLastFour ? '****' + row.tinLastFour : 'MISSING', (row.amountCents / 100).toFixed(2), 'REVIEW ONLY — NOT IRIS']);
}
