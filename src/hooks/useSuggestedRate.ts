import { useEffect, useRef, useState } from 'react';
import { fetchLiveRate, lastUsedRate, rateOn } from '../lib/exchangeRates';
import { getLocalDateISO } from '../lib/utils';

interface Options {
  currency: string;
  homeCurrency: string;
  /** False once the person typed a rate, or for a document that already exists. */
  enabled: boolean;
  docs: Array<{ currency?: string; exchangeRate?: number; date?: string }>;
  onRate: (rate: number) => void;
  /** The document's date: a past one gets the rate used on (or just before) that day, not today's (K-29). */
  date?: string;
}

/**
 * Fills the exchange rate when a document switches to another currency (BA-06, I-23): the last
 * rate used for it straight away, then today's rate when the rate service answers. Returns a short
 * note saying where the rate came from (null when nothing was filled).
 */
export function useSuggestedRate({ currency, homeCurrency, enabled, docs, onRate, date }: Options): string | null {
  const [note, setNote] = useState<string | null>(null);
  const latest = useRef({ docs, onRate });
  useEffect(() => { latest.current = { docs, onRate }; });

  useEffect(() => {
    if (!enabled || !currency || currency === homeCurrency) return;
    let cancelled = false;
    const day = (date || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day < getLocalDateISO()) {
      // a back-dated document: today's rate would be wrong; the rate the books used around that day
      void Promise.resolve().then(() => {
        if (cancelled) return;
        const used = rateOn(currency, day, latest.current.docs);
        if (used) { latest.current.onRate(used.rate); setNote(used.date === day ? `Rate used on ${day}` : `Rate used on ${used.date} (the closest before ${day})`); }
        else setNote(`No ${currency} rate recorded on or before ${day}: type that day's rate`);
      });
      return () => { cancelled = true; };
    }
    void Promise.resolve().then(async () => {
      const last = lastUsedRate(currency, latest.current.docs);
      if (last && !cancelled) { latest.current.onRate(last); setNote(`Last rate used for ${currency}`); }
      const live = await fetchLiveRate(currency, homeCurrency);
      if (live && !cancelled) { latest.current.onRate(live); setNote(`Today's rate for ${currency}`); }
      else if (!last && !cancelled) setNote(`No rate found for ${currency}: type it`);
    });
    return () => { cancelled = true; };
  }, [currency, homeCurrency, enabled, date]);

  return enabled && currency !== homeCurrency ? note : null;
}
