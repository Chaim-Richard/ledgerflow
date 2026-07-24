import { motion } from 'motion/react';
import { X } from 'lucide-react';
import React, { useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { format } from 'date-fns';
import { useUIStore } from '../../stores/useUIStore';

import { useAuthStore } from '../../stores/useAuthStore';

interface CurrencyConverterProps {
  isOpen?: boolean;
  onClose?: () => void;
  baseCurrency?: string;
}

export default function CurrencyConverter({ isOpen, onClose, baseCurrency }: CurrencyConverterProps) {
  const getCurrentWorkspace = useAuthStore(s => s.getCurrentWorkspace);
  const activeWorkspace = getCurrentWorkspace();
  const [isRevaluing, setIsRevaluing] = useState(false);
  const [revalResult, setRevalResult] = useState('');

  const runRevaluation = async () => {
    if (!activeWorkspace) return;
    setIsRevaluing(true);
    setRevalResult('');
    try {
      const user = useAuthStore.getState().user;
      const token = user ? await user.getIdToken() : '';
      const response = await fetch(`/api/v1/transactions/revaluation/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId: activeWorkspace.id,
          targetCurrency: toCurrency
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to run revaluation');
      setRevalResult(data.message);
    } catch (e: any) {
      setRevalResult('Error: ' + e.message);
    } finally {
      setIsRevaluing(false);
    }
  };

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
    <div className="p-6 w-full max-w-xl mx-auto bg-[var(--surface)] dark:bg-slate-900 border border-[var(--line)] dark:border-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
      <h2 className="text-xl font-medium text-[var(--text)] dark:text-white mb-6">
        {language === 'he' ? 'המרת מטבעות' : 'Currency Converter'}
      </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--muted)] mb-1">
            {language === 'he' ? 'סכום' : 'Amount'}
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-lg text-sm text-[var(--text)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              {language === 'he' ? 'ממטבע' : 'From'}
            </label>
            <select
              value={fromCurrency}
              onChange={(e) => setFromCurrency(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-lg text-sm text-[var(--text)]"
            >
              {Object.keys(exchangeRates).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              {language === 'he' ? 'למטבע' : 'To'}
            </label>
            <select
              value={toCurrency}
              onChange={(e) => setToCurrency(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-lg text-sm text-[var(--text)]"
            >
              {Object.keys(exchangeRates).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--line)] mt-6">
          <p className="text-sm text-[var(--muted)] mb-1">
            {language === 'he' ? 'תוצאה' : 'Converted Amount'}
          </p>
          <div className="text-3xl font-medium text-[var(--text)]">
            {calculateConversion()} {toCurrency}
          </div>
        </div>
        <div className="pt-4 border-t border-[var(--line)] mt-6">
          <button 
            onClick={runRevaluation} 
            disabled={isRevaluing || !activeWorkspace}
            className="w-full px-4 py-2 bg-[var(--brass)] hover:opacity-90 text-black rounded-lg text-sm font-bold transition-colors cursor-pointer"
          >
            {isRevaluing ? 'Processing...' : (language === 'he' ? 'הפעל שערוך סוף חודש (API)' : 'Run Month-End Revaluation (API)')}
          </button>
          {revalResult && (
            <div className="mt-3 text-sm text-[var(--text)] p-3 bg-[var(--ink)] rounded border border-[var(--line)]">
              {revalResult}
            </div>
          )}
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
          className="relative w-full max-w-xl bg-[var(--surface)] dark:bg-slate-900 rounded-2xl shadow-xl border border-[var(--line)] dark:border-slate-800 overflow-hidden"
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
