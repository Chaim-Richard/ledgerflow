/**
 * E-15 — Country-specific EU and UK VAT identifier format warnings.
 *
 * No network requests; matching a pattern never proves a number exists, has
 * been assigned, is active in VIES/HMRC, or belongs to a particular customer.
 * Never use this helper to decide reverse-charge, exemption or tax posting.
 *
 * Source: https://taxation-customs.ec.europa.eu/taxation/vat/vat-directive/vat-rates/country-specific-information-vat_en
 * EU authority check: https://ec.europa.eu/taxation_customs/vies/
 * UK: https://www.gov.uk/hmrc-internal-manuals/vat-registration-manual/vatreg03700
 */
export type VatCountry =
  | 'AT' | 'BE' | 'BG' | 'HR' | 'CY' | 'CZ' | 'DK' | 'EE' | 'FI'
  | 'FR' | 'DE' | 'EL' | 'HU' | 'IE' | 'IT' | 'LV' | 'LT' | 'LU'
  | 'MT' | 'NL' | 'PL' | 'PT' | 'RO' | 'SK' | 'SI' | 'ES' | 'SE'
  | 'GB' | 'XI';

/**
 * These are structural sanity checks. More complex country checksum algorithms
 * and genuine registration verification must be separately verified.
 * 'XI' is a distinct Northern Ireland VAT prefix, not synonymous with 'GB'.
 */
interface VatCountryFormat {
  pattern: RegExp;
  source: string;
  /** Format table was reviewed for this project; NOT a legal effective date. */
  reviewedOn: string;
}

const EU_SOURCE = 'https://taxation-customs.ec.europa.eu/taxation/vat/vat-directive/vat-rates/country-specific-information-vat_en';
const UK_SOURCE = 'https://www.gov.uk/hmrc-internal-manuals/vat-registration-manual/vatreg03700';
const REVIEWED = '2026-10-11';
const eu = (pattern: RegExp): VatCountryFormat =>
  ({ pattern, source: EU_SOURCE, reviewedOn: REVIEWED });

export const VAT_COUNTRY_FORMATS: Readonly<Record<VatCountry, VatCountryFormat>> = {
  AT: eu(/^U[0-9]{8}$/),
  BE: eu(/^[01][0-9]{9}$/),
  BG: eu(/^[0-9]{9,10}$/),
  HR: eu(/^[0-9]{11}$/),
  CY: eu(/^[0-9]{8}[A-Z]$/),
  CZ: eu(/^(?:[0-9]{8}|[0-9]{9}|[0-9]{10})$/),
  DK: eu(/^[0-9]{8}$/),
  EE: eu(/^[0-9]{9}$/),
  FI: eu(/^[0-9]{8}$/),
  FR: eu(/^[A-HJ-NP-Z0-9]{2}[0-9]{9}$/),
  DE: eu(/^[0-9]{9}$/),
  EL: eu(/^[0-9]{9}$/),
  HU: eu(/^[0-9]{8}$/),
  IE: eu(/^(?:[0-9]{7}[A-W](?:[AH])?|[0-9][A-Z*+][0-9]{5}[A-W])$/),
  IT: eu(/^[0-9]{11}$/),
  LV: eu(/^[0-9]{11}$/),
  LT: eu(/^(?:[0-9]{9}|[0-9]{12})$/),
  LU: eu(/^[0-9]{8}$/),
  MT: eu(/^[0-9]{8}$/),
  NL: eu(/^[0-9]{9}B[0-9]{2}$/),
  PL: eu(/^[0-9]{10}$/),
  PT: eu(/^[0-9]{9}$/),
  RO: eu(/^[0-9]{2,10}$/),
  SK: eu(/^[0-9]{10}$/),
  SI: eu(/^[0-9]{8}$/),
  ES: eu(/^(?:[A-Z][0-9]{7}[A-Z0-9]|[0-9]{8}[A-Z])$/),
  SE: eu(/^[0-9]{10}01$/),
  GB: { pattern: /^(?:[0-9]{9}|GD[0-9]{3})$/, source: UK_SOURCE, reviewedOn: REVIEWED },
  XI: eu(/^[0-9]{9}$/),
};

