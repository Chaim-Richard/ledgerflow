/**
 * A-51: Canada's filing calendar (caFilingCalendar.ts) written as entity-period rules — GST/HST by
 * annual-revenue band (CRA), QST by band (Revenu Québec) and the monthly provincial sales-tax
 * returns (BC, SK, MB). Each rule carries its band in the effect so a screen can pick the row by
 * the entity's own revenue; the rule itself never concludes which period an entity files on — the
 * authority assigns it. Status 'calculation'; nothing files, posts or pays.
 */
import { CA_FILING_CALENDAR } from '../../tax/caFilingCalendar';
import { rateRule, where, slug, type FilingEffect, type TaxRulePack } from './shared';

const FORM: Record<string, string> = {
  'GST/HST': 'GST/HST return (GST34)',
  'QST': 'QST return (LM-1.V)',
  'BC PST': 'British Columbia PST return',
  'SK PST': 'Saskatchewan PST return',
  'MB RST': 'Manitoba Retail Sales Tax return',
};

const FREQUENCY: Record<string, FilingEffect['frequency']> = { monthly: 'monthly', quarterly: 'quarterly', annual: 'yearly' };

const AUTHORITY: Record<string, string> = {
  'GST/HST': 'Canada Revenue Agency',
  'QST': 'Revenu Québec',
  'BC PST': 'Government of British Columbia',
  'SK PST': 'Government of Saskatchewan',
  'MB RST': 'Government of Manitoba',
};

export function caFilingPack(): TaxRulePack {
  const rules = CA_FILING_CALENDAR.map(row => {
    const banded = row.minAnnualRevenueCents !== null || row.maxAnnualRevenueCents !== null;
    return rateRule<FilingEffect>({
      id: `ca-filing-${slug(row.tax)}-${row.province ? slug(row.province) : 'federal'}-${row.frequency}`,
      name: `${row.tax} ${row.frequency} filing${row.province ? ` (${row.provinceName})` : ' (federal)'}`,
      scope: 'entity-period',
      when: [where('country', ['CA']), ...(row.province ? [where('state', [row.province])] : [])],
      effect: {
        kind: 'filing',
        form: FORM[row.tax] || row.tax,
        frequency: FREQUENCY[row.frequency] || 'monthly',
        due: row.due,
        tax: row.tax,
        ...(banded ? { revenueBand: { minCents: row.minAnnualRevenueCents, maxCents: row.maxAnnualRevenueCents, currency: 'CAD' } } : {}),
      },
      validFrom: row.validFrom,
      source: { authority: AUTHORITY[row.tax] || 'Canada', url: row.source, retrieved: row.checked },
    });
  });
  return { id: 'ca-filing-calendar', name: 'Canada consumption-tax filing calendar', rules, unmapped: [] };
}
