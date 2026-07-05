import { FxRate, CurrencyEngine } from '../kernel/fx/CurrencyEngine';

export class FxService {
  /**
   * Translates a transaction amount.
   */
  static translateAmount(amountCents: number, rate: FxRate): number {
    return CurrencyEngine.convert(amountCents, rate);
  }
}
