/**
 * A-58: US state sales tax holidays as dated rules (PLAN §10). One rule per published window:
 * `validFrom`/`validTo` are the window itself, so a rule is in force exactly while the holiday
 * runs, and the effect carries the state's own bands with their per-item caps.
 *
 * The override replaces the state's rate rules only for a line that passes one band's cap — the
 * caps live in the effect because an item's price is not a fact the `when` conditions can see
 * (`SalesTaxHolidayEffect`, and `holidayItemAnswer()` as the reference application). Nothing here
 * posts, files or changes a rate outside the window; the qualifying-item lists in each source
 * govern which items a band covers, item by item.
 *
 * Windows this pack deliberately does not state are listed under `unmapped` (Texas' water-efficient
 * products holiday, Florida's disaster-preparedness and hunting/fishing/camping windows, and every
 * other state's holidays) so a person adds them from the state's own publication — never guessed.
 */
import { US_SALES_TAX_HOLIDAYS, type SalesTaxHolidayRow } from '../../tax/usSalesTaxHolidays';
import { rateRule, where, slug, type SalesTaxHolidayEffect, type TaxRulePack, type UnmappedRow } from './shared';
import { stateSalesRuleIds } from './productTaxabilityPack';

function holidayRule(row: SalesTaxHolidayRow) {
  return rateRule<SalesTaxHolidayEffect>({
    id: `us-holiday-${slug(row.id)}`,
    name: `${row.stateName} ${row.name} ${row.from.slice(0, 4)} (${row.from} to ${row.to})`,
    when: [where('country', ['US']), where('state', [row.state])],
    effect: {
      kind: 'sales-tax-holiday',
      holiday: row.id,
      bands: row.bands.map(band => ({
        id: band.id,
        label: band.label,
        capCents: band.capCents,
        capInclusive: band.capInclusive,
      })),
      note: 'Exempt only for a line inside one band and at (or under, per the band’s wording) its per-item sales-price cap; over the cap or outside the bands the named rate rules stand. Delivery, shipping and handling charges count in the sales price. The source’s qualifying-item list governs which items a band covers.',
    },
    // the holiday replaces the state's own rate for a qualifying line, during the window only
    combine: 'override',
    targets: stateSalesRuleIds(row.state, row.from),
    validFrom: row.from,
    validTo: row.to,
    source: row.source,
    status: 'calculation',
  });
}

export function usSalesTaxHolidayPack(): TaxRulePack {
  const unmapped: UnmappedRow[] = [
    {
      row: 'TX water-efficient products / ENERGY STAR holiday (annual, Memorial Day weekend)',
      reason: 'the Comptroller publishes the dates each year (2026: May 23–25) but this lane has not stated its qualifying product list and any dollar limit as a dated row; add it from publication 98-490 before relying on it',
    },
    {
      row: 'FL disaster preparedness holidays (two 14-day windows a year)',
      reason: 'the Legislature sets both windows each year and this lane has not stated their dates or item caps as a dated row; add them from the Department’s TIP before relying on them',
    },
    {
      row: 'FL hunting, fishing and camping sales tax holiday',
      reason: 'a newer Florida window (2025: September 8 – December 31) whose 2026 dates and caps this lane has not stated from a Department TIP; add it before relying on it',
    },
    {
      row: 'every other state’s sales tax holidays (about 20 states run at least one)',
      reason: 'outside the two states this table states (TX and FL); each state’s own dated row is needed before any window is claimed',
    },
  ];
  return {
    id: 'us-sales-tax-holidays',
    name: 'US state sales tax holidays',
    rules: US_SALES_TAX_HOLIDAYS.map(holidayRule),
    unmapped,
  };
}
