/**
 * A-39: dated registration / place-of-supply threshold facts. These are legal comparison amounts,
 * not a determination that a business must register. Each activity value is deliberately explicit:
 * the report only counts posted sales carrying one of these labels.
 */
import { EU_VAT_COUNTRIES } from './euVat';
import { IL_OSEK_PATUR_CEILINGS } from './ilOsekPaturThresholds';
import type { RegistrationThresholdWindow } from '../rules/packs/shared';

export type RegistrationThresholdScheme = 'il-osek-patur' | 'uk-vat' | 'ca-gst-small-supplier' | 'eu-oss-place-of-supply';

export interface RegistrationThresholdActivity {
  value: string;
  label: string;
  /** Only exact normalized identifiers, descriptions or aliases are recognized. */
  aliases: string[];
}

export interface RegistrationThresholdRow {
  id: string;
  name: string;
  scheme: RegistrationThresholdScheme;
  countryCodes: string[];
  activity: RegistrationThresholdActivity;
  currency: 'ILS' | 'GBP' | 'CAD' | 'EUR';
  thresholdCents: number;
  window: RegistrationThresholdWindow;
  validFrom: string;
  validTo?: string;
  source: { authority: string; url: string; retrieved: string };
  /** Secondary official guidance on the legal test/scope, where useful. */
  guidanceUrl?: string;
  note: string;
}

const CHECKED = '2026-10-12';

export const REGISTRATION_THRESHOLD_ACTIVITIES: RegistrationThresholdActivity[] = [
  {
    value: 'il_osek_patur_turnover',
    label: 'Israel osek patur qualifying turnover',
    aliases: ['il_osek_patur_turnover', 'Israel osek patur qualifying turnover', 'IL osek patur turnover'],
  },
  {
    value: 'uk_vat_taxable_turnover',
    label: 'UK VAT taxable turnover',
    aliases: ['uk_vat_taxable_turnover', 'UK VAT taxable turnover'],
  },
  {
    value: 'ca_gst_taxable_supplies',
    label: 'Canada GST/HST taxable supplies',
    aliases: ['ca_gst_taxable_supplies', 'Canada GST/HST taxable supplies', 'Canada GST taxable supplies'],
  },
  {
    value: 'eu_oss_qualifying_b2c_supplies',
    label: 'EU OSS qualifying cross-border B2C supplies',
    aliases: ['eu_oss_qualifying_b2c_supplies', 'EU OSS qualifying cross-border B2C supplies', 'EU OSS qualifying B2C supplies'],
  },
];

// Keep the mapping explicit and readable; these are the activity facts consumed by the rules.
const IL_ACTIVITY = REGISTRATION_THRESHOLD_ACTIVITIES.find(row => row.value === 'il_osek_patur_turnover')!;
const UK_ACTIVITY = REGISTRATION_THRESHOLD_ACTIVITIES.find(row => row.value === 'uk_vat_taxable_turnover')!;
const CA_ACTIVITY = REGISTRATION_THRESHOLD_ACTIVITIES.find(row => row.value === 'ca_gst_taxable_supplies')!;
const EU_ACTIVITY = REGISTRATION_THRESHOLD_ACTIVITIES.find(row => row.value === 'eu_oss_qualifying_b2c_supplies')!;

const HMRC_THRESHOLD = 'https://www.gov.uk/government/publications/vat-increasing-the-registration-and-deregistration-thresholds';
const HMRC_TESTS = 'https://www.gov.uk/vat-registration/when-to-register';
const CRA_TESTS = 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html';
const CRA_1991 = 'https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/g300-6/time-liability-gst-300-6.html';
const EU_SUMMARY = 'https://taxation-customs.ec.europa.eu/vat-e-commerce_en';
const EU_GUIDANCE = 'https://taxation-customs.ec.europa.eu/document/download/6d3b649e-e4b6-4db8-a902-ce21802de18b_en';

/**
 * The Israeli rows are not typed here: each one is the same year's row of A-100's ceiling history
 * (`ilOsekPaturThresholds.ts`), so the report, the rule pack and the history cannot answer for the
 * same year with two different figures. The rows kept are the recent years the watch compares;
 * the full dated history answers for a past period through `osekPaturCeilingOn`.
 */
function israelCeilingRow(year: number): RegistrationThresholdRow {
  const ceiling = IL_OSEK_PATUR_CEILINGS.find(row => row.year === year);
  if (!ceiling) throw new Error(`A-100's ceiling history has no row for ${year}`);
  return {
    id: `il-osek-patur-${year}`,
    name: `Israel osek patur annual turnover ceiling (${year})`,
    scheme: 'il-osek-patur',
    countryCodes: ['IL'],
    activity: IL_ACTIVITY,
    currency: 'ILS',
    thresholdCents: ceiling.ceilingCents,
    window: 'calendar-year-to-date',
    validFrom: ceiling.validFrom,
    ...(ceiling.validTo ? { validTo: ceiling.validTo } : {}),
    source: ceiling.source,
    guidanceUrl: ceiling.corroboratedBy,
    note: `${ceiling.note} The report compares current-year posted turnover only; it does not check profession-based exclusions, the statutory prior-year / expected-turnover basis, all other businesses, or excluded equipment sales.`,
  };
}

