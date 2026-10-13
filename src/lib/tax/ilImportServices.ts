/**
 * A-56 (PLAN): Israeli VAT on purchases from abroad — the reverse-charge self-assessment for
 * services bought from a foreign supplier (VAT Law Section 20, the "מע״מ עסקאות" mechanism) and the
 * customs collection on imported goods, as dated rules; plus the read-only list of recorded bills
 * the rule can apply to.
 *
 * What this is: the graph's answer to "an Israeli business bought from abroad — who accounts for the
 * Israeli VAT", at the rate in force on the date (A-29's own IL_VAT_STANDARD rows), and a review
 * list of bills whose vendor's recorded country is not Israel. What it is not: a posted
 * self-assessment (posting stays the accountant's lane, AI #1), a goods/services decision (the list
 * never assumes which a bill was — the mechanism differs and the note says so), or a conversion of
 * foreign-currency bills (they are counted, never converted).
 */
import { IL_VAT_STANDARD, rateOn } from './ilVatRates';
import { rateRule, where, slug, type ImportVatEffect, type TaxRulePack } from '../rules/packs/shared';

const ITA = { authority: 'Israel Tax Authority', url: 'https://www.gov.il/he/departments/israel_tax_authority', retrieved: '2026-10-13' };

/* ------------------------------------------------------------------ the rules */

export function ilImportServicesPack(): TaxRulePack {
  const rules = IL_VAT_STANDARD.flatMap(dated => [
    rateRule<ImportVatEffect>({
      id: `il-import-services-${slug(dated.validFrom)}`,
      name: `Israel: self-assessed VAT on services bought from abroad (${(dated.rate * 100).toFixed(0)}%)`,
      scope: 'line',
      when: [where('country', ['IL']), where('payeeResidence', ['foreign']), where('supplyKind', ['services'])],
      effect: {
        kind: 'import-vat',
        supply: 'services',
        collectedBy: 'self-assessment',
        rate: dated.rate,
        basis: 'VAT Law Section 20 and the imported-services rules (מע״מ עסקאות): an Israeli business reports the VAT on services bought from a foreign supplier in its own periodic return',
        note: 'the foreign supplier charges no Israeli VAT; the business self-assesses at the rate in force on the purchase date and reclaims it by the ordinary input-tax rules where it may',
      },
      validFrom: dated.validFrom,
      ...(dated.validTo ? { validTo: dated.validTo } : {}),
      source: ITA,
    }),
    rateRule<ImportVatEffect>({
      id: `il-import-goods-${slug(dated.validFrom)}`,
      name: `Israel: customs collects the VAT on imported goods (${(dated.rate * 100).toFixed(0)}%)`,
      scope: 'document',
      when: [where('country', ['IL']), where('payeeResidence', ['foreign']), where('supplyKind', ['goods'])],
      effect: {
        kind: 'import-vat',
        supply: 'goods',
        collectedBy: 'customs',
        rate: dated.rate,
        basis: 'the VAT on imported goods is paid to customs at the import, at the rate in force on the entry date',
        note: 'the foreign supplier’s invoice for the goods carries no Israeli VAT; the import document is the evidence for the input-tax claim',
      },
      validFrom: dated.validFrom,
      ...(dated.validTo ? { validTo: dated.validTo } : {}),
      source: ITA,
    }),
  ]);
  return { id: 'il-import-services', name: 'Israel VAT on purchases from abroad', rules, unmapped: [] };
}

/* ------------------------------------------------------------- the bill review */

export interface ImportBill {
  id: string;
  workspaceId?: string;
  vendorId?: string;
  vendorName?: string;
  number?: string;
  date?: string;
  issueDate?: string;
  amountCents: number;
  currency?: string;
  status?: string;
  taxAmountCents?: number;
  taxCents?: number;
  salesTaxCents?: number;
}

export interface ImportVendor {
  id: string;
  name?: string;
  metadata?: unknown;
}

export interface ImportBillRow {
  billId: string;
  date: string;
  vendor: string;
  vendorCountry: string;
  billNumber: string;
  amountCents: number;
  currency: string;
  /** VAT recorded on the bill itself — flagged when a foreign vendor's bill carries any */
  vatOnBillCents: number;
  /** the Israeli rate in force on the bill's date, or undefined when the table has none */
  ilRate: number | undefined;
  /** amount × the rate in force — an indication for the reviewer, never an accrual or a posting */
  referenceVatCents: number;
  note: string;
}

export interface ImportBillReview {
  from: string;
  to: string;
  rows: ImportBillRow[];
  totals: { bills: number; amountCents: number; referenceVatCents: number };
  skipped: { israeliVendor: number; countryNotRecorded: number; otherCurrency: number; undated: number; notRecorded: number };
  problem?: string;
}

