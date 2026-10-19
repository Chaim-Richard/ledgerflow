/**
 * A-198 / A-199: full-year golden scenarios for the two tax returns this stage supports
 * (PLAN §15: correct US + Israel tax only).
 *
 * A-198 — an Israeli small business trading through 2026, filing VAT every two months: twelve
 * months of sales (taxed, zero-rated export, Eilat, exempt) and purchases (including one fixed
 * asset reported apart), with the report's figures for each of the six periods worked by hand and
 * written as literals below.
 *
 * A-199 — a Texas business selling through 2026 with a Texas sales-tax permit: four quarters of
 * invoices (Texas buyers, an exempt-certificate customer, an out-of-state buyer) and one credit
 * note, with gross / exempt / taxable / collected tax worked by hand for each quarter.
 *
 * How they are checked: `verifyGoldenYearFixtures()` runs the same libraries the product screens
 * use (`israelVatReturn` and `usSalesTaxReturn`, both AI #1's, unchanged) over the fixtures and
 * compares every box with the literal expected figure. A table change or a regression in the return
 * maths fails here instead of quietly changing a filed number.
 *
 * Honest limits, stated on the screen too:
 * - These are fixtures, not workspace documents. Nothing posts, files, pays or closes.
 * - US figures are the **state base rate only** (Texas 6.25%). County, city and transit taxes are
 *   not in this scenario; the screen must never be read as a full sales-tax amount.
 * - Eilat is zero-rated through the existing special-area treatment (`ilVatAreaRow`); a business
 *   established in Eilat has its own status, which this scenario does not model.
 * - Israel's period figures follow the same `israelVatReturn` the return screen shows; the PCN874
 *   file is a separate, historical draft and is not produced here.
 * - Amounts are whole agorot / cents; rate change dates are the dated tables' own (`ilVatRates`).
 */
import { israelVatReturn, type IlVatDocument } from './tax/ilVatReturn';
import type { TaxProfiles } from './tax/profile';
import { usSalesTaxReturn, type UsSalesDocument } from './tax/usSalesTaxReturn';
import type { TaxPlace } from './tax/profile';

const ITA = 'https://www.gov.il/he/departments/israel_tax_authority';
const TX_COMPTROLLER = 'https://comptroller.texas.gov/taxes/sales/';

// -------------------------------------------------------------------------------------------------
// A-198 — the Israeli year (2026, VAT 18%, bi-monthly reporting)
// -------------------------------------------------------------------------------------------------

export interface GoldenIlPeriod {
  /** `2026-01` style key of the period's first month */
  period: string;
  startDate: string;
  endDate: string;
  /** the report's labels, in the Tax Authority's order */
  expected: {
    taxableSalesCents: number;
    outputVatCents: number;
    zeroRatedSalesCents: number;
    exemptSalesCents: number;
    fixedAssetInputVatCents: number;
    otherInputVatCents: number;
    toPayCents: number;
    documentCount: number;
  };
}

/** The Israeli books' profile: one VAT registration, bi-monthly, in force all year. */
export const GOLDEN_IL_PROFILES: TaxProfiles = {
  books: {
    name: 'Golden IL example (fixture)',
    place: { country: 'IL' },
    registrations: [{ kind: 'vat', number: '514000000', place: { country: 'IL' }, filing: 'bimonthly' }],
  },
};
export const GOLDEN_IL_REGISTRATION = 'vat:IL:514000000';
/** The order labels are read in: the entity label first (none here), then the books. */
export const GOLDEN_IL_ORDER = ['entity'];

/** A document with the explicit saved amounts (taxVersion 2): gross total + the tax inside it. */
const ilDoc = (id: string, date: string, netCents: number, vatCents: number, treatment: IlVatDocument['taxTreatment'], extra: Partial<IlVatDocument> = {}): IlVatDocument => ({
  id, date, status: 'paid', taxVersion: 2,
  amountCents: netCents + vatCents, taxAmountCents: vatCents, taxTreatment: treatment,
  ...extra,
});

/**
 * Twelve months of documents. Sales: a taxed invoice in most periods, one export sale, one Eilat
 * sale, one exempt sale. Purchases: ordinary bills with input VAT, and one fixed asset (equipment)
 * whose input VAT is reported in its own box.
 */
