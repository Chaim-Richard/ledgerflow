/**
 * A-139: IBAN per-country length and routing checksum table (calculation status).
 *
 * US routing numbers are 9 digits with a weighted checksum (nacha.ts validRouting).
 * IBANs are per ISO 13616: country code (2 letters) + 2 check digits + BBAN (country-specific length).
 * The check digits are mod-97 (ISO 7064); ibanValid in paymentRun.ts already does that.
 * What this file adds: the *length* per country, so a typo that still passes mod-97 but is the wrong
 * length is caught, and the screen can say what length is expected.
 *
 * This is a reference table for validation and data quality, not a bank's or authority's live registry.
 * Every row names SWIFT/ISO 13616 as the source and is checked 2026-10-19. Lengths are stable; if a
 * country changes its IBAN structure, the SWIFT IBAN registry governs.
 */

export interface IbanCountrySpec {
  country: string; // ISO 3166-1 alpha-2
  countryName: string;
  length: number; // total IBAN characters (2 + 2 + BBAN)
  bbanPattern?: string; // illustrative, not enforced here (SWIFT registry)
  source: { authority: string; url: string; retrieved: string };
  note?: string;
}

const CHECKED = '2026-10-19';
const SWIFT = 'https://www.swift.com/about-us/legal/compliance-0/iban-registry';
const ISO13616 = 'https://www.iso.org/standard/81090.html';

export const IBAN_COUNTRY_SPECS: IbanCountrySpec[] = [
  { country: 'AL', countryName: 'Albania', length: 28, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'AD', countryName: 'Andorra', length: 24, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'AT', countryName: 'Austria', length: 20, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'AZ', countryName: 'Azerbaijan', length: 28, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'BH', countryName: 'Bahrain', length: 22, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'BY', countryName: 'Belarus', length: 28, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'BE', countryName: 'Belgium', length: 16, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'BA', countryName: 'Bosnia and Herzegovina', length: 20, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'BR', countryName: 'Brazil', length: 29, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'BG', countryName: 'Bulgaria', length: 22, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'CR', countryName: 'Costa Rica', length: 22, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'HR', countryName: 'Croatia', length: 21, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'CY', countryName: 'Cyprus', length: 28, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'CZ', countryName: 'Czech Republic', length: 24, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'DK', countryName: 'Denmark', length: 18, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'DO', countryName: 'Dominican Republic', length: 28, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'EG', countryName: 'Egypt', length: 29, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'SV', countryName: 'El Salvador', length: 28, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'FO', countryName: 'Faroe Islands', length: 18, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'FI', countryName: 'Finland', length: 18, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'FR', countryName: 'France', length: 27, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'GE', countryName: 'Georgia', length: 22, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'DE', countryName: 'Germany', length: 22, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'GI', countryName: 'Gibraltar', length: 23, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'GR', countryName: 'Greece', length: 27, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'GL', countryName: 'Greenland', length: 18, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'GT', countryName: 'Guatemala', length: 28, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'HU', countryName: 'Hungary', length: 28, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'IS', countryName: 'Iceland', length: 26, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'IQ', countryName: 'Iraq', length: 23, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'IE', countryName: 'Ireland', length: 22, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'IL', countryName: 'Israel', length: 23, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED }, note: 'IL 23 chars: 2+2+19 (Bank/Branch/Account)' },
  { country: 'IT', countryName: 'Italy', length: 27, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'JO', countryName: 'Jordan', length: 30, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'KZ', countryName: 'Kazakhstan', length: 20, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'XK', countryName: 'Kosovo', length: 20, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'KW', countryName: 'Kuwait', length: 30, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'LV', countryName: 'Latvia', length: 21, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'LB', countryName: 'Lebanon', length: 28, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'LI', countryName: 'Liechtenstein', length: 21, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'LT', countryName: 'Lithuania', length: 20, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'LU', countryName: 'Luxembourg', length: 20, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'MT', countryName: 'Malta', length: 31, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'MR', countryName: 'Mauritania', length: 27, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'MU', countryName: 'Mauritius', length: 30, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'MD', countryName: 'Moldova', length: 24, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'MC', countryName: 'Monaco', length: 27, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'ME', countryName: 'Montenegro', length: 22, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'NL', countryName: 'Netherlands', length: 18, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'MK', countryName: 'North Macedonia', length: 19, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'NO', countryName: 'Norway', length: 15, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'PK', countryName: 'Pakistan', length: 24, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'PS', countryName: 'Palestine', length: 29, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'PL', countryName: 'Poland', length: 28, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'PT', countryName: 'Portugal', length: 25, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'QA', countryName: 'Qatar', length: 29, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'RO', countryName: 'Romania', length: 24, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'SM', countryName: 'San Marino', length: 27, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'SA', countryName: 'Saudi Arabia', length: 24, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'RS', countryName: 'Serbia', length: 22, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'SK', countryName: 'Slovakia', length: 24, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'SI', countryName: 'Slovenia', length: 19, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'ES', countryName: 'Spain', length: 24, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'SE', countryName: 'Sweden', length: 24, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'CH', countryName: 'Switzerland', length: 21, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'TN', countryName: 'Tunisia', length: 24, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'TR', countryName: 'Türkiye', length: 26, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'UA', countryName: 'Ukraine', length: 29, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'AE', countryName: 'United Arab Emirates', length: 23, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'GB', countryName: 'United Kingdom', length: 22, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
  { country: 'VG', countryName: 'Virgin Islands, British', length: 24, source: { authority: 'SWIFT IBAN Registry', url: SWIFT, retrieved: CHECKED } },
];

