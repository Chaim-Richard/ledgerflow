/**
 * A-146 / A-147: golden fixtures for AI #1's tax engine — IL and US only (PLAN §15, 18 Oct:
 * UK/EU invoice cases dropped). Every expected amount below is a literal, hand-checked against
 * the dated table it names; the checker functions recompute from those tables so a table change
 * that breaks a fixture fails loudly here instead of silently changing a return.
 *
 * Honest limits, stated on the screen too:
 * - Amounts are tax-exclusive (net) whole cents; tax per line is round(net × rate), half up.
 * - US invoice cases use the **state base rate only** (A-22 table). County/city/district taxes
 *   are not included, so these fixtures must never be read as a full US sales-tax amount.
 * - IL withholding cases use the app's existing helper basis (payment less VAT, A-43); the
 *   regulations' base question is unsettled in A-43 and an accountant confirms it. A vendor's
 *   own approval (certificate rate) always replaces the default when one is recorded.
 * - US 1099 cases test the threshold table only (A-188/E-10): reportable means paid >= the
 *   threshold for that form/box/year. Nothing files, posts or calculates a return.
 * Sources: Israel Tax Authority (IL VAT / withholding defaults) and the state revenue
 * departments / IRS pages named in the underlying tables (ilVatRates, usStateSalesTax,
 * ilWithholdingDefaults, us1099Preview).
 */
import { rateOn, IL_VAT_STANDARD } from './ilVatRates';
import { stateSalesTaxRate } from './usStateSalesTax';
import { ilWithholdingDefault, type IlWithholdingPaymentType, type IlWithholdingPayeeResidence } from './ilWithholdingDefaults';
import { withheldCents } from './withholding';
import { threshold1099Cents, type Form1099Box, type Form1099Kind } from './us1099Preview';

export type GoldenTreatment = 'standard' | 'eilat' | 'export' | 'exempt-certificate';
export interface GoldenInvoiceLine { netCents: number; expectedRate: number; expectedTaxCents: number }
export interface GoldenInvoiceCase {
  id: string; country: 'IL' | 'US'; date: string; currency: 'ILS' | 'USD';
  /** IL: city/area label; 'eilat' and 'export' are zero-rated treatments. US: buyer state code. */
  place: string; treatment: GoldenTreatment; lines: GoldenInvoiceLine[];
  expectedTaxTotalCents: number; expectedGrossCents: number; source: string;
}
export interface GoldenBillCase {
  id: string; country: 'IL' | 'US'; date: string; currency: 'ILS' | 'USD';
  // IL withholding
  paymentType?: IlWithholdingPaymentType; residence?: IlWithholdingPayeeResidence;
  paidCents: number; vatCents?: number; certificateRatePercent?: number;
  expectedRatePercent?: number; expectedWithheldCents?: number;
  // US 1099
  form?: Form1099Kind; box?: Form1099Box; tinRecorded?: boolean;
  expectedThresholdCents?: number; expectedReportable?: boolean; source: string;
}
const ITA = 'https://www.gov.il/he/departments/israel_tax_authority';
const IRS1099 = 'https://www.irs.gov/instructions/i1099mec';

