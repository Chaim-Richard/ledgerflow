/**
 * BM-04 + BH-02: how money is stored (docs/design/BM-04-currency-minor-units.md). Every amount is a whole number of
 * the **minor units of its own currency** — the ISO 4217 exponent: cents for USD (2), whole yen for JPY (0), fils for
 * KWD (3). A document keeps its amounts in its own currency; its entries are in the books' currency. Converting is
 * therefore the exchange rate (major units of the books per major unit of the document) times 10^(books' digits −
 * document's digits), so ¥10,000 at 0.0067 is $67.00 = 6,700 cents, not 670,000. Pure: no stores, used on both sides.
 */

/** ISO 4217 currencies with three decimals (Intl gives some of them fewer: IQD). */
export const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

/**
 * The number of decimals of a currency: three for the dinars above, otherwise what Intl knows of ISO 4217 (0 for JPY,
 * KRW, ISK…), 2 when unknown or not given. The screens show amounts with the same rule (utils.getCurrencyFractionDigits).
 */
export function currencyDigits(currency?: string | null): number {
  const code = String(currency || '').trim().toUpperCase();
  if (!code) return 2;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  try {
    const digits = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits;
    return typeof digits === 'number' ? digits : 2;
  } catch {
    return 2;
  }
}

/**
 * The factor that turns minor units of `from` into minor units of `to` at `rate` (major `to` per major `from`):
 * rate × 10^(digits(to) − digits(from)). The same currency, or two of the same digits, is the rate itself.
 */
export function minorUnitRate(rate: number, from?: string | null, to?: string | null): number {
  const r = Number.isFinite(rate) && rate > 0 ? rate : 1;
  const shift = currencyDigits(to) - currencyDigits(from);
  return shift === 0 ? r : r * 10 ** shift;
}

/** Minor units of `from` converted to minor units of `to`, rounded half away from zero to a whole unit. */
export function convertMinorUnits(amount: number, rate: number, from?: string | null, to?: string | null): number {
  const value = (Number(amount) || 0) * minorUnitRate(rate, from, to);
  return Math.sign(value) * Math.round(Math.abs(value) + 1e-9);
}

/** Minor units as major units for an input field (¥1,000 → 1000; KWD 12.345 → 12.345; $12.30 → 12.3). */
export function minorToMajor(amount: number, currency?: string | null): number {
  return (Number(amount) || 0) / 10 ** currencyDigits(currency);
}

/** The step of an amount field: 1 for yen, 0.001 for dinars, 0.01 otherwise. */
export function amountStep(currency?: string | null): string {
  const digits = currencyDigits(currency);
  return digits === 0 ? '1' : (1 / 10 ** digits).toFixed(digits);
}
