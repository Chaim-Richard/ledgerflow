/**
 * Israel's VAT rate by date (PLAN IL-1). Source: Israel Tax Authority, VAT rate announcements
 * (https://www.gov.il/he/departments/israel_tax_authority). Eilat's free-trade zone: supplies made and
 * consumed there are zero-rated (Eilat Law, 1985); AI #3's A-29 table refines the special areas.
 */
export interface DatedRate { validFrom: string; validTo?: string; rate: number; source: string }

const ITA = 'https://www.gov.il/he/departments/israel_tax_authority';

export const IL_VAT_STANDARD: DatedRate[] = [
  { validFrom: '2015-10-01', validTo: '2024-12-31', rate: 0.17, source: ITA },
  { validFrom: '2025-01-01', rate: 0.18, source: ITA },
];

export function rateOn(rows: DatedRate[], date: string): DatedRate | undefined {
  return rows.find(r => r.validFrom <= date && (!r.validTo || date <= r.validTo));
}