export const IBAN_COUNTRY_CODES = IBAN_COUNTRY_SPECS.map(s => s.country);
const LENGTH_BY_COUNTRY = new Map(IBAN_COUNTRY_SPECS.map(s => [s.country, s.length]));

export function ibanLengthFor(country: string): number | undefined {
  return LENGTH_BY_COUNTRY.get(country.toUpperCase());
}

export function ibanExpectedLength(value: string): number | undefined {
  const cc = value.replace(/[\s-]/g, '').slice(0, 2).toUpperCase();
  return LENGTH_BY_COUNTRY.get(cc);
}

/** Why this IBAN is invalid, or null when it passes country-length + mod97. */
export function ibanProblem(value: string): string | null {
  const iban = value.replace(/[\s-]/g, '').toUpperCase();
  if (!iban) return null;
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return 'An IBAN starts with 2 letters and 2 digits';
  const country = iban.slice(0, 2);
  const expected = LENGTH_BY_COUNTRY.get(country);
  if (!expected) return 'This country does not use IBAN (or not in this table — check the SWIFT registry)';
  if (iban.length !== expected) return `${country} IBANs are ${expected} characters (this one is ${iban.length})`;
  // mod97
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  if (rest !== 1) return 'This IBAN has a typo (its check digits don’t match)';
  return null;
}

/** True when the IBAN passes country-length + mod97; false for unknown countries/lengths. */
export function ibanValidCountry(value: string): boolean {
  return ibanProblem(value) === null && Boolean(value.replace(/[\s-]/g, '').trim());
}

/** Structural problems in this table. */
export function ibanCountrySpecProblems(): string[] {
  const problems: string[] = [];
  for (const row of IBAN_COUNTRY_SPECS) {
    if (!/^[A-Z]{2}$/.test(row.country)) problems.push(`${row.country}: country must be 2 letters`);
    if (!Number.isInteger(row.length) || row.length < 15 || row.length > 34) problems.push(`${row.country}: length ${row.length} not in 15..34`);
    if (!/^https:\/\//.test(row.source.url)) problems.push(`${row.country}: source must be https`);
  }
  const seen = new Set<string>();
  for (const row of IBAN_COUNTRY_SPECS) {
    if (seen.has(row.country)) problems.push(`Duplicate ${row.country}`);
    seen.add(row.country);
  }
  // spot-check known lengths
  if (ibanLengthFor('IL') !== 23) problems.push('IL must be 23');
  if (ibanLengthFor('DE') !== 22) problems.push('DE must be 22');
  if (ibanLengthFor('GB') !== 22) problems.push('GB must be 22');
  if (ibanLengthFor('FR') !== 27) problems.push('FR must be 27');
  return problems;
}

/** US routing checksum (nacha.ts validRouting re-exported for a single banking import). */
export { validRouting } from '../../lib/nacha';

export const US_ROUTING_LENGTH = 9;
