import React, { useState } from 'react';
import { useUIStore } from '../../stores/useUIStore';
import { CheckSquare } from 'lucide-react';

export default function PiotroskiFScoreCalculator() {
  const language = useUIStore(s => s.language);
  
  const criteria = [
    { id: 'roa_pos', en: 'Positive ROA (Net Income > 0)', he: 'תשואה חיובית על נכסים (ROA)' },
    { id: 'cfo_pos', en: 'Positive Operating Cash Flow', he: 'תזרים מזומנים תפעולי חיובי' },
    { id: 'roa_increasing', en: 'ROA is higher than previous year', he: 'ROA גבוה משנה קודמת' },
    { id: 'cfo_gt_roa', en: 'Cash Flow from Ops > Net Income', he: 'תזרים תפעולי > רווח נקי' },
    { id: 'debt_decreasing', en: 'Long-term debt ratio decreased', he: 'יחס חוב לטווח ארוך ירד' },
    { id: 'current_ratio_inc', en: 'Current Ratio is higher than previous year', he: 'יחס שוטף גבוה משנה קודמת' },
    { id: 'shares_not_inc', en: 'No new shares issued', he: 'לא הונפקו מניות חדשות' },
    { id: 'gross_margin_inc', en: 'Gross Margin is higher than previous year', he: 'שולי רווח גולמי עלו' },
    { id: 'asset_turnover_inc', en: 'Asset Turnover is higher than previous year', he: 'מחזור נכסים עלה' }
  ];

  const [scores, setScores] = useState<Record<string, boolean>>(
    criteria.reduce((acc, c) => ({ ...acc, [c.id]: false }), {})
  );

  const toggleScore = (id: string) => {
    setScores(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const calculateScore = () => {
    const score = Object.values(scores).filter(Boolean).length;
    let status = '';
    let color = '';

    if (score >= 8) {
      status = language === 'he' ? 'חזק מאוד (Strong)' : 'Very Strong';
      color = 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 border-emerald-100';
    } else if (score >= 5) {
      status = language === 'he' ? 'בינוני / יציב (Typical)' : 'Typical / Average';
      color = 'text-amber-600 dark:text-amber-400 bg-amber-50 border-amber-100';
    } else {
      status = language === 'he' ? 'חלש (Weak)' : 'Weak';
      color = 'text-rose-600 dark:text-rose-400 bg-rose-50 border-rose-100';
    }

    return { score, status, color };
  };

  const results = calculateScore();

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
      <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-6">
        {language === 'he' ? 'ציון פיוטרוסקי (Piotroski F-Score)' : 'Piotroski F-Score'}
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        {language === 'he' ? 'ציון (0-9) המשקף את החוזק הפיננסי של החברה על בסיס 9 קריטריונים חשבונאיים.' : 'A number between 0-9 which is used to assess strength of company\'s financial position.'}
      </p>

      <div className="space-y-3 mb-6 max-h-64 overflow-y-auto pr-2">
        {criteria.map((c) => (
          <label 
            key={c.id} 
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              scores[c.id] 
                ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800/30' 
                : 'bg-white border-slate-200 dark:bg-slate-950 dark:border-slate-800'
            }`}
          >
            <div className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded border ${
              scores[c.id] 
                ? 'bg-emerald-500 border-emerald-500 text-white' 
                : 'border-slate-300 dark:border-slate-700'
            }`}>
              {scores[c.id] && <CheckSquare className="w-4 h-4" />}
            </div>
            <input 
              type="checkbox" 
              className="hidden" 
              checked={scores[c.id]} 
              onChange={() => toggleScore(c.id)} 
            />
            <span className={`text-sm ${scores[c.id] ? 'text-emerald-900 dark:text-emerald-400 font-medium' : 'text-slate-700 dark:text-slate-300'}`}>
              {language === 'he' ? c.he : c.en}
            </span>
          </label>
        ))}
      </div>

      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className={`p-4 rounded-xl border flex justify-between items-center ${results.color}`}>
          <div>
            <p className="text-sm font-medium mb-1 opacity-90">
              {language === 'he' ? 'ציון F (מתוך 9)' : 'F-Score (out of 9)'}
            </p>
            <p className="text-xs opacity-80">{results.status}</p>
          </div>
          <div className="text-4xl font-bold">
            {results.score}/9
          </div>
        </div>
      </div>
    </div>
  );
}
