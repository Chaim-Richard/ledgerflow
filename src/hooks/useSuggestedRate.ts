import { useEffect, useRef, useState } from 'react';
import { fetchLiveRate, lastUsedRate } from '../lib/exchangeRates';

interface Options {
  currency: string;
  homeCurrency: string;
  /** False once the person typed a rate, or for a document that already exists. */
  enabled: boolean;
  docs: Array<{ currency?: string; exchangeRate?: number; date?: string }>;
  onRate: (rate: number) => void;
}

/**
 * Fills the exchange rate when a document switches to another currency (BA-06, I-23): the last
 * rate used for it straight away, then today's rate when the rate service answers. Returns a short
 * note saying where the rate came from (null when nothing was filled).
 */
export function useSuggestedRate({ currency, homeCurrency, enabled, docs, onRate }: Options): string | null {
  const [note, setNote] = useState<string | null>(null);
  const latest = useRef({ docs, onRate });
  useEffect(() => { latest.current = { docs, onRate }; });

  useEffect(() => {
    if (!enabled || !currency || currency === homeCurrency) return;
    let cancelled = false;
    void Promise.resolve().then(async () => {
      const last = lastUsedRate(currency, latest.current.docs);
      if (last && !cancelled) { latest.current.onRate(last); setNote(`Last rate used for ${currency}`); }
      const live = await fetchLiveRate(currency, homeCurrency);
      if (live && !cancelled) { latest.current.onRate(live); setNote(`Today's rate for ${currency}`); }
      else if (!last && !cancelled) setNote(`No rate found for ${currency}: type it`);
    });
    return () => { cancelled = true; };
  }, [currency, homeCurrency, enabled]);

  return enabled && currency !== homeCurrency ? note : null;
}