/** The ceiling/threshold rows in force, with the effective periods preserved. */
export const REGISTRATION_THRESHOLDS: RegistrationThresholdRow[] = [
  israelCeilingRow(2024),
  israelCeilingRow(2025),
  israelCeilingRow(2026),
  {
    id: 'uk-vat-registration-2024-04', name: 'UK VAT taxable-turnover registration threshold', scheme: 'uk-vat',
    countryCodes: ['GB'], activity: UK_ACTIVITY, currency: 'GBP', thresholdCents: 9_000_000,
    window: 'rolling-12-months', validFrom: '2024-04-01',
    source: { authority: 'HM Revenue & Customs', url: HMRC_THRESHOLD, retrieved: CHECKED }, guidanceUrl: HMRC_TESTS,
    note: '£90,000 from 1 April 2024. HMRC also has a separate expectation-of-exceeding test for the next 30 days; this report shows only posted taxable-turnover history for the trailing 12 months.',
  },
  {
    id: 'ca-gst-small-supplier-single-quarter', name: 'Canada GST/HST small-supplier threshold — any single calendar quarter', scheme: 'ca-gst-small-supplier',
    countryCodes: ['CA'], activity: CA_ACTIVITY, currency: 'CAD', thresholdCents: 3_000_000,
    window: 'canada-single-quarter-series', validFrom: '1991-01-01',
    source: { authority: 'Canada Revenue Agency', url: CRA_TESTS, retrieved: CHECKED }, guidanceUrl: CRA_1991,
    note: 'C$30,000. CRA’s single-quarter test can end small-supplier status immediately. The view shows posted quarter amounts only; CRA scope includes worldwide taxable supplies, all businesses and associated persons, with statutory exclusions and special cases.',
  },
  {
    id: 'ca-gst-small-supplier-four-quarters', name: 'Canada GST/HST small-supplier threshold — four consecutive calendar quarters', scheme: 'ca-gst-small-supplier',
    countryCodes: ['CA'], activity: CA_ACTIVITY, currency: 'CAD', thresholdCents: 3_000_000,
    window: 'canada-previous-four-quarters', validFrom: '1991-01-01',
    source: { authority: 'Canada Revenue Agency', url: CRA_TESTS, retrieved: CHECKED }, guidanceUrl: CRA_1991,
    note: 'C$30,000 across four consecutive calendar quarters. CRA timing differs from the single-quarter test; this view shows the four most recently completed quarters and does not determine a registration effective date. CRA scope includes worldwide taxable supplies, all businesses and associated persons, with statutory exclusions and special cases.',
  },
  {
    id: 'eu-oss-place-of-supply-2021-07', name: 'EU-wide OSS-related place-of-supply threshold', scheme: 'eu-oss-place-of-supply',
    countryCodes: EU_VAT_COUNTRIES, activity: EU_ACTIVITY, currency: 'EUR', thresholdCents: 1_000_000,
    window: 'eu-current-and-previous-calendar-year', validFrom: '2021-07-01',
    source: { authority: 'European Commission, Taxation and Customs Union', url: EU_SUMMARY, retrieved: CHECKED }, guidanceUrl: EU_GUIDANCE,
    note: '€10,000 EU-wide, not per destination country. Only qualifying intra-EU distance sales of goods and cross-border TBE services to consumers count; the threshold’s scope depends on the supplier’s EU establishment and, for goods, dispatch from its Member State of establishment. This is a place-of-supply threshold, not a generic sales or VAT-registration ceiling, and this report does not decide OSS eligibility.',
  },
];

const ALIAS_INDEX = new Map<string, string>();
const normalizeAlias = (value: string) => value.normalize('NFC').toLowerCase().replace(/[_\s]+/g, ' ').trim().replace(/\s+/g, ' ');
for (const activity of REGISTRATION_THRESHOLD_ACTIVITIES) {
  for (const alias of activity.aliases) ALIAS_INDEX.set(normalizeAlias(alias), activity.value);
}

/** Match only a published activity code, label or alias; never infer legal activity from a description. */
export function canonicalRegistrationThresholdActivity(value: string | null | undefined): string | undefined {
  return typeof value === 'string' ? ALIAS_INDEX.get(normalizeAlias(value)) : undefined;
}