export const GOLDEN_INVOICES: GoldenInvoiceCase[] = [
  { id: 'GF-INV-01', country: 'IL', date: '2024-03-15', currency: 'ILS', place: 'tel-aviv', treatment: 'standard', lines: [{ netCents: 10000, expectedRate: 0.17, expectedTaxCents: 1700 }], expectedTaxTotalCents: 1700, expectedGrossCents: 11700, source: ITA },
  { id: 'GF-INV-02', country: 'IL', date: '2024-03-15', currency: 'ILS', place: 'tel-aviv', treatment: 'standard', lines: [{ netCents: 100000, expectedRate: 0.17, expectedTaxCents: 17000 }], expectedTaxTotalCents: 17000, expectedGrossCents: 117000, source: ITA },
  { id: 'GF-INV-03', country: 'IL', date: '2024-12-31', currency: 'ILS', place: 'jerusalem', treatment: 'standard', lines: [{ netCents: 3333, expectedRate: 0.17, expectedTaxCents: 567 }], expectedTaxTotalCents: 567, expectedGrossCents: 3900, source: ITA },
  { id: 'GF-INV-04', country: 'IL', date: '2024-06-01', currency: 'ILS', place: 'haifa', treatment: 'standard', lines: [{ netCents: 1, expectedRate: 0.17, expectedTaxCents: 0 }], expectedTaxTotalCents: 0, expectedGrossCents: 1, source: ITA },
  { id: 'GF-INV-05', country: 'IL', date: '2024-06-01', currency: 'ILS', place: 'haifa', treatment: 'standard', lines: [{ netCents: 9999, expectedRate: 0.17, expectedTaxCents: 1700 }, { netCents: 1, expectedRate: 0.17, expectedTaxCents: 0 }], expectedTaxTotalCents: 1700, expectedGrossCents: 11700, source: ITA },
  { id: 'GF-INV-06', country: 'IL', date: '2025-01-01', currency: 'ILS', place: 'tel-aviv', treatment: 'standard', lines: [{ netCents: 10000, expectedRate: 0.18, expectedTaxCents: 1800 }], expectedTaxTotalCents: 1800, expectedGrossCents: 11800, source: ITA },
  { id: 'GF-INV-07', country: 'IL', date: '2025-01-01', currency: 'ILS', place: 'tel-aviv', treatment: 'standard', lines: [{ netCents: 100000, expectedRate: 0.18, expectedTaxCents: 18000 }], expectedTaxTotalCents: 18000, expectedGrossCents: 118000, source: ITA },
  { id: 'GF-INV-08', country: 'IL', date: '2025-06-30', currency: 'ILS', place: 'beer-sheva', treatment: 'standard', lines: [{ netCents: 3333, expectedRate: 0.18, expectedTaxCents: 600 }], expectedTaxTotalCents: 600, expectedGrossCents: 3933, source: ITA },
  { id: 'GF-INV-09', country: 'IL', date: '2025-06-30', currency: 'ILS', place: 'beer-sheva', treatment: 'standard', lines: [{ netCents: 9999, expectedRate: 0.18, expectedTaxCents: 1800 }, { netCents: 5001, expectedRate: 0.18, expectedTaxCents: 900 }, { netCents: 2500, expectedRate: 0.18, expectedTaxCents: 450 }], expectedTaxTotalCents: 3150, expectedGrossCents: 20650, source: ITA },
  { id: 'GF-INV-10', country: 'IL', date: '2026-02-01', currency: 'ILS', place: 'tel-aviv', treatment: 'standard', lines: [{ netCents: 123456, expectedRate: 0.18, expectedTaxCents: 22222 }], expectedTaxTotalCents: 22222, expectedGrossCents: 145678, source: ITA },
  { id: 'GF-INV-11', country: 'IL', date: '2026-02-01', currency: 'ILS', place: 'tel-aviv', treatment: 'standard', lines: [{ netCents: 7, expectedRate: 0.18, expectedTaxCents: 1 }], expectedTaxTotalCents: 1, expectedGrossCents: 8, source: ITA },
  { id: 'GF-INV-12', country: 'IL', date: '2024-05-01', currency: 'ILS', place: 'eilat', treatment: 'eilat', lines: [{ netCents: 100000, expectedRate: 0, expectedTaxCents: 0 }], expectedTaxTotalCents: 0, expectedGrossCents: 100000, source: ITA },
  { id: 'GF-INV-13', country: 'IL', date: '2025-05-01', currency: 'ILS', place: 'eilat', treatment: 'eilat', lines: [{ netCents: 100000, expectedRate: 0, expectedTaxCents: 0 }, { netCents: 50000, expectedRate: 0, expectedTaxCents: 0 }], expectedTaxTotalCents: 0, expectedGrossCents: 150000, source: ITA },
  { id: 'GF-INV-14', country: 'IL', date: '2025-05-01', currency: 'ILS', place: 'export', treatment: 'export', lines: [{ netCents: 250000, expectedRate: 0, expectedTaxCents: 0 }], expectedTaxTotalCents: 0, expectedGrossCents: 250000, source: ITA },
  { id: 'GF-INV-15', country: 'IL', date: '2024-05-01', currency: 'ILS', place: 'export', treatment: 'export', lines: [{ netCents: 9999, expectedRate: 0, expectedTaxCents: 0 }], expectedTaxTotalCents: 0, expectedGrossCents: 9999, source: ITA },
  { id: 'GF-INV-16', country: 'IL', date: '2025-03-01', currency: 'ILS', place: 'tel-aviv', treatment: 'standard', lines: [{ netCents: 50000, expectedRate: 0.18, expectedTaxCents: 9000 }, { netCents: 50000, expectedRate: 0.18, expectedTaxCents: 9000 }], expectedTaxTotalCents: 18000, expectedGrossCents: 118000, source: ITA },
  { id: 'GF-INV-17', country: 'IL', date: '2025-03-01', currency: 'ILS', place: 'eilat', treatment: 'eilat', lines: [{ netCents: 50000, expectedRate: 0, expectedTaxCents: 0 }], expectedTaxTotalCents: 0, expectedGrossCents: 50000, source: ITA },
  { id: 'GF-INV-18', country: 'IL', date: '2024-11-11', currency: 'ILS', place: 'rishon', treatment: 'standard', lines: [{ netCents: 12345, expectedRate: 0.17, expectedTaxCents: 2099 }, { netCents: 6789, expectedRate: 0.17, expectedTaxCents: 1154 }], expectedTaxTotalCents: 3253, expectedGrossCents: 22387, source: ITA },
  { id: 'GF-INV-19', country: 'IL', date: '2026-01-15', currency: 'ILS', place: 'tel-aviv', treatment: 'standard', lines: [{ netCents: 100, expectedRate: 0.18, expectedTaxCents: 18 }], expectedTaxTotalCents: 18, expectedGrossCents: 118, source: ITA },
  { id: 'GF-INV-20', country: 'IL', date: '2026-01-15', currency: 'ILS', place: 'tel-aviv', treatment: 'standard', lines: [{ netCents: 101, expectedRate: 0.18, expectedTaxCents: 18 }], expectedTaxTotalCents: 18, expectedGrossCents: 119, source: ITA },
  { id: 'GF-INV-21', country: 'IL', date: '2025-09-09', currency: 'ILS', place: 'haifa', treatment: 'standard', lines: [{ netCents: 19999, expectedRate: 0.18, expectedTaxCents: 3600 }], expectedTaxTotalCents: 3600, expectedGrossCents: 23599, source: ITA },
  { id: 'GF-INV-22', country: 'IL', date: '2025-09-09', currency: 'ILS', place: 'eilat', treatment: 'eilat', lines: [{ netCents: 19999, expectedRate: 0, expectedTaxCents: 0 }], expectedTaxTotalCents: 0, expectedGrossCents: 19999, source: ITA },
  { id: 'GF-INV-23', country: 'IL', date: '2024-02-29', currency: 'ILS', place: 'tel-aviv', treatment: 'standard', lines: [{ netCents: 2900, expectedRate: 0.17, expectedTaxCents: 493 }], expectedTaxTotalCents: 493, expectedGrossCents: 3393, source: ITA },
  { id: 'GF-INV-24', country: 'IL', date: '2025-12-31', currency: 'ILS', place: 'jerusalem', treatment: 'standard', lines: [{ netCents: 45000, expectedRate: 0.18, expectedTaxCents: 8100 }, { netCents: 45000, expectedRate: 0.18, expectedTaxCents: 8100 }, { netCents: 10000, expectedRate: 0.18, expectedTaxCents: 1800 }], expectedTaxTotalCents: 18000, expectedGrossCents: 118000, source: ITA },
  { id: 'GF-INV-25', country: 'IL', date: '2026-06-01', currency: 'ILS', place: 'export', treatment: 'export', lines: [{ netCents: 1000000, expectedRate: 0, expectedTaxCents: 0 }], expectedTaxTotalCents: 0, expectedGrossCents: 1000000, source: ITA },
  { id: 'GF-INV-26', country: 'US', date: '2025-04-01', currency: 'USD', place: 'TX', treatment: 'standard', lines: [{ netCents: 10000, expectedRate: 0.0625, expectedTaxCents: 625 }], expectedTaxTotalCents: 625, expectedGrossCents: 10625, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-27', country: 'US', date: '2025-04-01', currency: 'USD', place: 'TX', treatment: 'standard', lines: [{ netCents: 100000, expectedRate: 0.0625, expectedTaxCents: 6250 }], expectedTaxTotalCents: 6250, expectedGrossCents: 106250, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-28', country: 'US', date: '2025-04-01', currency: 'USD', place: 'CA', treatment: 'standard', lines: [{ netCents: 10000, expectedRate: 0.0725, expectedTaxCents: 725 }], expectedTaxTotalCents: 725, expectedGrossCents: 10725, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-29', country: 'US', date: '2025-04-01', currency: 'USD', place: 'CA', treatment: 'standard', lines: [{ netCents: 9999, expectedRate: 0.0725, expectedTaxCents: 725 }], expectedTaxTotalCents: 725, expectedGrossCents: 10724, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-30', country: 'US', date: '2026-01-10', currency: 'USD', place: 'NY', treatment: 'standard', lines: [{ netCents: 25000, expectedRate: 0.04, expectedTaxCents: 1000 }], expectedTaxTotalCents: 1000, expectedGrossCents: 26000, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-31', country: 'US', date: '2026-01-10', currency: 'USD', place: 'FL', treatment: 'standard', lines: [{ netCents: 3333, expectedRate: 0.06, expectedTaxCents: 200 }], expectedTaxTotalCents: 200, expectedGrossCents: 3533, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-32', country: 'US', date: '2025-07-04', currency: 'USD', place: 'WA', treatment: 'standard', lines: [{ netCents: 50000, expectedRate: 0.065, expectedTaxCents: 3250 }], expectedTaxTotalCents: 3250, expectedGrossCents: 53250, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-33', country: 'US', date: '2025-07-04', currency: 'USD', place: 'AZ', treatment: 'standard', lines: [{ netCents: 12345, expectedRate: 0.056, expectedTaxCents: 691 }], expectedTaxTotalCents: 691, expectedGrossCents: 13036, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-34', country: 'US', date: '2025-07-04', currency: 'USD', place: 'CO', treatment: 'standard', lines: [{ netCents: 100000, expectedRate: 0.029, expectedTaxCents: 2900 }], expectedTaxTotalCents: 2900, expectedGrossCents: 102900, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-35', country: 'US', date: '2025-07-04', currency: 'USD', place: 'NJ', treatment: 'standard', lines: [{ netCents: 10000, expectedRate: 0.06625, expectedTaxCents: 663 }], expectedTaxTotalCents: 663, expectedGrossCents: 10663, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-36', country: 'US', date: '2025-07-04', currency: 'USD', place: 'GA', treatment: 'standard', lines: [{ netCents: 7500, expectedRate: 0.04, expectedTaxCents: 300 }, { netCents: 2500, expectedRate: 0.04, expectedTaxCents: 100 }], expectedTaxTotalCents: 400, expectedGrossCents: 10400, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-37', country: 'US', date: '2025-07-04', currency: 'USD', place: 'OR', treatment: 'standard', lines: [{ netCents: 100000, expectedRate: 0, expectedTaxCents: 0 }], expectedTaxTotalCents: 0, expectedGrossCents: 100000, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-38', country: 'US', date: '2025-07-04', currency: 'USD', place: 'DE', treatment: 'standard', lines: [{ netCents: 100000, expectedRate: 0, expectedTaxCents: 0 }], expectedTaxTotalCents: 0, expectedGrossCents: 100000, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-39', country: 'US', date: '2025-07-04', currency: 'USD', place: 'MT', treatment: 'standard', lines: [{ netCents: 100000, expectedRate: 0, expectedTaxCents: 0 }], expectedTaxTotalCents: 0, expectedGrossCents: 100000, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-40', country: 'US', date: '2025-07-04', currency: 'USD', place: 'TX', treatment: 'exempt-certificate', lines: [{ netCents: 10000, expectedRate: 0, expectedTaxCents: 0 }], expectedTaxTotalCents: 0, expectedGrossCents: 10000, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-41', country: 'US', date: '2025-07-04', currency: 'USD', place: 'CA', treatment: 'exempt-certificate', lines: [{ netCents: 10000, expectedRate: 0, expectedTaxCents: 0 }], expectedTaxTotalCents: 0, expectedGrossCents: 10000, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-42', country: 'US', date: '2025-07-04', currency: 'USD', place: 'TX', treatment: 'export', lines: [{ netCents: 10000, expectedRate: 0, expectedTaxCents: 0 }], expectedTaxTotalCents: 0, expectedGrossCents: 10000, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-43', country: 'US', date: '2026-03-01', currency: 'USD', place: 'TX', treatment: 'standard', lines: [{ netCents: 1, expectedRate: 0.0625, expectedTaxCents: 0 }], expectedTaxTotalCents: 0, expectedGrossCents: 1, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-44', country: 'US', date: '2026-03-01', currency: 'USD', place: 'TX', treatment: 'standard', lines: [{ netCents: 3333, expectedRate: 0.0625, expectedTaxCents: 208 }, { netCents: 3333, expectedRate: 0.0625, expectedTaxCents: 208 }, { netCents: 3334, expectedRate: 0.0625, expectedTaxCents: 208 }], expectedTaxTotalCents: 624, expectedGrossCents: 10624, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-45', country: 'US', date: '2024-08-01', currency: 'USD', place: 'FL', treatment: 'standard', lines: [{ netCents: 19999, expectedRate: 0.06, expectedTaxCents: 1200 }], expectedTaxTotalCents: 1200, expectedGrossCents: 21199, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-46', country: 'US', date: '2024-08-01', currency: 'USD', place: 'NY', treatment: 'standard', lines: [{ netCents: 500000, expectedRate: 0.04, expectedTaxCents: 20000 }], expectedTaxTotalCents: 20000, expectedGrossCents: 520000, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-47', country: 'US', date: '2026-05-05', currency: 'USD', place: 'WA', treatment: 'standard', lines: [{ netCents: 7, expectedRate: 0.065, expectedTaxCents: 0 }], expectedTaxTotalCents: 0, expectedGrossCents: 7, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-48', country: 'US', date: '2026-05-05', currency: 'USD', place: 'NJ', treatment: 'standard', lines: [{ netCents: 9999, expectedRate: 0.06625, expectedTaxCents: 662 }], expectedTaxTotalCents: 662, expectedGrossCents: 10661, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-49', country: 'US', date: '2025-11-11', currency: 'USD', place: 'CA', treatment: 'standard', lines: [{ netCents: 20000, expectedRate: 0.0725, expectedTaxCents: 1450 }, { netCents: 30000, expectedRate: 0.0725, expectedTaxCents: 2175 }], expectedTaxTotalCents: 3625, expectedGrossCents: 53625, source: 'usStateSalesTax row (state revenue department)' },
  { id: 'GF-INV-50', country: 'US', date: '2025-11-11', currency: 'USD', place: 'TX', treatment: 'standard', lines: [{ netCents: 6250, expectedRate: 0.0625, expectedTaxCents: 391 }], expectedTaxTotalCents: 391, expectedGrossCents: 6641, source: 'usStateSalesTax row (state revenue department)' },
];

export const GOLDEN_BILLS: GoldenBillCase[] = [
  { id: 'GF-BILL-01', country: 'IL', date: '2025-06-01', currency: 'ILS', paymentType: 'services-or-assets', residence: 'israel', paidCents: 118000, vatCents: 18000, expectedRatePercent: 30, expectedWithheldCents: 30000, source: ITA },
  { id: 'GF-BILL-02', country: 'IL', date: '2025-06-01', currency: 'ILS', paymentType: 'services-or-assets', residence: 'israel', paidCents: 118000, vatCents: 18000, certificateRatePercent: 0, expectedRatePercent: 0, expectedWithheldCents: 0, source: ITA },
  { id: 'GF-BILL-03', country: 'IL', date: '2025-06-01', currency: 'ILS', paymentType: 'services-or-assets', residence: 'israel', paidCents: 118000, vatCents: 18000, certificateRatePercent: 10, expectedRatePercent: 10, expectedWithheldCents: 10000, source: ITA },
  { id: 'GF-BILL-04', country: 'IL', date: '2025-06-01', currency: 'ILS', paymentType: 'services-or-assets', residence: 'foreign', paidCents: 100000, vatCents: 0, expectedRatePercent: 25, expectedWithheldCents: 25000, source: ITA },
  { id: 'GF-BILL-05', country: 'IL', date: '2025-06-01', currency: 'ILS', paymentType: 'rent-expense', residence: 'israel', paidCents: 118000, vatCents: 18000, expectedRatePercent: 35, expectedWithheldCents: 35000, source: ITA },
  { id: 'GF-BILL-06', country: 'IL', date: '2025-06-01', currency: 'ILS', paymentType: 'rent-expense', residence: 'foreign', paidCents: 90000, vatCents: 0, expectedRatePercent: 25, expectedWithheldCents: 22500, source: ITA },
  { id: 'GF-BILL-07', country: 'IL', date: '2025-06-01', currency: 'ILS', paymentType: 'interest', residence: 'israel', paidCents: 50000, vatCents: 0, expectedRatePercent: 25, expectedWithheldCents: 12500, source: ITA },
  { id: 'GF-BILL-08', country: 'IL', date: '2025-06-01', currency: 'ILS', paymentType: 'interest', residence: 'foreign', paidCents: 50000, vatCents: 0, expectedRatePercent: 25, expectedWithheldCents: 12500, source: ITA },
  { id: 'GF-BILL-09', country: 'IL', date: '2025-06-01', currency: 'ILS', paymentType: 'royalty', residence: 'foreign', paidCents: 200000, vatCents: 0, expectedRatePercent: 25, expectedWithheldCents: 50000, source: ITA },
  { id: 'GF-BILL-10', country: 'IL', date: '2025-06-01', currency: 'ILS', paymentType: 'services-or-assets', residence: 'israel', paidCents: 59000, vatCents: 9000, certificateRatePercent: 20, expectedRatePercent: 20, expectedWithheldCents: 10000, source: ITA },
  { id: 'GF-BILL-11', country: 'IL', date: '2025-06-01', currency: 'ILS', paymentType: 'services-or-assets', residence: 'israel', paidCents: 100, vatCents: 0, expectedRatePercent: 30, expectedWithheldCents: 30, source: ITA },
  { id: 'GF-BILL-12', country: 'IL', date: '2025-06-01', currency: 'ILS', paymentType: 'services-or-assets', residence: 'israel', paidCents: 3333, vatCents: 0, expectedRatePercent: 30, expectedWithheldCents: 1000, source: ITA },
  { id: 'GF-BILL-13', country: 'IL', date: '2025-06-01', currency: 'ILS', paymentType: 'rent-expense', residence: 'israel', paidCents: 236000, vatCents: 36000, certificateRatePercent: 0, expectedRatePercent: 0, expectedWithheldCents: 0, source: ITA },
  { id: 'GF-BILL-14', country: 'IL', date: '2025-06-01', currency: 'ILS', paymentType: 'interest', residence: 'israel', paidCents: 12345, vatCents: 0, certificateRatePercent: 15, expectedRatePercent: 15, expectedWithheldCents: 1852, source: ITA },
  { id: 'GF-BILL-15', country: 'IL', date: '2025-06-01', currency: 'ILS', paymentType: 'services-or-assets', residence: 'foreign', paidCents: 9999, vatCents: 0, certificateRatePercent: 5, expectedRatePercent: 5, expectedWithheldCents: 500, source: ITA },
  { id: 'GF-BILL-16', country: 'US', date: '2025-06-01', currency: 'USD', form: '1099-NEC', box: '1a', paidCents: 60000, tinRecorded: true, expectedThresholdCents: 60000, expectedReportable: true, source: IRS1099 },
  { id: 'GF-BILL-17', country: 'US', date: '2025-06-01', currency: 'USD', form: '1099-NEC', box: '1a', paidCents: 59999, tinRecorded: true, expectedThresholdCents: 60000, expectedReportable: false, source: IRS1099 },
  { id: 'GF-BILL-18', country: 'US', date: '2025-06-01', currency: 'USD', form: '1099-NEC', box: '1a', paidCents: 250000, tinRecorded: true, expectedThresholdCents: 60000, expectedReportable: true, source: IRS1099 },
  { id: 'GF-BILL-19', country: 'US', date: '2026-06-01', currency: 'USD', form: '1099-NEC', box: '1a', paidCents: 150000, tinRecorded: true, expectedThresholdCents: 200000, expectedReportable: false, source: IRS1099 },
  { id: 'GF-BILL-20', country: 'US', date: '2026-06-01', currency: 'USD', form: '1099-NEC', box: '1a', paidCents: 200000, tinRecorded: true, expectedThresholdCents: 200000, expectedReportable: true, source: IRS1099 },
  { id: 'GF-BILL-21', country: 'US', date: '2026-06-01', currency: 'USD', form: '1099-NEC', box: '1a', paidCents: 200001, tinRecorded: false, expectedThresholdCents: 200000, expectedReportable: true, source: IRS1099 },
  { id: 'GF-BILL-22', country: 'US', date: '2025-06-01', currency: 'USD', form: '1099-MISC', box: '1', paidCents: 60000, tinRecorded: true, expectedThresholdCents: 60000, expectedReportable: true, source: IRS1099 },
  { id: 'GF-BILL-23', country: 'US', date: '2025-06-01', currency: 'USD', form: '1099-MISC', box: '1', paidCents: 10000, tinRecorded: true, expectedThresholdCents: 60000, expectedReportable: false, source: IRS1099 },
  { id: 'GF-BILL-24', country: 'US', date: '2025-06-01', currency: 'USD', form: '1099-MISC', box: '2', paidCents: 1000, tinRecorded: true, expectedThresholdCents: 1000, expectedReportable: true, source: IRS1099 },
  { id: 'GF-BILL-25', country: 'US', date: '2025-06-01', currency: 'USD', form: '1099-MISC', box: '2', paidCents: 999, tinRecorded: true, expectedThresholdCents: 1000, expectedReportable: false, source: IRS1099 },
  { id: 'GF-BILL-26', country: 'US', date: '2025-06-01', currency: 'USD', form: '1099-MISC', box: '10', paidCents: 60000, tinRecorded: true, expectedThresholdCents: 60000, expectedReportable: true, source: IRS1099 },
  { id: 'GF-BILL-27', country: 'US', date: '2025-06-01', currency: 'USD', form: '1099-MISC', box: '10', paidCents: 59999, tinRecorded: true, expectedThresholdCents: 60000, expectedReportable: false, source: IRS1099 },
  { id: 'GF-BILL-28', country: 'US', date: '2026-06-01', currency: 'USD', form: '1099-MISC', box: '3', paidCents: 199999, tinRecorded: true, expectedThresholdCents: 200000, expectedReportable: false, source: IRS1099 },
  { id: 'GF-BILL-29', country: 'US', date: '2026-06-01', currency: 'USD', form: '1099-MISC', box: '3', paidCents: 500000, tinRecorded: false, expectedThresholdCents: 200000, expectedReportable: true, source: IRS1099 },
  { id: 'GF-BILL-30', country: 'US', date: '2025-06-01', currency: 'USD', form: '1099-NEC', box: '1a', paidCents: 0, tinRecorded: true, expectedThresholdCents: 60000, expectedReportable: false, source: IRS1099 },
];

/** Recompute one invoice case from the dated tables; undefined rate = table has no answer. */
export function recomputeInvoice(c: GoldenInvoiceCase): { rate: number; taxCents: number }[] {
  return c.lines.map(line => {
    let rate: number | undefined;
    if (c.treatment === 'eilat' || c.treatment === 'export' || c.treatment === 'exempt-certificate') rate = 0;
    else if (c.country === 'IL') rate = rateOn(IL_VAT_STANDARD, c.date)?.rate;
    else rate = stateSalesTaxRate(c.place, c.date);
    return { rate: rate ?? Number.NaN, taxCents: rate === undefined ? Number.NaN : Math.round(line.netCents * rate) };
  });
}
export interface GoldenFailure { id: string; detail: string }
export function verifyGoldenFixtures(): { invoices: number; bills: number; failures: GoldenFailure[] } {
  const failures: GoldenFailure[] = [];
  for (const c of GOLDEN_INVOICES) {
    const got = recomputeInvoice(c);
    c.lines.forEach((line, i) => {
      if (got[i].rate !== line.expectedRate || got[i].taxCents !== line.expectedTaxCents)
        failures.push({ id: c.id, detail: `line ${i + 1}: fixture says ${line.expectedRate}/${line.expectedTaxCents}, tables say ${got[i].rate}/${got[i].taxCents}` });
    });
    const tax = c.lines.reduce((s, l) => s + l.expectedTaxCents, 0);
    const net = c.lines.reduce((s, l) => s + l.netCents, 0);
    if (tax !== c.expectedTaxTotalCents || net + tax !== c.expectedGrossCents) failures.push({ id: c.id, detail: 'totals do not add up' });
  }
  for (const b of GOLDEN_BILLS) {
    if (b.country === 'IL') {
      const rate = b.certificateRatePercent ?? ilWithholdingDefault(b.paymentType!, b.residence!)?.ratePercent;
      const withheld = rate === undefined ? Number.NaN : withheldCents(b.paidCents, b.vatCents ?? 0, rate);
      if (rate !== b.expectedRatePercent || withheld !== b.expectedWithheldCents)
        failures.push({ id: b.id, detail: `fixture says ${b.expectedRatePercent}%/${b.expectedWithheldCents}, tables say ${rate}%/${withheld}` });
    } else {
      const th = threshold1099Cents(Number(b.date.slice(0, 4)), b.form!, b.box!);
      if (th !== b.expectedThresholdCents || (b.paidCents >= th) !== b.expectedReportable)
        failures.push({ id: b.id, detail: `fixture says threshold ${b.expectedThresholdCents}/reportable ${b.expectedReportable}, table says ${th}/${b.paidCents >= th}` });
    }
  }
  return { invoices: GOLDEN_INVOICES.length, bills: GOLDEN_BILLS.length, failures };
}
export const GOLDEN_CSV_HEADERS = ['Case', 'Kind', 'Country', 'Date', 'Place / form', 'Treatment / box', 'Net or paid (cents)', 'Expected rate', 'Expected tax / withheld (cents)', 'Expected total / reportable'];
export function goldenCsvRows(): string[][] {
  const rows: string[][] = [];
  for (const c of GOLDEN_INVOICES) rows.push([c.id, 'invoice', c.country, c.date, c.place, c.treatment, String(c.lines.reduce((s, l) => s + l.netCents, 0)), c.lines.map(l => String(l.expectedRate)).join(' '), String(c.expectedTaxTotalCents), String(c.expectedGrossCents)]);
  for (const b of GOLDEN_BILLS) rows.push(b.country === 'IL'
    ? [b.id, 'bill', 'IL', b.date, b.paymentType ?? '', b.residence ?? '', String(b.paidCents), String(b.expectedRatePercent ?? ''), String(b.expectedWithheldCents ?? ''), String(b.paidCents - (b.expectedWithheldCents ?? 0))]
    : [b.id, 'bill', 'US', b.date, b.form ?? '', b.box ?? '', String(b.paidCents), '', String(b.expectedThresholdCents ?? ''), String(b.expectedReportable ?? false)]);
  return rows;
}
