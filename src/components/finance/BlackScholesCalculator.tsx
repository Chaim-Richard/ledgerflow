import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

// Helper functions for standard normal cumulative distribution function
function CND(x: number): number {
  const a1 = 0.31938153;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const L = Math.abs(x);
  const K = 1.0 / (1.0 + 0.2316419 * L);
  let res = 1.0 - 1.0 / Math.sqrt(2 * Math.PI) * Math.exp(-L * L / 2.0) * (a1 * K + a2 * K * K + a3 * Math.pow(K, 3) + a4 * Math.pow(K, 4) + a5 * Math.pow(K, 5));
  if (x < 0) {
    res = 1.0 - res;
  }
  return res;
}

export default function BlackScholesCalculator() {
  const language = useUIStore(s => s.language);
  const [stockPrice, setStockPrice] = useState<number>(100);
  const [strikePrice, setStrikePrice] = useState<number>(100);
  const [timeToMaturity, setTimeToMaturity] = useState<number>(1); // in years
  const [riskFreeRate, setRiskFreeRate] = useState<number>(5); // percentage
  const [volatility, setVolatility] = useState<number>(20); // percentage

  const calculateBlackScholes = () => {
    if (stockPrice <= 0 || strikePrice <= 0 || timeToMaturity <= 0 || volatility <= 0) {
      return { call: 0, put: 0 };
    }

    const S = stockPrice;
    const K = strikePrice;
    const T = timeToMaturity;
    const r = riskFreeRate / 100;
    const v = volatility / 100;

    const d1 = (Math.log(S / K) + (r + v * v / 2) * T) / (v * Math.sqrt(T));
    const d2 = d1 - v * Math.sqrt(T);

    const callPrice = S * CND(d1) - K * Math.exp(-r * T) * CND(d2);
    const putPrice = K * Math.exp(-r * T) * CND(-d2) - S * CND(-d1);

    return {
      call: callPrice.toFixed(2),
      put: putPrice.toFixed(2)
    };
  };

  const results = calculateBlackScholes();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'מודל בלאק ושולס לתמחור אופציות' : 'Black-Scholes Options Pricing'}
      </h2>

      <div className="grid gap-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מחיר נכס הבסיס' : 'Stock Price (S)'}
            </label>
            <input
              type="number"
              value={stockPrice}
              onChange={(e) => setStockPrice(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'מחיר מימוש' : 'Strike Price (K)'}
            </label>
            <input
              type="number"
              value={strikePrice}
              onChange={(e) => setStrikePrice(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'זמן לפקיעה (שנים)' : 'Time (Years)'}
            </label>
            <input
              type="number"
              value={timeToMaturity}
              onChange={(e) => setTimeToMaturity(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'ריבית (%)' : 'Risk-Free Rate (%)'}
            </label>
            <input
              type="number"
              value={riskFreeRate}
              onChange={(e) => setRiskFreeRate(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'תנודתיות (%)' : 'Volatility (%)'}
            </label>
            <input
              type="number"
              value={volatility}
              onChange={(e) => setVolatility(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-6 gap-x-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'מחיר אופציית רכש (Call)' : 'Call Option Price'}
          </p>
          <div className="text-3xl font-medium text-emerald-600 dark:text-emerald-400">
            ${results.call}
          </div>
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'מחיר אופציית מכר (Put)' : 'Put Option Price'}
          </p>
          <div className="text-3xl font-medium text-indigo-600 dark:text-indigo-400">
            ${results.put}
          </div>
        </div>
      </div>
    </div>
  );
}