export const GOLDEN_IL_YEAR: {
  invoices: IlVatDocument[];
  bills: IlVatDocument[];
  creditNotes: IlVatDocument[];
  periods: GoldenIlPeriod[];
} = {
  invoices: [
    // January–February
    ilDoc('IL-INV-001', '2026-01-15', 1_000_000, 180_000, 'standard'),
    ilDoc('IL-INV-002', '2026-02-10', 500_000, 90_000, 'standard'),
    ilDoc('IL-INV-003', '2026-02-20', 2_000_000, 0, 'zero_rated'), // export sale — zero-rated
    // March–April
    ilDoc('IL-INV-004', '2026-03-01', 800_000, 144_000, 'standard'),
    // May–June
    ilDoc('IL-INV-005', '2026-05-01', 1_200_000, 216_000, 'standard'),
    ilDoc('IL-INV-006', '2026-05-20', 400_000, 0, 'zero_rated'), // Eilat sale — zero-rated
    // July–August
    ilDoc('IL-INV-007', '2026-07-01', 900_000, 162_000, 'standard'),
    ilDoc('IL-INV-008', '2026-08-01', 300_000, 54_000, 'standard'),
    // September–October
    ilDoc('IL-INV-009', '2026-09-01', 1_500_000, 270_000, 'standard'),
    ilDoc('IL-INV-010', '2026-09-15', 200_000, 0, 'exempt'), // exempt sale
    // November–December
    ilDoc('IL-INV-011', '2026-11-01', 1_100_000, 198_000, 'standard'),
    ilDoc('IL-INV-012', '2026-12-20', 600_000, 108_000, 'standard'),
  ],
  bills: [
    ilDoc('IL-BILL-001', '2026-01-20', 300_000, 54_000, 'standard'),
    ilDoc('IL-BILL-002', '2026-02-15', 100_000, 18_000, 'standard'),
    ilDoc('IL-BILL-003', '2026-03-10', 200_000, 36_000, 'standard'),
    ilDoc('IL-BILL-004', '2026-06-01', 500_000, 90_000, 'standard'),
    ilDoc('IL-BILL-005', '2026-06-15', 2_000_000, 360_000, 'standard', { fixedAsset: true }),
    ilDoc('IL-BILL-006', '2026-07-15', 250_000, 45_000, 'standard'),
    ilDoc('IL-BILL-007', '2026-09-10', 400_000, 72_000, 'standard'),
    ilDoc('IL-BILL-008', '2026-11-10', 350_000, 63_000, 'standard'),
    ilDoc('IL-BILL-009', '2026-12-05', 150_000, 27_000, 'standard'),
  ],
  // the credit note lives in salesCredits, never in invoices
  creditNotes: [
    ilDoc('IL-CN-001', '2026-04-05', 100_000, 18_000, 'standard', { status: 'applied' }),
  ],
  periods: [
    // Jan–Feb: taxable 1,500,000 (10,000 + 5,000 shekels), output 270,000; zero 2,000,000;
    // inputs 54,000 + 18,000 = 72,000; to pay 198,000; documents: 3 sales + 2 bills = 5
    { period: '2026-01', startDate: '2026-01-01', endDate: '2026-02-28', expected: { taxableSalesCents: 1_500_000, outputVatCents: 270_000, zeroRatedSalesCents: 2_000_000, exemptSalesCents: 0, fixedAssetInputVatCents: 0, otherInputVatCents: 72_000, toPayCents: 198_000, documentCount: 5 } },
    // Mar–Apr: invoice 800,000 less credit 100,000 = 700,000 taxable; output 126,000; input 36,000; to pay 90,000; documents 1 + 1 + 1 = 3
    { period: '2026-03', startDate: '2026-03-01', endDate: '2026-04-30', expected: { taxableSalesCents: 700_000, outputVatCents: 126_000, zeroRatedSalesCents: 0, exemptSalesCents: 0, fixedAssetInputVatCents: 0, otherInputVatCents: 36_000, toPayCents: 90_000, documentCount: 3 } },
    // May–Jun: taxable 1,200,000; output 216,000; zero (Eilat) 400,000; inputs 90,000 other + 360,000 equipment; to pay 216,000 − 450,000 = −234,000 (refund); documents 4
    { period: '2026-05', startDate: '2026-05-01', endDate: '2026-06-30', expected: { taxableSalesCents: 1_200_000, outputVatCents: 216_000, zeroRatedSalesCents: 400_000, exemptSalesCents: 0, fixedAssetInputVatCents: 360_000, otherInputVatCents: 90_000, toPayCents: -234_000, documentCount: 4 } },
    // Jul–Aug: taxable 1,200,000; output 216,000; input 45,000; to pay 171,000; documents 3
    { period: '2026-07', startDate: '2026-07-01', endDate: '2026-08-31', expected: { taxableSalesCents: 1_200_000, outputVatCents: 216_000, zeroRatedSalesCents: 0, exemptSalesCents: 0, fixedAssetInputVatCents: 0, otherInputVatCents: 45_000, toPayCents: 171_000, documentCount: 3 } },
    // Sep–Oct: taxable 1,500,000; output 270,000; exempt 200,000; input 72,000; to pay 198,000; documents 3
    { period: '2026-09', startDate: '2026-09-01', endDate: '2026-10-31', expected: { taxableSalesCents: 1_500_000, outputVatCents: 270_000, zeroRatedSalesCents: 0, exemptSalesCents: 200_000, fixedAssetInputVatCents: 0, otherInputVatCents: 72_000, toPayCents: 198_000, documentCount: 3 } },
    // Nov–Dec: taxable 1,700,000; output 306,000; input 63,000 + 27,000 = 90,000; to pay 216,000; documents 4
    { period: '2026-11', startDate: '2026-11-01', endDate: '2026-12-31', expected: { taxableSalesCents: 1_700_000, outputVatCents: 306_000, zeroRatedSalesCents: 0, exemptSalesCents: 0, fixedAssetInputVatCents: 0, otherInputVatCents: 90_000, toPayCents: 216_000, documentCount: 4 } },
  ],
};

