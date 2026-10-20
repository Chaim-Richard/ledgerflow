import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Circle, Mail } from 'lucide-react';
import { useLedgerCollections } from '../../hooks/useLedgerCollections';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { useUIStore } from '../../stores/useUIStore';
import {
  evaluateFirstMonthChecklist,
  type FirstMonthStepId,
  loadFirstMonthManualState,
  saveFirstMonthStep,
} from '../../lib/firstMonthChecklist';
import { buildOnboardingEmails, type OnboardingEmailDay } from '../../lib/onboardingEmails';

export default function FirstMonthOnboardingHub() {
  useLedgerCollections('invoices', 'bills', 'bankLines', 'taxRates');
  const user = useAuthStore(s => s.user);
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const currentWorkspace = useAuthStore(s => s.getCurrentWorkspace());
  const goToPage = useUIStore(s => s.goToPage);

  const accounts = useLedgerStore(s => s.accounts);
  const transactions = useLedgerStore(s => s.transactions);
  const invoices = useLedgerStore(s => s.invoices);
  const bankLines = useLedgerStore(s => s.bankLines);
  const reconciliations = useLedgerStore(s => s.reconciliations);
  const taxRates = useLedgerStore(s => s.taxRates);

  const [language, setLanguage] = useState<'en' | 'he'>('en');
  const [manual, setManual] = useState(() =>
    loadFirstMonthManualState(user?.uid, currentWorkspaceId),
  );
  const [selectedDay, setSelectedDay] = useState<OnboardingEmailDay>(1);

  const evaluation = useMemo(
    () =>
      evaluateFirstMonthChecklist(
        {
          hasBankActivity: bankLines.length > 0,
          hasOpeningBalance: accounts.length >= 2 && transactions.length > 0,
          hasIssuedInvoice: invoices.some(inv => inv.status !== 'draft' && inv.status !== 'void'),
          hasReconciledStatement: reconciliations.length > 0,
          hasTaxSetupOrReturn: taxRates.length > 0,
        },
        manual,
      ),
    [bankLines.length, accounts.length, transactions.length, invoices, reconciliations.length, taxRates.length, manual],
  );

  const emails = useMemo(
    () =>
      buildOnboardingEmails({
        ownerName: user?.email?.split('@')[0] || 'Owner',
        workspaceName: currentWorkspace?.name || 'Your Workspace',
        appOrigin: typeof window !== 'undefined' ? window.location.origin : 'https://app.ledgerflow.example',
      }),
    [user?.email, currentWorkspace?.name],
  );

  const activeEmail = emails.find(template => template.day === selectedDay) ?? emails[0];

  const handleToggleManual = (stepId: FirstMonthStepId, currentlyManual: boolean) => {
    const next = saveFirstMonthStep(user?.uid, currentWorkspaceId, stepId, !currentlyManual);
    setManual(next);
  };

  return (
    <div dir={language === 'he' ? 'rtl' : 'ltr'} className="space-y-6">
      <section
        aria-labelledby="first-month-checklist-heading"
        className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="first-month-checklist-heading" className="text-base font-bold text-[var(--text)]">
              {language === 'he' ? 'רשימת 30 הימים הראשונים בעסק' : 'First-Month Checklist'}
            </h3>
            <p className="text-sm text-[var(--muted)] mt-0.5">
              {language === 'he'
                ? `${evaluation.completedCount} מתוך ${evaluation.totalCount} שלבים הושלמו בספרים אלה`
                : `${evaluation.completedCount} of ${evaluation.totalCount} first-month milestones completed`}
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-[var(--line)] overflow-hidden" role="group" aria-label="First month checklist language">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              aria-pressed={language === 'en'}
              className={`min-h-11 px-3 text-xs font-medium ${language === 'en' ? 'bg-[var(--text)] text-[var(--bg)]' : 'bg-[var(--surface)] text-[var(--text)]'}`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLanguage('he')}
              aria-pressed={language === 'he'}
              className={`min-h-11 px-3 text-xs font-medium ${language === 'he' ? 'bg-[var(--text)] text-[var(--bg)]' : 'bg-[var(--surface)] text-[var(--text)]'}`}
            >
              עברית
            </button>
          </div>
        </div>

        <ol className="divide-y divide-[var(--line)]">
          {evaluation.steps.map(step => (
            <li key={step.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3 max-w-xl">
                <button
                  type="button"
                  onClick={() => handleToggleManual(step.id, step.manualDone)}
                  aria-label={`Mark ${step.titleEn} complete`}
                  aria-pressed={step.manualDone}
                  className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] shrink-0"
                >
                  {step.done ? (
                    <CheckCircle2 className="w-5 h-5 text-[var(--pos)]" aria-hidden="true" />
                  ) : (
                    <Circle className="w-5 h-5 text-[var(--muted)]" aria-hidden="true" />
                  )}
                </button>
                <div>
                  <div className="font-semibold text-sm text-[var(--text)]">
                    {language === 'he' ? step.titleHe : step.titleEn}
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {language === 'he' ? step.summaryHe : step.summaryEn}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => goToPage({ tab: step.target.tab, ...(step.target.sub ? { sub: step.target.sub } : {}) })}
                className="btn-secondary min-h-11 px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
              >
                {language === 'he' ? step.actionLabelHe : step.actionLabelEn}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="onboarding-emails-heading"
        className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="onboarding-emails-heading" className="text-base font-bold text-[var(--text)] flex items-center gap-2">
              <Mail className="w-4 h-4 text-[var(--brass)]" aria-hidden="true" />
              {language === 'he'
                ? 'תצוגה מקדימה: הודעות היכרות ליום 1, יום 3 ויום 7'
                : 'Owner Onboarding Email Templates (Day 1 · Day 3 · Day 7)'}
            </h3>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {language === 'he'
                ? 'תבניות דו-לשוניות מוכנות לחיבור לשרת הדוא״ל — מוצגות כאן לתצוגה ובדיקה מקומית.'
                : 'Plain-language template previews with direct deep links (server mail scheduling wired separately).'}
            </p>
          </div>
          <div className="flex gap-1.5" role="group" aria-label="Onboarding email day">
            {([1, 3, 7] as const).map(day => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                aria-pressed={selectedDay === day}
                className={`min-h-11 px-3 rounded-lg text-xs font-semibold border ${
                  selectedDay === day
                    ? 'bg-[var(--text)] text-[var(--bg)] border-[var(--text)]'
                    : 'bg-[var(--surface)] text-[var(--text)] border-[var(--line)]'
                }`}
              >
                {language === 'he' ? `יום ${day}` : `Day ${day}`}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 space-y-2 text-xs">
          <div className="font-semibold text-sm text-[var(--text)]">
            {language === 'he' ? activeEmail.subjectHe : activeEmail.subjectEn}
          </div>
          <pre className="whitespace-pre-wrap font-sans text-xs text-[var(--text)] leading-relaxed pt-2 border-t border-[var(--line)]">
            {language === 'he' ? activeEmail.plainTextHe : activeEmail.plainTextEn}
          </pre>
        </div>
      </section>
    </div>
  );
}
