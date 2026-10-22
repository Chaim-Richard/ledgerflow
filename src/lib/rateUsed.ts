/**
 * BM-06: which exchange rate each converted line used — its date and where it came from — kept with the entry so the
 * entry detail says it, and two lines of one entry at two rates (a payment: the invoice's rate on A/R, the day's on
 * cash) can be told apart. Pure.
 */
export type RateSource = 'typed' | 'last-used' | 'live' | 'books-on-date' | 'document';

export interface RateUsed {
  /** the document's currency → the books' */
  currency: string;
  base: string;
  /** major units of the books per major unit of the document */
  rate: number;
  /** the day the rate is for */
  date: string;
  source: RateSource;
}

const SOURCE_TEXT: Record<RateSource, string> = {
  typed: 'typed by hand',
  'last-used': 'the last rate used',
  live: "that day's market rate",
  'books-on-date': 'the rate the books used on that day',
  document: "the document's rate",
};

/** One id per rate, the same wherever it is used: "EUR>USD@2026-10-01:live:1.1". */
export function rateUsedId(r: RateUsed): string {
  return `${r.currency}>${r.base}@${r.date}:${r.source}:${r.rate}`;
}

/** "1 EUR = 1.1 USD on 2026-10-01 (that day's market rate)" */
export function rateUsedText(r: RateUsed): string {
  return `1 ${r.currency} = ${r.rate} ${r.base} on ${r.date} (${SOURCE_TEXT[r.source] || r.source})`;
}

/** The record for a converted document: what the form recorded when it is for this rate, else "the document's rate" on its date. */
export function rateUsedFor(input: { currency: string; base: string; rate: number; date: string; recorded?: Partial<RateUsed> | null }): RateUsed {
  const recorded = input.recorded;
  const same = recorded && Number(recorded.rate) === input.rate && typeof recorded.date === 'string' && typeof recorded.source === 'string';
  return { currency: input.currency, base: input.base, rate: input.rate, date: same ? recorded!.date! : input.date.slice(0, 10), source: same ? recorded!.source as RateSource : 'document' };
}
