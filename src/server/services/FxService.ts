import axios from 'axios';

export interface ExchangeRateResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export class FxService {
  private static cache: Record<string, { rate: number, expires: number }> = {};
  private static CACHE_TTL = 1000 * 60 * 60; // 1 hour

  private static normalizeCurrencyCode(input: string, fieldName: string): string {
    const normalized = (input || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized)) {
      throw new Error(`Invalid currency code for ${fieldName}`);
    }
    return normalized;
  }

  /**
   * Fetches the latest exchange rate for a given currency pair.
   * Throws when the rate service can't be reached (never a guessed rate).
   */
  static async getRate(from: string, to: string): Promise<number> {
    const safeFrom = this.normalizeCurrencyCode(from, 'from');
    const safeTo = this.normalizeCurrencyCode(to, 'to');
    if (safeFrom === safeTo) return 1.0;
    
    const cacheKey = `${safeFrom}_${safeTo}`;
    const cached = this.cache[cacheKey];
    if (cached && cached.expires > Date.now()) {
      return cached.rate;
    }

    try {
      // For demonstration/audit purposes, we'll try to fetch from a public endpoint
      // If you have a real API key, you should set it in .env and use it here
      const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${safeFrom}`);
      const rates = response.data.rates;
      const rate = rates[safeTo];

      if (rate) {
        this.cache[cacheKey] = {
          rate,
          expires: Date.now() + this.CACHE_TTL
        };
        return rate;
      }
    } catch {
      // fall through to the error below
    }

    // no made-up rates when the rate service can't be reached: an invented rate would end up in
    // the books (L-187)
    throw new Error(`The exchange rate ${safeFrom} → ${safeTo} is not available right now`);
  }

  /**
   * Batch fetch rates for revaluation
   */
  static async getRatesForBase(base: string): Promise<Record<string, number>> {
    const safeBase = this.normalizeCurrencyCode(base, 'base');
    try {
      const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${safeBase}`);
      return response.data.rates;
    } catch {
      throw new Error(`Exchange rates for ${safeBase} are not available right now`);
    }
  }
}
