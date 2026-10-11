/**
 * A-29 (PLAN IL-1/IL-3): Israel's VAT special areas — Eilat and the other places that are not taxed
 * the ordinary way — as dated rows with a source per row.
 *
 * The ordinary rate is `IL_VAT_STANDARD` (17% to 2024, 18% from 1 Jan 2025, in `ilVatRates.ts`).
 * This file adds the *places*: Eilat's free-trade zone (supplies made and consumed there are not
 * charged VAT; a business there is exempt, so it also has no input credit), the Palestinian
 * Authority areas (treated as exports), and duty-free supplies to travellers. It does not decide
 * any line by itself: `ilVatComponents` gives `resolveLineTax` the components, and a business's own
 * status (osek patur, osek murshe) stays a fact on its tax profile.
 *
 * Honest limit: a screen may show these rows; nothing here claims a filing position. Every row is
 * `status: 'calculation'` and names where it was read.
 */
import { IL_VAT_STANDARD, rateOn } from './ilVatRates';
import type { RateTable, TaxComponent } from './resolveLineTax';
import type { TaxPlace } from './profile';

export type IlAreaTreatment = 'zero' | 'standard';

export interface IlVatAreaRow {
  /** a stable key used as the line's `district` (lower-case, ASCII) */
  area: string;
  /** the name as the law and the Tax Authority use it */
  name: string;
  nameHebrew: string;
  treatment: IlAreaTreatment;
  rate: number;
  validFrom: string;
  validTo?: string;
  source: string;
  checked: string;
  note?: string;
}

const CHECKED = '2026-10-11';
const ITA = 'https://www.gov.il/he/departments/israel_tax_authority';

export const IL_VAT_SPECIAL_AREAS: IlVatAreaRow[] = [
  {
    area: 'eilat', name: 'Eilat', nameHebrew: 'אילת', treatment: 'zero', rate: 0,
    validFrom: '1986-01-01', source: 'https://www.gov.il/he/departments/general/eilat_vat', checked: CHECKED,
    note: 'Eilat Free Trade Zone Law, 1985: supplies made and consumed in Eilat are not charged VAT; a business there is exempt, so it also has no input credit. Hotels and some services are the common exceptions people ask about — check the authority’s guidance for the line in hand',
  },
  {
    area: 'judea-samaria', name: 'Judea and Samaria (West Bank)', nameHebrew: 'יהודה ושומרון', treatment: 'zero', rate: 0,
    validFrom: '1968-01-01', source: ITA, checked: CHECKED,
    note: 'supplies to residents there are treated as exports for VAT; the Israeli business needs the documentation the authority asks for',
  },
  {
    area: 'gaza', name: 'Gaza Strip', nameHebrew: 'רצועת עזה', treatment: 'zero', rate: 0,
    validFrom: '1968-01-01', source: ITA, checked: CHECKED,
    note: 'treated as an export area; the security and permit rules are outside this table',
  },
  {
    area: 'duty-free', name: 'Duty-free shops (airports and ports)', nameHebrew: 'חנויות פטורות ממכס', treatment: 'zero', rate: 0,
    validFrom: '1975-01-01', source: ITA, checked: CHECKED,
    note: 'sales to travellers leaving the country; the shop keeps its licence and the passenger’s travel document is the evidence',
  },
  {
    area: 'israel', name: 'Israel (ordinary)', nameHebrew: 'ישראל (רגיל)', treatment: 'standard', rate: 0.18,
    validFrom: '2025-01-01', source: ITA, checked: CHECKED,
    note: 'the ordinary area: the standard rate from IL_VAT_STANDARD answers for it',
  },
];

/** The special-area row for a district key on a date (undefined for an ordinary or unknown place). */
export function ilVatAreaRow(area: string, date: string): IlVatAreaRow | undefined {
  const key = area.trim().toLowerCase();
  return IL_VAT_SPECIAL_AREAS.find(r => r.area === key && r.validFrom <= date && (!r.validTo || date <= r.validTo));
}

/** True when the place is zero-rated on the date (Eilat, the export areas, duty-free). */
export function isIlZeroArea(area: string, date: string): boolean {
  return ilVatAreaRow(area, date)?.treatment === 'zero';
}

/**
 * `RateTables['IL']`: Israel's components for a buyer's place on a date — the standard rate, or 0 in
 * a zero area. `place.district` (or the city, for the common case) names the area.
 */
export function ilVatRateTable(): RateTable {
  return (place: TaxPlace, date: string): TaxComponent[] | undefined => {
    if ((place.country || '').toUpperCase() !== 'IL') return undefined;
    const key = place.district || place.city || '';
    if (key && isIlZeroArea(key, date)) return [{ level: 'district', name: `VAT — ${ilVatAreaRow(key, date)!.nameHebrew}`, rate: 0 }];
    const row = rateOn(IL_VAT_STANDARD, date);
    return row ? [{ level: 'country', name: 'VAT (מע"מ)', rate: row.rate }] : undefined;
  };
}

/** The standard-rate row in force on a date (re-exported so a screen needs one import). */
export const ilStandardVatRow = (date: string) => rateOn(IL_VAT_STANDARD, date);
