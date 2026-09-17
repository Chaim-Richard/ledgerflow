import axios from 'axios';

export interface ExchangeRateResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export class FxService {
  private static cache: Record<string, { rate: number, expires: number }> = {};
  private static CACHE_TTL = 1000 * 60 * 60; // 1 hour

  /**
   * Fetches the latest exchange rate for a given currency pair.
   * In a real environment, this would call a reliable API like fixer.io or openexchangerates.org.
   * For this implementation, we use a fallback to ensure system stability if API is unavailable.
   */
  static async getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1.0;
    
    const cacheKey = `${from}_${to}`;
    const cached = this.cache[cacheKey];
    if (cached && cached.expires > Date.now()) {
      return cached.rate;
    }

    try {
      // For demonstration/audit purposes, we'll try to fetch from a public endpoint
      // If you have a real API key, you should set it in .env and use it here
      const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from}`);
      const rates = response.data.rates;
      const rate = rates[to];

      if (rate) {
        this.cache[cacheKey] = {
          rate,
          expires: Date.now() + this.CACHE_TTL
        };
        return rate;
      }
    } catch (error) {
      console.warn(`FX Service: Failed to fetch live rate for ${from}->${to}. Falling back to defaults.`);
    }

    // Static fallbacks if API fails
    const fallbacks: Record<string, Record<string, number>> = {
      'USD': { 'EUR': 0.92, 'GBP': 0.79, 'ILS': 3.75, 'JPY': 151.2, 'CAD': 1.36, 'AUD': 1.54 },
      'EUR': { 'USD': 1.09, 'GBP': 0.86, 'ILS': 4.08 },
      'GBP': { 'USD': 1.27, 'EUR': 1.16, 'ILS': 4.75 }
    };

    return fallbacks[from]?.[to] || 1.0;
  }

  /**
   * Batch fetch rates for revaluation
   */
  static async getRatesForBase(base: string): Promise<Record<string, number>> {
    try {
      const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${base}`);
      return response.data.rates;
    } catch (error) {
      console.warn(`FX Service: Batch fetch failed for ${base}.`);
      return { [base]: 1.0 };
    }
  }
}
