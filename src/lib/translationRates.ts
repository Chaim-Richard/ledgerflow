/**
 * Translation rates for a group in one currency (Z-17): for each member currency, how much 1 unit
 * is in the reporting currency at the end date (closing, for assets and liabilities), on average over
 * the period (income and costs), and when the equity was put in (historical). The rate service
 * (`/api/v1/currency/historical` and `/timeframe`, quotes as "1 reporting currency = X member
 * currency") can fill them; they are never invented, and a missing one is asked for.
 */
export interface TranslationRates { closing: number; average: number; historical: number }

type Quotes = Record<string, number> | undefined;

/** 1 `currency` in `source`, from a quote of "1 source = X currency"; undefined when it is missing. */
export function rateFromQuote(quotes: Quotes, source: string, currency: string): number | undefined {
  const x = quotes?.[`${source}${currency}`];
  return typeof x === 'number' && x > 0 ? round6(1 / x) : undefined;
}

/** The average over the days the rate service has, of 1 `currency` in `source`. */
export function averageFromTimeframe(byDay: Record<string, Quotes> | undefined, source: string, currency: string): number | undefined {
  const rates = Object.values(byDay || {}).map(q => rateFromQuote(q, source, currency)).filter((r): r is number => r !== undefined);
  return rates.length ? round6(rates.reduce((s, r) => s + r, 0) / rates.length) : undefined;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** The rates as entered (text) → numbers, or what is missing. */
export function parseRates(currencies: string[], entered: Record<string, Partial<Record<keyof TranslationRates, string>>>): { rates: Record<string, TranslationRates> } | { problem: string } {
  const rates: Record<string, TranslationRates> = {};
  for (const currency of currencies) {
    const e = entered[currency] || {};
    const r = { closing: Number(e.closing), average: Number(e.average), historical: Number(e.historical) };
    if (![r.closing, r.average, r.historical].every(x => Number.isFinite(x) && x > 0)) return { problem: `Enter the closing, average and historical rates for ${currency}` };
    rates[currency] = r;
  }
  return { rates };
}
