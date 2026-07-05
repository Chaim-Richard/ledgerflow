import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

export default function LiquidityCalculator() {
  const language = useUIStore(s => s.language);
  
  // Current Assets
  const [cash, setCash] = useState<number>(50000);
  const [marketableSecurities, setMarketableSecurities] = useState<number>(20000);
  const [accountsReceivable, setAccountsReceivable] = useState<number>(80000);
  const [inventory, setInventory] = useState<number>(100000);
  
  // Current Liabilities
  const [accountsPayable, setAccountsPayable] = useState<number>(75000);
  const [shortTermDebt, setShortTermDebt] = useState<number>(50000);

  const calculateRatios = () => {
    const currentAssets = cash + marketableSecurities + accountsReceivable + inventory;
    const quickAssets = cash + marketableSecurities + accountsReceivable;
    const currentLiabilities = accountsPayable + shortTermDebt;

    const currentRatio = currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
    const quickRatio = currentLiabilities > 0 ? quickAssets / currentLiabilities : 0;
    const cashRatio = currentLiabilities > 0 ? cash / currentLiabilities : 0;

    return {
      currentAssets,
      currentLiabilities,
      currentRatio: currentRatio.toFixed(2),
      quickRatio: quickRatio.toFixed(2),
      cashRatio: cashRatio.toFixed(2)
    };
  };

  const results = calculateRatios();

  return (
    <div className="p-6 max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'יחסי נזילות (Liquidity Ratios)' : 'Liquidity Ratios Calculator'}
      </h2>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-3 border-b border-slate-200 dark:border-slate-800 pb-1">
            {language === 'he' ? 'נכסים שוטפים (Current Assets)' : 'Current Assets'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'מזומן ושווי מזומן' : 'Cash & Equivalents'}
              </label>
              <input type="number" value={cash} onChange={(e) => setCash(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'ניירות ערך סחירים' : 'Marketable Securities'}
              </label>
              <input type="number" value={marketableSecurities} onChange={(e) => setMarketableSecurities(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'לקוחות (חייבים)' : 'Accounts Receivable'}
              </label>
              <input type="number" value={accountsReceivable} onChange={(e) => setAccountsReceivable(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'מלאי' : 'Inventory'}
              </label>
              <input type="number" value={inventory} onChange={(e) => setInventory(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-rose-700 dark:text-rose-400 mb-3 border-b border-slate-200 dark:border-slate-800 pb-1">
            {language === 'he' ? 'התחייבויות שוטפות' : 'Current Liabilities'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'ספקים (זכאים)' : 'Accounts Payable'}
              </label>
              <input type="number" value={accountsPayable} onChange={(e) => setAccountsPayable(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                {language === 'he' ? 'חוב לזמן קצר' : 'Short-Term Debt'}
              </label>
              <input type="number" value={shortTermDebt} onChange={(e) => setShortTermDebt(Number(e.target.value))} className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 mt-2">
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1" title={language === 'he' ? 'נכסים שוטפים חלקי התחייבויות שוטפות' : 'Current Assets / Current Liabilities'}>
            {language === 'he' ? 'יחס שוטף (Current)' : 'Current Ratio'}
          </p>
          <div className={`text-2xl font-bold ${Number(results.currentRatio) >= 1 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {results.currentRatio}
          </div>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1" title={language === 'he' ? '(נכסים שוטפים - מלאי) חלקי התחייבויות שוטפות' : '(Current Assets - Inventory) / Current Liabilities'}>
            {language === 'he' ? 'יחס מהיר (Quick)' : 'Quick Ratio'}
          </p>
          <div className={`text-2xl font-bold ${Number(results.quickRatio) >= 1 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {results.quickRatio}
          </div>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1" title={language === 'he' ? 'מזומן חלקי התחייבויות שוטפות' : 'Cash / Current Liabilities'}>
            {language === 'he' ? 'יחס מזומן (Cash)' : 'Cash Ratio'}
          </p>
          <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
            {results.cashRatio}
          </div>
        </div>
      </div>
    </div>
  );
}