/** 'GR' selects the Greek 'EL' VAT prefix; 'UK' selects 'GB'. */
function canonicalCountry(country: unknown): VatCountry | null {
  if (typeof country !== 'string') return null;
  const canonical = country.toUpperCase().trim();
  const value = canonical === 'GR' ? 'EL' : canonical === 'UK' ? 'GB' : canonical;
  return Object.prototype.hasOwnProperty.call(VAT_COUNTRY_FORMATS, value)
    ? value as VatCountry : null;
}

export type VatFormatProblem =
  | 'unsupported-country' | 'characters' | 'country-mismatch'
  | 'format' | 'placeholder';

export type VatFormatCheck =
  | { status: 'empty'; country: VatCountry | null; problem: null; masked: null }
  | { status: 'warning'; country: VatCountry | null; problem: VatFormatProblem; masked: null }
  | { status: 'valid-format'; country: VatCountry; problem: null; masked: string };

const WARNING_MESSAGE: Readonly<Record<VatFormatProblem, string>> = {
  'unsupported-country': 'Choose a supported EU country or the UK before checking the VAT number.',
  characters: 'Use letters, digits, and ordinary spaces, dots or hyphens only.',
  'country-mismatch': 'The VAT number prefix does not match the selected country.',
  format: 'The VAT number does not match the selected country’s expected format.',
  placeholder: 'An all-zero placeholder is not a usable VAT number.',
};

/**
 * Expects a selected country (country in taxPlace, not guessed from the number).
 * A country prefix is optional in human input but, if present, must match.
 * Only a masked suffix is returned; no plaintext normalized number is exposed.
 */
export function checkVatNumber(value: unknown, selectedCountry: unknown): VatFormatCheck {
  const country = canonicalCountry(selectedCountry);
  if (value === null || value === undefined || value === '' ||
      (typeof value === 'string' && !value.trim())) {
    return { status: 'empty', country, problem: null, masked: null };
  }
  if (!country) {
    return { status: 'warning', country: null, problem: 'unsupported-country', masked: null };
  }
  if (typeof value !== 'string' || value.length > 45 ||
      !/^[A-Za-z0-9 .\-*+]+$/.test(value.trim())) {
    return { status: 'warning', country, problem: 'characters', masked: null };
  }
  const compact = value.toUpperCase().replace(/[ .-]/g, '');
  // An explicitly supplied known country prefix must never be discarded merely
  // because the user selected another country. Greece is written EL, not GR.
  const embedded = compact.slice(0, 2);
  const prefixed = Object.prototype.hasOwnProperty.call(VAT_COUNTRY_FORMATS, embedded);
  if (prefixed && embedded !== country) {
    return { status: 'warning', country, problem: 'country-mismatch', masked: null };
  }
  const local = prefixed && embedded === country ? compact.slice(2) : compact;
  if (!VAT_COUNTRY_FORMATS[country].pattern.test(local)) {
    return { status: 'warning', country, problem: 'format', masked: null };
  }
  // Even an otherwise well-shaped all-zero registration is a common dummy.
  if (!/[1-9]/.test(local)) {
    return { status: 'warning', country, problem: 'placeholder', masked: null };
  }
  return {
    status: 'valid-format', country, problem: null,
    masked: country + '••••' + local.slice(-4),
  };
}

/** Accessible, nonblocking warning. Neither message nor result echoes the VAT number. */
export function vatFormatWarning(check: VatFormatCheck): string | null {
  return check.status === 'warning' ? WARNING_MESSAGE[check.problem] : null;
}

/** No raw number, no VIES/HMRC call; only format matching in the chosen country. */
export function maskVatNumber(value: unknown, selectedCountry: unknown): string | null {
  return checkVatNumber(value, selectedCountry).masked;
}

export const VAT_COUNTRIES = Object.freeze(
  Object.keys(VAT_COUNTRY_FORMATS) as VatCountry[],
);
