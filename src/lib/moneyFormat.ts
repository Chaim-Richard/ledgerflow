export interface MoneyDisplaySettings {
  locale?: string;
  negativeStyle?: 'minus' | 'accounting';
}
/** Display only. The caller supplies currency minor-unit precision; no amount is written back. */
export function moneyText(cents: number | null | undefined, currency: string, digits: number, settings: MoneyDisplaySettings = {}): string {
  const amount = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0;
  let locale: string | undefined;
  try { if (settings.locale && settings.locale.length <= 64) locale = Intl.getCanonicalLocales(settings.locale)[0]; } catch { /* retain the browser default */ }
  const accounting = settings.negativeStyle === 'accounting' && amount < 0;
  let text: string;
  try {
    text = new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format((accounting ? Math.abs(amount) : amount) / 10 ** digits);
  } catch { text = `${currency} ${((accounting ? Math.abs(amount) : amount) / 10 ** digits).toFixed(digits)}`; }
  return accounting ? `(${text})` : text;
}

/** Number styles offered (BB-05, BM-01..BM-03); the workspace may keep another valid one. */
export const MONEY_LOCALES = [
  { value: '', label: 'This browser\'s' },
  { value: 'en-US', label: 'United States' },
  { value: 'en-GB', label: 'United Kingdom' },
  { value: 'he-IL', label: 'Israel' },
  { value: 'de-DE', label: 'Germany' },
  { value: 'fr-FR', label: 'France' },
  { value: 'es-ES', label: 'Spain' },
  { value: 'it-IT', label: 'Italy' },
  { value: 'nl-NL', label: 'Netherlands' },
  { value: 'de-CH', label: 'Switzerland' },
  { value: 'en-IN', label: 'India' },
  { value: 'ja-JP', label: 'Japan' },
] as const;
