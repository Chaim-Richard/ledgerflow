/**
 * A-188: which vendors are far enough along to prepare a US 1099 at year end, and what is missing.
 *
 * Read-only and honest about what a workspace record can prove:
 * - "paid this year" is the sum of posted outgoing payments in the home currency; a payment in
 *   another currency is counted and never converted, and bills that were never paid are not a
 *   payment (the money rule: an invoice is not a payment).
 * - the tax-ID column is a mask of a recorded value, never the value itself, and a recorded value
 *   is not proof that the number is correct or that the vendor is a US person.
 * - this workspace has no W-9 field, so the report does not claim a form is on file; it says the
 *   form is not recorded here and leaves that decision to the owner.
 * The threshold itself comes from the existing 1099 table (`threshold1099Cents`), so the report
 * and the 1099 preview read one number.
 */
import { threshold1099Cents } from './tax/us1099Preview';
import { maskRecordedTaxId } from './vendorTaxRecords';

export interface ReadinessVendor {
  id: string;
  name: string;
  /** ISO country from the vendor's tax profile, when one is recorded. */
  country?: string;
  address?: string;
  /** The vendor is marked as a 1099 vendor on its own record. */
  is1099?: boolean;
  isForeign?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ReadinessPayment {
  contactId: string;
  contactName?: string;
  date?: string;
  amountCents: number;
  currency?: string;
  direction?: string;
  status?: string;
}

export type ReadinessState = 'needs-tax-details' | 'over-threshold' | 'below-threshold';

export interface VendorReadinessRow {
  vendorId: string;
  vendor: string;
  country: string;
  /** Whole cents paid this year in the home currency. */
  paidCents: number;
  thresholdCents: number;
  overThreshold: boolean;
  taxId: { recorded: boolean; masked: string; raw: string };
  addressRecorded: boolean;
  w9Recorded: boolean;
  state: ReadinessState;
  /** What a person should look at before the form is prepared. */
  missing: string[];
}

export interface VendorReadinessReport {
  taxYear: number;
  thresholdCents: number;
  rows: VendorReadinessRow[];
  /** Vendors with a payment this year that is in another currency, so the total is incomplete. */
  skippedForeignCurrencyPayments: number;
  /** Outgoing payments left out because they are drafts, voids or not outgoing. */
  ignoredPayments: number;
  /** Vendors paid this year but not marked as 1099 vendors — flagged, never hidden. */
  unmarkedWithPayments: number;
  /** Payments dated outside the tax year. */
  outsideTaxYear: number;
}

function taxIdOf(vendor: ReadinessVendor): string {
  for (const key of ['taxId', 'taxNumber', 'vatNumber', 'ein', 'businessNumber']) {
    const value = vendor.metadata?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function countryOf(vendor: ReadinessVendor): string {
  const place = vendor.metadata?.taxPlace;
  if (place && typeof place === 'object') {
    const country = (place as { country?: unknown }).country;
    if (typeof country === 'string' && /^[A-Za-z]{2}$/.test(country)) return country.toUpperCase();
  }
  return '';
}

export function vendor1099Readiness(input: {
  vendors: readonly ReadinessVendor[];
  payments: readonly ReadinessPayment[];
  taxYear: number;
  homeCurrency: string;
}): VendorReadinessReport {
  const { taxYear, homeCurrency } = input;
  const thresholdCents = threshold1099Cents(taxYear, '1099-NEC', '1a');
  const yearPrefix = `${taxYear}-`;

  const vendors = new Map<string, ReadinessVendor>();
  for (const vendor of input.vendors) if (vendor && vendor.id && !vendors.has(vendor.id)) vendors.set(vendor.id, vendor);

  const paid = new Map<string, { cents: number; name: string; incomplete: boolean }>();
  let ignoredPayments = 0;
  let outsideTaxYear = 0;
  let skippedForeignCurrencyPayments = 0;
  for (const payment of input.payments) {
    if (!payment || !Number.isSafeInteger(payment.amountCents) || payment.amountCents <= 0) { ignoredPayments++; continue; }
    if (payment.direction && payment.direction !== 'made') { ignoredPayments++; continue; }
    if (payment.status && payment.status !== 'posted') { ignoredPayments++; continue; }
    if (typeof payment.date !== 'string' || !payment.date.startsWith(yearPrefix)) { outsideTaxYear++; continue; }
    const currency = (payment.currency || homeCurrency).toUpperCase();
    if (currency !== homeCurrency.toUpperCase()) { skippedForeignCurrencyPayments++; continue; }
    const current = paid.get(payment.contactId) || { cents: 0, name: payment.contactName || '', incomplete: false };
    current.cents += payment.amountCents;
    current.name = current.name || payment.contactName || '';
    // A vendor removed from the workspace still has a payment: the row says so instead of dropping it.
    paid.set(payment.contactId, current);
  }

  const rows: VendorReadinessRow[] = [];
  for (const [vendorId, total] of paid) {
    const vendor = vendors.get(vendorId);
    const taxId = vendor ? taxIdOf(vendor) : '';
    const addressRecorded = Boolean(vendor?.address && vendor.address.trim());
    const overThreshold = total.cents >= thresholdCents;
    const missing: string[] = [];
    if (!vendor) missing.push('The vendor record is not loaded or was removed; the payment cannot be attributed.');
    if (!taxId) missing.push('No tax ID is recorded on the vendor.');
    if (!addressRecorded) missing.push('No address is recorded on the vendor.');
    if (vendor && !vendor.is1099 && !vendor.isForeign) missing.push('The vendor is not marked as a 1099 vendor.');
    if (!countryOf(vendor || { id: vendorId, name: '' })) missing.push('No tax country is recorded; “US” is not assumed.');
    missing.push('No W-9 or tax form is recorded in this workspace (there is no such field yet).');
    rows.push({
      vendorId,
      vendor: vendor?.name || total.name || vendorId,
      country: countryOf(vendor || { id: vendorId, name: '' }) || 'Not recorded',
      paidCents: total.cents,
      thresholdCents,
      overThreshold,
      taxId: { recorded: Boolean(taxId), masked: maskRecordedTaxId(taxId), raw: '' },
      addressRecorded,
      w9Recorded: false,
      state: overThreshold ? (taxId && addressRecorded ? 'over-threshold' : 'needs-tax-details') : 'below-threshold',
      missing,
    });
  }

  const unmarkedWithPayments = rows.filter(row => {
    const vendor = vendors.get(row.vendorId);
    return Boolean(vendor) && !vendor!.is1099 && !vendor!.isForeign;
  }).length;

  rows.sort((a, b) => b.paidCents - a.paidCents || a.vendor.localeCompare(b.vendor) || a.vendorId.localeCompare(b.vendorId));
  return { taxYear, thresholdCents, rows, skippedForeignCurrencyPayments, ignoredPayments, unmarkedWithPayments, outsideTaxYear };
}

export const VENDOR_1099_CSV_HEADERS = [
  'Tax year', 'Vendor', 'Vendor id', 'Tax country', 'Paid (home currency)', 'Threshold', 'Over threshold',
  'Tax ID', 'Address recorded', 'W-9 recorded', 'Readiness', 'What to check',
];

/** The CSV never carries a full tax ID: the mask is what the screen shows. */
export function vendor1099CsvRows(report: VendorReadinessReport): Array<Array<string>> {
  return report.rows.map(row => [
    String(report.taxYear), row.vendor, row.vendorId, row.country,
    (row.paidCents / 100).toFixed(2), (row.thresholdCents / 100).toFixed(2), row.overThreshold ? 'Yes' : 'No',
    row.taxId.masked || 'Not recorded', row.addressRecorded ? 'Yes' : 'No', 'No',
    row.state, row.missing.join(' '),
  ]);
}