export interface GoldenYearCheck { id: string; detail: string }

/**
 * A-198: run the product's own Israeli VAT return over the fixture and compare every figure with
 * the hand-worked literals. Returns the failures (empty when everything matches).
 */
export function verifyIlGoldenYear(): { periods: number; failures: GoldenYearCheck[] } {
  const failures: GoldenYearCheck[] = [];
  for (const period of GOLDEN_IL_YEAR.periods) {
    const got = israelVatReturn({
      registration: GOLDEN_IL_REGISTRATION,
      profiles: GOLDEN_IL_PROFILES,
      order: GOLDEN_IL_ORDER,
      invoices: GOLDEN_IL_YEAR.invoices,
      bills: GOLDEN_IL_YEAR.bills,
      creditNotes: GOLDEN_IL_YEAR.creditNotes,
      startDate: period.startDate,
      endDate: period.endDate,
    });
    const pairs: Array<[keyof typeof period.expected, number, number]> = [
      ['taxableSalesCents', period.expected.taxableSalesCents, got.taxableSalesCents],
      ['outputVatCents', period.expected.outputVatCents, got.outputVatCents],
      ['zeroRatedSalesCents', period.expected.zeroRatedSalesCents, got.zeroRatedSalesCents],
      ['exemptSalesCents', period.expected.exemptSalesCents, got.exemptSalesCents],
      ['fixedAssetInputVatCents', period.expected.fixedAssetInputVatCents, got.fixedAssetInputVatCents],
      ['otherInputVatCents', period.expected.otherInputVatCents, got.otherInputVatCents],
      ['toPayCents', period.expected.toPayCents, got.toPayCents],
      ['documentCount', period.expected.documentCount, got.documentCount],
    ];
    for (const [field, expected, actual] of pairs) {
      if (expected !== actual) failures.push({ id: `A-198 ${period.period}`, detail: `${field}: worked ${expected}, library says ${actual}` });
    }
  }
  return { periods: GOLDEN_IL_YEAR.periods.length, failures };
}

/** The year's totals, added from the period literals (a second, independent check of the sums). */
export function goldenIlYearTotals(): { taxableSalesCents: number; outputVatCents: number; zeroRatedSalesCents: number; exemptSalesCents: number; fixedAssetInputVatCents: number; otherInputVatCents: number; toPayCents: number; documentCount: number } {
  const t = { taxableSalesCents: 0, outputVatCents: 0, zeroRatedSalesCents: 0, exemptSalesCents: 0, fixedAssetInputVatCents: 0, otherInputVatCents: 0, toPayCents: 0, documentCount: 0 };
  for (const p of GOLDEN_IL_YEAR.periods) for (const k of Object.keys(t) as Array<keyof typeof t>) t[k] += p.expected[k];
  return t;
}

// -------------------------------------------------------------------------------------------------
// A-199 — the Texas year (2026, state base rate 6.25% only, quarterly)
// -------------------------------------------------------------------------------------------------

