/**
 * E-25: mask plausible payment-card numbers in free text BEFORE storing or
 * sending it. This is an additional browser safeguard, not PCI compliance.
 *
 * A Luhn checksum alone is not proof of a card; avoid masking every large
 * invoice/account number, and do not log the original text. The backend must
 * independently scrub sensitive fields and reject unexpected secrets.
 */

/** Check a complete 13–19 digit sequence using the checksum used on cards. */
export function passesCardLuhn(input: string): boolean {
  if (!/^\d{13,19}$/.test(input) || /^(\d)\1+$/.test(input)) return false;
  let sum = 0;
  let double = false;
  for (let i = input.length - 1; i >= 0; i--) {
    let digit = input.charCodeAt(i) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Keep only the final four numerals. Whitespace and simple grouping dashes
 * remain, but earlier digits are masked. The original string is not mutated.
 * Non-matching and checksum-invalid identifiers are unchanged.
 */
export function maskCardNumbers(input: string): string {
  if (!input) return input;
  return input.replace(/(?<![A-Za-z0-9])(?:\d[ -]?){12,18}\d(?![A-Za-z0-9])/g, candidate => {
    const digits = candidate.replace(/\D/g, '');
    if (!passesCardLuhn(digits)) return candidate;
    let left = digits.length - 4;
    return candidate.replace(/\d/g, digit => left-- > 0 ? '•' : digit);
  });
}
