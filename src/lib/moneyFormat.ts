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
