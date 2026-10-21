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
import type { Fact } from '../rules/facts';
import type { TaxPlace } from './profile';

export type IlAreaTreatment = 'zero' | 'standard';

export interface IlVatAreaRow {
  /** a stable key used as the line's `district` (lower-case, ASCII) */
  area: string;
  /** the name as the law and the Tax Authority use it */
  name: string;
  nameHebrew: string;
  /**
   * A-99: the other ways a book writes this place. A place value is matched against the row's `area`,
   * its `name`, its `nameHebrew` and these — case- and spacing-insensitively — so a line recorded as
   * `אילת`, `Eilat`, `EILAT` or `eilat` is one place, not three answers. A name that is not on the
   * list is left alone: this recognises the places the table states and invents nothing.
   */
  aliases?: string[];
  treatment: IlAreaTreatment;
  rate: number;
  validFrom: string;
  validTo?: string;
  source: string;
  /** whose page `source` is, when it is not the Tax Authority (a statute is not an authority's page) */
  sourceAuthority?: string;
  checked: string;
  note?: string;
}

const CHECKED = '2026-10-11';
const ITA = 'https://www.gov.il/he/departments/israel_tax_authority';

export const IL_VAT_SPECIAL_AREAS: IlVatAreaRow[] = [
  {
    area: 'eilat', name: 'Eilat', nameHebrew: 'אילת', treatment: 'zero', rate: 0,
    // A-99: the law was enacted on 31 July 1985 and took effect on 1 November 1985 (not 1986, as
    // this row used to say); the exemption is the statute's, so the statute is the source.
    validFrom: '1985-11-01',
    source: 'https://www.nevo.co.il/law_html/law01/009_001.htm',
    sourceAuthority: 'Israel — the Eilat Free Trade Zone Law, consolidated text',
    checked: '2026-10-20',
    aliases: ['אילת', 'Eilat', 'אזור אילת', 'Eilat Free Trade Zone'],
    note: "Eilat Free Trade Zone Law, 1985 (enacted 31 July 1985, in force from 1 November 1985, amended since): a sale of goods located in the Eilat area by a dealer resident in the area, for consumption or use there, is exempt from VAT (section 5(b)), and services given in the area by such a resident are exempt (section 5(e)). An exemption is not a zero rate: the dealer charges no VAT and gets no input credit, while a sale into the area by a dealer who is not resident there is at the zero rate where the law applies (section 5(a)). The law's schedule lists goods the relief does not reach, and the relief follows the seller's and buyer's residence and the place of consumption or use, none of which this row decides. Hotels and some services are the common exceptions people ask about; the Tax Authority guidance governs the line in hand. Recorded for the reviewer: the authority page this row used to cite (gov.il/he/departments/general/eilat_vat) answered 404 on 2026-10-20, so the row cites the statute, and the State Comptroller review of Customs supervision in the area (report 2905-12) is where the policing of the relief is described.",
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

const normalizeAreaName = (value: string | null | undefined): string =>
  (value || '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * A-99: the name a book may carry for one of the special areas, turned into the table's own area key
 * (undefined when the place is not one of them). Case, spacing and Hebrew/English spelling are the
 * same place here — this is the one recognition both the rate table and the rule pack read, so the
 * two cannot answer differently for one invoice.
 */
export function ilVatAreaKeyFor(value: string | null | undefined): string | undefined {
  const wanted = normalizeAreaName(value);
  if (!wanted) return undefined;
  for (const row of IL_VAT_SPECIAL_AREAS) {
    const names = [row.area, row.name, row.nameHebrew, ...(row.aliases || [])].map(normalizeAreaName);
    if (names.includes(wanted)) return row.area;
  }
  return undefined;
}

/** Every spelling this row recognises, canonical key first (the rule pack's `district` values). */
export function ilVatAreaNames(row: IlVatAreaRow): string[] {
  return [...new Set([row.area, row.name, row.nameHebrew, ...(row.aliases || [])].filter(name => name.trim()))];
}

/** The special-area row for a district key on a date (undefined for an ordinary or unknown place). */
export function ilVatAreaRow(area: string, date: string): IlVatAreaRow | undefined {
  const key = ilVatAreaKeyFor(area);
  if (!key) return undefined;
  return IL_VAT_SPECIAL_AREAS.find(r => r.area === key && r.validFrom <= date && (!r.validTo || date <= r.validTo));
}

/** True when the place is zero-rated on the date (Eilat, the export areas, duty-free). */
export function isIlZeroArea(area: string, date: string): boolean {
  return ilVatAreaRow(area, date)?.treatment === 'zero';
}

/**
 * A-99, the facts half: the place on a book, a document or a line, as the fact the rule graph reads.
 * A recognised special area is emitted as its canonical `district` key (`eilat`, not `אילת`), so
 * `ilVatPack`'s zero-area override displaces the standard rate for the same invoice the rate table
 * already answers 0% for. An unrecognised place produces no fact — the ordinary rate stands, and
 * nothing here infers an area from a street, a zip code or a hunch.
 */
export function ilVatAreaFacts(place: TaxPlace | null | undefined): Fact[] {
  if (!place || (place.country || '').toUpperCase() !== 'IL') return [];
  const area = ilVatAreaKeyFor(place.district) ?? ilVatAreaKeyFor(place.city);
  return area ? [{ attribute: 'district', value: area, evidence: { kind: 'declared' } }] : [];
}

/**
 * `RateTables['IL']`: Israel's components for a buyer's place on a date — the standard rate, or 0 in
 * a zero area. `place.district` (or the city, for the common case) names the area.
 */
export function ilVatRateTable(): RateTable {
  return (place: TaxPlace, date: string): TaxComponent[] | undefined => {
    if ((place.country || '').toUpperCase() !== 'IL') return undefined;
    const key = ilVatAreaKeyFor(place.district) ?? ilVatAreaKeyFor(place.city);
    if (key && isIlZeroArea(key, date)) return [{ level: 'district', name: `VAT — ${ilVatAreaRow(key, date)!.nameHebrew}`, rate: 0 }];
    const row = rateOn(IL_VAT_STANDARD, date);
    return row ? [{ level: 'country', name: 'VAT (מע"מ)', rate: row.rate }] : undefined;
  };
}

/** The standard-rate row in force on a date (re-exported so a screen needs one import). */
export const ilStandardVatRow = (date: string) => rateOn(IL_VAT_STANDARD, date);
