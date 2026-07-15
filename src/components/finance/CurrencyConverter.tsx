import { motion } from 'motion/react';
import { X } from 'lucide-react';
import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';

interface CurrencyConverterProps {
  isOpen?: boolean;
  onClose?: () => void;
  baseCurrency?: string;
}

export default function CurrencyConverter({ isOpen, onClose, baseCurrency }: CurrencyConverterProps) {
  const language = useUIStore(s => s.language);
  const [amount, setAmount] = useState<number>(100);
  const [fromCurrency, setFromCurrency] = useState<string>('USD');
  const [toCurrency, setToCurrency] = useState<string>('EUR');
  
  const exchangeRates: Record<string, number> = {
    'USD': 1.0,
    'EUR': 0.92,
    'GBP': 0.79,
    'ILS': 3.75,
    'JPY': 151.2,
    'AUD': 1.54,
    'CAD': 1.36
  };

  const calculateConversion = () => {
    const amountInUsd = amount / (exchangeRates[fromCurrency] || 1);
    return (amountInUsd * (exchangeRates[toCurrency] || 1)).toFixed(2);
  };

  const innerContent = (
    <div className="p-6 w-full max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'המרת מטבעות' : 'Currency Converter'}
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {language === 'he' ? 'סכום' : 'Amount'}
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'ממטבע' : 'From'}
            </label>
            <select
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            >
              {Object.keys(exchangeRates).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {language === 'he' ? 'למטבע' : 'To'}
            </label>
            <select
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
            >
              {Object.keys(exchangeRates).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
            {language === 'he' ? 'תוצאה' : 'Converted Amount'}
          </p>
          <div className="text-3xl font-medium text-slate-900 dark:text-white">
            {calculateConversion()} {toCurrency}
          </div>
        </div>
      </div>
    </div>
  );

  if (isOpen !== undefined) {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden"
        >
          {onClose && (
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors z-10"
            >
              <X size={20} />
            </button>
          )}
          {innerContent}
        </motion.div>
      </div>
    );
  }

  return innerContent;
}