export interface GoldenTxQuarter {
  /** `2026-Q1` style key */
  quarter: string;
  startDate: string;
  endDate: string;
  expected: {
    grossSalesCents: number;
    exemptSalesCents: number;
    taxableSalesCents: number;
    taxCollectedCents: number;
    documentCount: number;
  };
}

export const GOLDEN_TX_PROFILES: TaxProfiles = {
  books: {
    name: 'Golden TX example (fixture)',
    place: { country: 'US', state: 'TX' },
    registrations: [{ kind: 'sales_tax', number: '32000000000', place: { country: 'US', state: 'TX' }, filing: 'quarterly' }],
  },
};
export const GOLDEN_TX_REGISTRATION = 'sales_tax:US-TX:32000000000';

/** The customers the sales-tax return reads the buyer's state and certificate from. */
export const GOLDEN_TX_CUSTOMERS: Array<{ id: string; metadata?: unknown }> = [
  { id: 'tx-1', metadata: { taxPlace: { country: 'US', state: 'TX' } as TaxPlace } },
  { id: 'tx-2', metadata: { taxPlace: { country: 'US', state: 'TX' } as TaxPlace } },
  { id: 'tx-3', metadata: { taxPlace: { country: 'US', state: 'TX' } as TaxPlace, taxExemption: { number: 'TX-RESALE-001', type: 'resale' } } },
  { id: 'or-1', metadata: { taxPlace: { country: 'US', state: 'OR' } as TaxPlace } },
];

const TX_PART = 'Texas state sales tax';
const txDoc = (id: string, date: string, netCents: number, taxCents: number, customerId: string, status = 'paid'): UsSalesDocument => ({
  id, date, status, taxVersion: 2, customerId,
  amountCents: netCents + taxCents, taxAmountCents: taxCents, taxTreatment: taxCents > 0 ? 'standard' : 'exempt',
  taxBreakdown: taxCents > 0 ? [{ name: TX_PART, rate: 6.25, taxCents }] : [],
});

/**
 * Twelve months of Texas sales. Q1 includes an Oregon buyer (not this permit's return) and an
 * exempt-certificate customer; Q2 has a credit note; Q3 repeats the pattern with a large invoice;
 * Q4 has rounding on an odd amount. Figures are the state base rate only.
 */
export const GOLDEN_TX_YEAR: {
  invoices: UsSalesDocument[];
  creditNotes: UsSalesDocument[];
  quarters: GoldenTxQuarter[];
} = {
  invoices: [
    txDoc('TX-INV-001', '2026-01-15', 1_000_000, 62_500, 'tx-1'),
    txDoc('TX-INV-002', '2026-02-10', 400_000, 25_000, 'tx-2'),
    txDoc('TX-INV-003', '2026-03-05', 300_000, 0, 'or-1'), // Oregon buyer — not on the Texas return
    txDoc('TX-INV-004', '2026-03-20', 200_000, 0, 'tx-3'), // resale certificate
    txDoc('TX-INV-005', '2026-04-01', 750_000, 46_875, 'tx-1'),
    txDoc('TX-INV-006', '2026-05-01', 250_000, 15_625, 'tx-2'),
    txDoc('TX-INV-007', '2026-07-01', 2_000_000, 125_000, 'tx-1'),
    txDoc('TX-INV-008', '2026-08-01', 500_000, 0, 'tx-3'), // resale certificate
    txDoc('TX-INV-009', '2026-09-01', 333_333, 20_833, 'tx-2'), // 333,333 × 6.25% = 20,833.3125 → 20,833
    txDoc('TX-INV-010', '2026-10-01', 1_234_567, 77_160, 'tx-1'), // 77,160.4375 → 77,160
    txDoc('TX-INV-011', '2026-11-11', 625_000, 39_063, 'tx-2'), // 39,062.50 → 39,063
    txDoc('TX-INV-012', '2026-12-01', 100_000, 0, 'or-1'), // Oregon buyer — not on the Texas return
  ],
  creditNotes: [txDoc('TX-CN-001', '2026-06-01', 100_000, 6_250, 'tx-1', 'applied')],
  quarters: [
    // Q1: gross 1,000,000 + 400,000 + 200,000 = 1,600,000 (the Oregon sale is not on this return);
    // exempt 200,000; taxable 1,400,000; tax 87,500; 3 documents
    { quarter: '2026-Q1', startDate: '2026-01-01', endDate: '2026-03-31', expected: { grossSalesCents: 1_600_000, exemptSalesCents: 200_000, taxableSalesCents: 1_400_000, taxCollectedCents: 87_500, documentCount: 3 } },
    // Q2: invoice 750,000 + 250,000 less credit 100,000 = 900,000 taxable; tax 56,250; 3 documents
    { quarter: '2026-Q2', startDate: '2026-04-01', endDate: '2026-06-30', expected: { grossSalesCents: 900_000, exemptSalesCents: 0, taxableSalesCents: 900_000, taxCollectedCents: 56_250, documentCount: 3 } },
    // Q3: gross 2,000,000 + 500,000 + 333,333 = 2,833,333; exempt 500,000; taxable 2,333,333; tax 145,833; 3 documents
    { quarter: '2026-Q3', startDate: '2026-07-01', endDate: '2026-09-30', expected: { grossSalesCents: 2_833_333, exemptSalesCents: 500_000, taxableSalesCents: 2_333_333, taxCollectedCents: 145_833, documentCount: 3 } },
    // Q4: gross 1,234,567 + 625,000 = 1,859,567; taxable same; tax 116,223; 2 documents
    { quarter: '2026-Q4', startDate: '2026-10-01', endDate: '2026-12-31', expected: { grossSalesCents: 1_859_567, exemptSalesCents: 0, taxableSalesCents: 1_859_567, taxCollectedCents: 116_223, documentCount: 2 } },
  ],
};

