import React, { useState } from 'react';
import { Building2, UploadCloud, PieChart, Sparkles, Plus, ArrowRight, Play, ServerCog, Layers } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { SYSTEM_GLOSSARY } from '../../config/registry';
import { toast } from 'sonner';

export default function OnboardingView() {
  const setQuickEntryOpen = useUIStore(s => s.setQuickEntryOpen);
  const setTemplateSelectorOpen = useUIStore(s => s.setTemplateSelectorOpen);
  const setActiveTab = useUIStore(s => s.setActiveTab);
  const language = useUIStore(s => s.language) as 'en' | 'he';
  
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  // Helper for translated terms with fallbacks
  const t = (key: string, defaultVal: string) => {
    return SYSTEM_GLOSSARY[key]?.[language] || defaultVal;
  };

  const loadDemoData = () => {
    setIsDemoLoading(true);
    toast.promise(new Promise(resolve => setTimeout(resolve, 2500)), {
      loading: language === 'he' ? 'טוען סביבת הדגמה...' : 'Synthesizing demo data matrix...',
      success: language === 'he' ? 'סביבת ההדגמה נטענה בהצלחה.' : 'Demo environment fully populated.',
      error: language === 'he' ? 'שגיאה בטעינת נתוני הדגמה.' : 'Failed to load demo.'
    });
    setTimeout(() => {
      setIsDemoLoading(false);
      setActiveTab('dashboard');
    }, 2500);
  };

  return (
    <div className="flex-1 bg-[var(--surface)] text-[var(--text)] flex flex-col items-center justify-center p-6 min-h-[100dvh]">
      <div className="max-w-3xl w-full text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        {/* Hero */}
        <div className="space-y-4">
          <div className="w-16 h-16 bg-gradient-to-br from-[var(--brass)] to-[#e5be6b] rounded-2xl mx-auto flex items-center justify-center shadow-lg">
            <ServerCog className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text)] font-display">
            {t('dashboard.welcome.title', 'Your Ledger is Ready.')}
          </h1>
          <p className="text-base text-[var(--muted)] max-w-lg mx-auto">
            {t('dashboard.welcome.subtitle', 'The mathematical engine is online. Complete these quick steps to set up your chart of accounts and start tracking finances.')}
          </p>
        </div>

        {/* Steps */}
        <div className="grid sm:grid-cols-4 gap-4 text-left max-w-3xl mx-auto mt-10">
          
          <button 
            type="button"
            className="bg-[var(--panel)] border border-[var(--brass-line)]/60 rounded-2xl p-4 hover:border-[var(--brass)] transition-all group text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--brass)]" 
            onClick={() => setTemplateSelectorOpen(true)}
          >
            <div className="w-9 h-9 bg-[var(--brass)]/10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Layers className="w-4 h-4 text-[var(--brass)]" />
            </div>
            <h3 className="font-bold text-xs uppercase tracking-wider mb-1 text-[var(--text)]">
              1. {t('dashboard.onboarding.step1.title', 'Select Chart Template')}
            </h3>
            <p className="text-[11px] text-[var(--muted)] leading-relaxed">
              {t('dashboard.onboarding.step1.desc', 'Seed 200+ industry accounts for SaaS, E-Commerce, Consulting, or Real Estate.')}
            </p>
          </button>

          <button 
            type="button"
            className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-4 hover:border-[var(--brass-line)] transition-all group text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--brass)]" 
            onClick={() => setActiveTab('banking')}
          >
            <div className="w-9 h-9 bg-[var(--elevated)] rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <UploadCloud className="w-4 h-4 text-indigo-500" />
            </div>
            <h3 className="font-bold text-xs uppercase tracking-wider mb-1 text-[var(--text)]">
              2. {t('dashboard.onboarding.step2.title', 'Import History')}
            </h3>
            <p className="text-[11px] text-[var(--muted)] leading-relaxed">
              {t('dashboard.onboarding.step2.desc', 'Connect bank lines or upload CSV statements to populate transaction history.')}
            </p>
          </button>

          <button 
            type="button"
            className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-4 hover:border-[var(--brass-line)] transition-all group text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--brass)]" 
            onClick={() => setActiveTab('reconciliation')}
          >
            <div className="w-9 h-9 bg-[var(--elevated)] rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <h3 className="font-bold text-xs uppercase tracking-wider mb-1 text-[var(--text)]">
              3. {language === 'he' ? 'אימון התאמות AI' : '3. Train AI Matching'}
            </h3>
            <p className="text-[11px] text-[var(--muted)] leading-relaxed">
              {language === 'he' ? 'בדיקת סיווגים. שכבת הבינה לומדת כללים באופן אוטומטי.' : 'Review categorizations. The intelligence layer learns rules automatically.'}
            </p>
          </button>

          <button 
            type="button"
            className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-4 hover:border-[var(--brass-line)] transition-all group text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--brass)]" 
            onClick={() => setActiveTab('reports')}
          >
            <div className="w-9 h-9 bg-[var(--elevated)] rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <PieChart className="w-4 h-4 text-emerald-500" />
            </div>
            <h3 className="font-bold text-xs uppercase tracking-wider mb-1 text-[var(--text)]">
              4. {t('dashboard.onboarding.step3.title', 'Financial Statements')}
            </h3>
            <p className="text-[11px] text-[var(--muted)] leading-relaxed">
              {t('dashboard.onboarding.step3.desc', 'Generate instant P&L, Balance Sheets, and Cash Flow statements.')}
            </p>
          </button>
          
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-12 pt-8 border-t border-[var(--line)] max-w-2xl mx-auto">
          <button 
            type="button"
            onClick={() => setQuickEntryOpen(true)}
            className="w-full sm:w-auto px-6 py-3 bg-[var(--brass)] text-black font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {language === 'he' ? 'רישום תנועה ראשונה ידנית' : 'Record First Entry Manually'}
          </button>
          
          <span className="text-[var(--faint)] font-mono text-xs uppercase tracking-widest hidden sm:inline-block">
            {language === 'he' ? 'או' : 'or'}
          </span>
          
          <button 
            type="button"
            onClick={loadDemoData}
            disabled={isDemoLoading}
            className="w-full sm:w-auto px-6 py-3 bg-[var(--elevated)] border border-[var(--line)] text-[var(--text)] font-medium rounded-xl hover:bg-[var(--line)] transition-colors flex items-center justify-center gap-2 cursor-pointer"
           aria-label=") : ( <> )}">
            {isDemoLoading ? (
              <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 animate-pulse text-[var(--brass)]" /> {language === 'he' ? 'טוען סביבה...' : 'Loading Matrix...'}</span>
            ) : (
              <><Play className="w-4 h-4 text-emerald-500" /> {language === 'he' ? 'חקור נתוני הדגמה' : 'Explore with Sample Data'}</>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
