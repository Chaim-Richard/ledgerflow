/**
 * Exchange rate help on foreign-currency documents (BA-06, I-23): the rate is how many units of
 * the home currency one unit of the document's currency is worth (as on the invoice and bill
 * forms). Never a guessed number: the last rate this workspace used for that currency, or today's
 * rate from the server's rate service when it answers.
 */
import { getIdToken } from '../firebase';

export function lastUsedRate(currency: string, docs: Array<{ currency?: string; exchangeRate?: number; date?: string }>): number | null {
  const used = docs
    .filter(d => d.currency === currency && typeof d.exchangeRate === 'number' && d.exchangeRate > 0 && d.exchangeRate !== 1)
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
  return used?.exchangeRate ?? null;
}

/** Today's rate for 1 `from` in `to`, or null when the rate service can't answer. */
export async function fetchLiveRate(from: string, to: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/v1/fx/rate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
      headers: { Authorization: `Bearer ${await getIdToken()}` },
    });
    if (!res.ok) return null;
    const data = await res.json() as { rate?: unknown };
    const rate = Number(data.rate);
    return Number.isFinite(rate) && rate > 0 && rate < 1e6 ? Math.round(rate * 10000) / 10000 : null;
  } catch {
    return null;
  }
}

/** Common world currencies offered on documents (ISO 4217). */
export const WORLD_CURRENCIES = ['USD', 'EUR', 'GBP', 'ILS', 'CAD', 'AUD', 'NZD', 'JPY', 'CHF', 'CNY', 'HKD', 'SGD', 'INR', 'SEK',
  'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'ZAR', 'BRL', 'MXN', 'ARS', 'CLP', 'COP', 'AED', 'SAR', 'KRW', 'TWD', 'THB', 'PHP', 'IDR', 'MYR'] as const;

/**
 * Currencies to choose from on an invoice or bill (BA-06): the home currency, this document's, the
 * ones the workspace already uses, then the common world currencies.
 */
export function documentCurrencies(home: string, current: string | undefined, used: Array<{ currency?: string }>): string[] {
  const inUse = used.map(d => (d.currency || '').toUpperCase()).filter(c => /^[A-Z]{3}$/.test(c));
  return [...new Set([home, ...(current ? [current] : []), ...inUse, ...WORLD_CURRENCIES])];
}

/** A rate this workspace used: on which day, how many documents used it (K-29). */
export interface RateUse { date: string; rate: number; count: number }

interface RatedDoc { currency?: string; exchangeRate?: number; date?: string }

/**
 * Exchange-rate history at posting (K-29): the rates the workspace's documents were posted at for
 * one currency, by day (newest first). Built from the documents themselves, so it is exactly what
 * the books used.
 */
export function rateHistory(currency: string, docs: RatedDoc[]): RateUse[] {
  const byKey = new Map<string, RateUse>();
  for (const d of docs) {
    if (d.currency !== currency || typeof d.exchangeRate !== 'number' || !(d.exchangeRate > 0) || d.exchangeRate === 1 || !d.date) continue;
    const date = d.date.slice(0, 10);
    const key = `${date}|${d.exchangeRate}`;
    const use = byKey.get(key) || { date, rate: d.exchangeRate, count: 0 };
    use.count += 1;
    byKey.set(key, use);
  }
  return [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date) || a.rate - b.rate);
}

/** The rate used on `date`, or the closest day before it; null when none was used by then. */
export function rateOn(currency: string, date: string, docs: RatedDoc[]): RateUse | null {
  return rateHistory(currency, docs).find(u => u.date <= date.slice(0, 10)) ?? null;
}
