/**
 * An amount written out in words, the way a cheque needs it (BE-13):
 * 123456 cents → "One thousand two hundred thirty-four and 56/100". English, whole cents, up to
 * 999,999,999,999.99; the cents are always written as a fraction, as banks expect.
 */
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion'];

function underThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (rest >= 20) parts.push(TENS[Math.floor(rest / 10)] + (rest % 10 ? `-${ONES[rest % 10]}` : ''));
  else if (rest) parts.push(ONES[rest]);
  return parts.join(' ');
}

/** The whole-number part in words ("zero" for 0). */
export function numberInWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error('A whole number of zero or more is needed');
  if (n === 0) return 'zero';
  const groups: string[] = [];
  for (let scale = 0, rest = n; rest > 0; scale++, rest = Math.floor(rest / 1000)) {
    const chunk = rest % 1000;
    if (scale >= SCALES.length) throw new Error('Too large to write out');
    if (chunk) groups.unshift(underThousand(chunk) + (SCALES[scale] ? ` ${SCALES[scale]}` : ''));
  }
  return groups.join(' ');
}

/** "One thousand two hundred thirty-four and 56/100" for 123456 cents. */
export function amountInWords(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new Error('An amount in whole cents of zero or more is needed');
  const words = numberInWords(Math.floor(cents / 100));
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} and ${String(cents % 100).padStart(2, '0')}/100`;
}
