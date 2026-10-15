/** Currency-aware export of integer minor units; never round through floating point. */
import { getCurrencyFractionDigits } from './utils';

export function paymentMethodCsvAmount(minorUnits: number, currency: string): string {
  if (!Number.isSafeInteger(minorUnits)) throw new Error('Unsafe payment total cannot be exported.');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Invalid payment currency.');
  const digits = getCurrencyFractionDigits(currency);
  const divisor = 10n ** BigInt(digits);
  const raw = BigInt(minorUnits);
  const absolute = raw < 0n ? -raw : raw;
  const major = absolute / divisor;
  const fractional = absolute % divisor;
  const sign = raw < 0n ? '-' : '';
  return digits ? `${sign}${major}.${fractional.toString().padStart(digits, '0')}` : `${sign}${major}`;
}
