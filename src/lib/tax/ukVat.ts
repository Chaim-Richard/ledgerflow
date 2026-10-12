/**
 * A-26 (PLAN §3 step 4): the United Kingdom's VAT rates — standard, reduced and zero, as dated rows
 * with a source per row (GOV.UK). MTD is deliberately out of scope.
 *
 * The history is short enough to keep properly: the standard rate moved 17.5% → 15% → 17.5% → 20%,
 * and the temporary hospitality rates of 2020–2021 are dated rows so an old document still finds
 * its own rate. Every row is `status: 'calculation'`.
 */
import type { RateTable, TaxComponent } from './resolveLineTax';
import type { TaxPlace } from './profile';

export type UkVatKind = 'standard' | 'reduced' | 'zero';

export interface UkVatRow {
  kind: UkVatKind;
  /** for a reduced or zero row: what the rate applies to */
  appliesTo?: string;
  rate: number;
  validFrom: string;
  validTo?: string;
  source: string;
  checked: string;
  note?: string;
}

const CHECKED = '2026-10-11';
const HMRC = 'https://www.gov.uk/vat-rates';

export const UK_VAT_RATES: UkVatRow[] = [
  { kind: 'standard', rate: 0.175, validFrom: '1991-04-01', validTo: '2008-11-30', source: HMRC, checked: CHECKED },
  { kind: 'standard', rate: 0.15, validFrom: '2008-12-01', validTo: '2009-12-31', source: HMRC, checked: CHECKED, note: 'the 2008–2009 temporary reduction' },
  { kind: 'standard', rate: 0.175, validFrom: '2010-01-01', validTo: '2011-01-03', source: HMRC, checked: CHECKED },
  { kind: 'standard', rate: 0.2, validFrom: '2011-01-04', source: HMRC, checked: CHECKED, note: '20% since 4 Jan 2011' },

  { kind: 'reduced', appliesTo: 'domestic fuel and power, children’s car seats', rate: 0.05, validFrom: '1997-09-01', source: HMRC, checked: CHECKED },
  { kind: 'reduced', appliesTo: 'hospitality, holiday accommodation, attractions', rate: 0.05, validFrom: '2020-07-15', validTo: '2021-09-30', source: HMRC, checked: CHECKED, note: 'the COVID-19 support rate' },
  { kind: 'reduced', appliesTo: 'hospitality, holiday accommodation, attractions', rate: 0.125, validFrom: '2021-10-01', validTo: '2022-03-31', source: HMRC, checked: CHECKED },

  { kind: 'zero', appliesTo: 'food, books and newspapers, children’s clothes, medicines, exports', rate: 0, validFrom: '1973-04-01', source: HMRC, checked: CHECKED, note: 'zero-rated is not exempt: input VAT stays recoverable' },
];

const inForce = (r: UkVatRow, date: string) => r.validFrom <= date && (!r.validTo || date <= r.validTo);

/** The standard rate on a date (20% today; the dated rows answer for old documents). */
export function ukVatStandardRate(date: string): number | undefined {
  return UK_VAT_RATES.find(r => r.kind === 'standard' && inForce(r, date))?.rate;
}

/** The zero rate row (0% is a rate, not the absence of a table). */
export function ukVatZeroRow(date: string): UkVatRow | undefined {
  return UK_VAT_RATES.find(r => r.kind === 'zero' && inForce(r, date));
}

/** The reduced row for a category on a date, when one is in force (e.g. domestic fuel). */
export function ukVatReducedFor(category: string, date: string): UkVatRow | undefined {
  const word = category.trim().toLowerCase();
  return UK_VAT_RATES.filter(r => r.kind === 'reduced' && inForce(r, date))
    .find(r => (r.appliesTo || '').toLowerCase().split(/[,;]/).some(w => w.trim().includes(word)));
}

/**
 * The rows in force on a date, keyed by kind — the whole picture for a date (a screen shows this,
 * and a return reconciles against it). More than one reduced row can be in force for different goods.
 */
export function ukVatRowsOn(date: string): UkVatRow[] {
  return UK_VAT_RATES.filter(r => inForce(r, date));
}

/** `RateTables['GB']`: the standard rate for a UK domestic sale. */
export function ukVatRateTable(rows: UkVatRow[] = UK_VAT_RATES): RateTable {
  return (place: TaxPlace, date: string): TaxComponent[] | undefined => {
    const country = (place.country || '').toUpperCase();
    if (country !== 'GB' && country !== 'UK') return undefined;
    const row = rows.find(r => r.kind === 'standard' && r.validFrom <= date && (!r.validTo || date <= r.validTo));
    if (!row) return undefined;
    return [{ level: 'country', name: 'UK VAT', rate: row.rate }];
  };
}
