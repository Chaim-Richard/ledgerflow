/**
 * E-13 — Structural validation of Israeli identity and company registration IDs.
 *
 * This is a LOCAL checksum/format warning only. It does not confirm the number
 * was issued, that an entity exists, who owns it, tax registration, or status.
 * Never log/submit an entered identifier to a third party for this check.
 *
 * Reference examples: python-stdnum IL idnr and hp validators.
 * https://arthurdejong.org/python-stdnum/doc/2.1/stdnum.il.hp
 * Israel Corporations Authority registry: https://www.gov.il/en/service/company_extract
 */
export type IsraeliIdentifierKind = 'identity' | 'company';
export type IdentifierWarningReason = 'not-digits' | 'length' | 'company-prefix' | 'checksum' | 'zero-number';

export type IdentifierCheck =
  | { state: 'empty'; isValid: false; reason: null; masked: null }
  | { state: 'warning'; isValid: false; reason: IdentifierWarningReason; masked: null }
  | { state: 'valid-format'; isValid: true; reason: null; masked: string };

const REASON_TEXT: Record<IdentifierWarningReason, string> = {
  'not-digits': 'Use digits only, optionally separated by spaces or hyphens.',
  length: 'An Israeli ID has up to 9 digits; a company number must have exactly 9.',
  'company-prefix': 'A company registration number must begin with 5.',
  checksum: 'The check digit does not match. Please review the number.',
  'zero-number': 'An all-zero identifier is not accepted.',
};

function checksumValid(digits: string): boolean {
  let sum = 0;
  for (let index = 0; index < digits.length; index++) {
    const product = (digits.charCodeAt(index) - 48) * (index % 2 === 0 ? 1 : 2);
    sum += product > 9 ? product - 9 : product;
  }
  return sum % 10 === 0;
}

/**
 * No persistence, I/O, store access or side effects. The only returned value
 * derived from a valid ID is a masked last-four representation.
 *
 * Identity IDs are left-zero-filled to nine digits for checksum purposes.
 * Company numbers are always nine digits and begin with 5; do not use company
 * validation as a sole-proprietor / dealer-number checker.
 */
export function checkIsraeliIdentifier(value: unknown, kind: IsraeliIdentifierKind): IdentifierCheck {
  if (value === '' || value == null || (typeof value === 'string' && !value.trim())) {
    return { state: 'empty', isValid: false, reason: null, masked: null };
  }
  if (typeof value !== 'string' || !/^[0-9 -]+$/.test(value.trim())) {
    return { state: 'warning', isValid: false, reason: 'not-digits', masked: null };
  }
  const compact = value.replace(/[ -]/g, '');
  if (!compact || compact.length > 9 || (kind === 'company' && compact.length !== 9)) {
    return { state: 'warning', isValid: false, reason: 'length', masked: null };
  }
  if (kind === 'company' && compact[0] !== '5') {
    return { state: 'warning', isValid: false, reason: 'company-prefix', masked: null };
  }
  const padded = compact.padStart(9, '0');
  if (/^0{9}$/.test(padded)) {
    return { state: 'warning', isValid: false, reason: 'zero-number', masked: null };
  }
  if (!checksumValid(padded)) {
    return { state: 'warning', isValid: false, reason: 'checksum', masked: null };
  }
  return { state: 'valid-format', isValid: true, reason: null, masked: '•••••' + padded.slice(-4) };
}

/** User-facing warning without echoing the raw identifier in DOM or logs. */
export function israeliIdentifierWarning(check: IdentifierCheck): string | null {
  return check.state === 'warning' ? REASON_TEXT[check.reason] : null;
}