/** A-199: run `usSalesTaxReturn` over the fixture and compare every quarter with the literals. */
export function verifyTxGoldenYear(): { quarters: number; failures: GoldenYearCheck[] } {
  const failures: GoldenYearCheck[] = [];
  for (const quarter of GOLDEN_TX_YEAR.quarters) {
    const got = usSalesTaxReturn({
      registration: GOLDEN_TX_REGISTRATION,
      profiles: GOLDEN_TX_PROFILES,
      order: GOLDEN_IL_ORDER,
      invoices: GOLDEN_TX_YEAR.invoices,
      creditNotes: GOLDEN_TX_YEAR.creditNotes,
      customers: GOLDEN_TX_CUSTOMERS,
      startDate: quarter.startDate,
      endDate: quarter.endDate,
    });
    const pairs: Array<[keyof typeof quarter.expected, number, number]> = [
      ['grossSalesCents', quarter.expected.grossSalesCents, got.grossSalesCents],
      ['exemptSalesCents', quarter.expected.exemptSalesCents, got.exemptSalesCents],
      ['taxableSalesCents', quarter.expected.taxableSalesCents, got.taxableSalesCents],
      ['taxCollectedCents', quarter.expected.taxCollectedCents, got.taxCollectedCents],
      ['documentCount', quarter.expected.documentCount, got.documentCount],
    ];
    for (const [field, expected, actual] of pairs) {
      if (expected !== actual) failures.push({ id: `A-199 ${quarter.quarter}`, detail: `${field}: worked ${expected}, library says ${actual}` });
    }
    // the sales-tax return reconciles internally: gross = taxable + exempt
    if (got.grossSalesCents !== got.taxableSalesCents + got.exemptSalesCents) {
      failures.push({ id: `A-199 ${quarter.quarter}`, detail: `gross ${got.grossSalesCents} is not taxable ${got.taxableSalesCents} + exempt ${got.exemptSalesCents}` });
    }
  }
  return { quarters: GOLDEN_TX_YEAR.quarters.length, failures };
}

/** The Texas year's totals from the quarter literals (independent of the library). */
export function goldenTxYearTotals(): { grossSalesCents: number; exemptSalesCents: number; taxableSalesCents: number; taxCollectedCents: number; documentCount: number } {
  const t = { grossSalesCents: 0, exemptSalesCents: 0, taxableSalesCents: 0, taxCollectedCents: 0, documentCount: 0 };
  for (const q of GOLDEN_TX_YEAR.quarters) for (const k of Object.keys(t) as Array<keyof typeof t>) t[k] += q.expected[k];
  return t;
}

// -------------------------------------------------------------------------------------------------
// One check for both years, plus the sources the screens cite
// -------------------------------------------------------------------------------------------------

export interface GoldenYearResult {
  ilPeriods: number;
  txQuarters: number;
  failures: GoldenYearCheck[];
}

export function verifyGoldenYearFixtures(): GoldenYearResult {
  const il = verifyIlGoldenYear();
  const tx = verifyTxGoldenYear();
  return { ilPeriods: il.periods, txQuarters: tx.quarters, failures: [...il.failures, ...tx.failures] };
}

export const GOLDEN_YEAR_SOURCES = { israel: ITA, texas: TX_COMPTROLLER } as const;