const RECORDED_STATUSES = new Set(['pending', 'approved', 'paid', 'partially_paid', 'overdue', 'unpaid']);
const NOT_RECORDED = new Set(['draft', 'void', 'cancelled', 'rejected']);

/** The vendor's recorded country from its metadata tax place (the C-48 reading), or undefined. */
export function vendorCountryOf(vendor?: ImportVendor): string | undefined {
  const metadata = vendor?.metadata as { taxPlace?: { country?: unknown } } | undefined;
  const country = metadata?.taxPlace?.country;
  return typeof country === 'string' && /^[A-Za-z]{2}$/.test(country) ? country.toUpperCase() : undefined;
}

const vatOn = (bill: ImportBill) => Math.max(0, bill.taxAmountCents || 0, bill.taxCents || 0, bill.salesTaxCents || 0);

/**
 * The bills of the period whose vendor's recorded country is not Israel — the list the A-56 rules
 * can apply to. Pure: nothing is posted or accrued, every figure stays in the bill's own currency.
 */
export function importBillsReview(input: {
  bills: ImportBill[];
  vendors: ImportVendor[];
  from: string;
  to: string;
  workspaceId?: string;
  homeCurrency?: string;
}): ImportBillReview {
  const home = (input.homeCurrency || 'ILS').toUpperCase();
  const skipped = { israeliVendor: 0, countryNotRecorded: 0, otherCurrency: 0, undated: 0, notRecorded: 0 };
  const review: ImportBillReview = { from: input.from, to: input.to, rows: [], totals: { bills: 0, amountCents: 0, referenceVatCents: 0 }, skipped };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from) || !/^\d{4}-\d{2}-\d{2}$/.test(input.to) || input.from > input.to) {
    return { ...review, problem: 'The period needs two dates, from first.' };
  }
  const vendorsById = new Map(input.vendors.map(vendor => [vendor.id, vendor]));
  const scoped = input.bills.filter(bill => !input.workspaceId || !bill.workspaceId || bill.workspaceId === input.workspaceId);
  for (const bill of scoped) {
    if (bill.status && (NOT_RECORDED.has(bill.status) || !RECORDED_STATUSES.has(bill.status))) { skipped.notRecorded++; continue; }
    const date = bill.date || bill.issueDate || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { skipped.undated++; continue; }
    if (date < input.from || date > input.to) continue; // dated outside the period: not this review
    const vendor = bill.vendorId ? vendorsById.get(bill.vendorId) : undefined;
    const country = vendorCountryOf(vendor);
    if (!country) { skipped.countryNotRecorded++; continue; }
    if (country === 'IL') { skipped.israeliVendor++; continue; }
    if ((bill.currency || home).toUpperCase() !== home) { skipped.otherCurrency++; continue; }
    const dated = rateOn(IL_VAT_STANDARD, date);
    const vat = vatOn(bill);
    const row: ImportBillRow = {
      billId: bill.id, date,
      vendor: bill.vendorName || vendor?.name || '',
      vendorCountry: country,
      billNumber: bill.number || '',
      amountCents: bill.amountCents,
      currency: home,
      vatOnBillCents: vat,
      ilRate: dated?.rate,
      referenceVatCents: dated ? Math.round(bill.amountCents * dated.rate) : 0,
      note: vat > 0 ? 'the bill already carries VAT — review what it is before self-assessing anything'
        : dated ? 'goods or services decides the mechanism: customs at the import, or self-assessment in the periodic return'
        : 'no Israeli rate is known for this date in the table',
    };
    review.rows.push(row);
  }
  review.rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.vendor.localeCompare(b.vendor)));
  review.totals = {
    bills: review.rows.length,
    amountCents: review.rows.reduce((sum, row) => sum + row.amountCents, 0),
    referenceVatCents: review.rows.reduce((sum, row) => sum + row.referenceVatCents, 0),
  };
  return review;
}

export const IMPORT_BILLS_CSV_HEADERS = ['Bill date', 'Vendor', 'Vendor country', 'Bill number', 'Amount', 'VAT on the bill', 'IL rate %', 'Reference VAT', 'Currency', 'Note'];

export function importBillsCsvRows(review: ImportBillReview): string[][] {
  return review.rows.map(row => [
    row.date, row.vendor, row.vendorCountry, row.billNumber,
    (row.amountCents / 100).toFixed(2), (row.vatOnBillCents / 100).toFixed(2),
    row.ilRate !== undefined ? (row.ilRate * 100).toFixed(0) : '',
    (row.referenceVatCents / 100).toFixed(2), row.currency, row.note,
  ]);
}
