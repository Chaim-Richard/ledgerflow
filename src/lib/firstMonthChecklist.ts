export type FirstMonthStepId =
  | 'bank'
  | 'opening-balances'
  | 'first-invoice'
  | 'first-reconciliation'
  | 'first-vat-report';

export interface FirstMonthSignals {
  hasBankActivity: boolean;
  hasOpeningBalance: boolean;
  hasIssuedInvoice: boolean;
  hasReconciledStatement: boolean;
  hasTaxSetupOrReturn: boolean;
}

export interface FirstMonthStep {
  id: FirstMonthStepId;
  order: number;
  titleEn: string;
  titleHe: string;
  summaryEn: string;
  summaryHe: string;
  target: { tab: string; sub?: string };
  actionLabelEn: string;
  actionLabelHe: string;
  detectedDone: boolean;
  manualDone: boolean;
  done: boolean;
}

interface FirstMonthStepSpec {
  id: FirstMonthStepId;
  order: number;
  titleEn: string;
  titleHe: string;
  summaryEn: string;
  summaryHe: string;
  target: { tab: string; sub?: string };
  actionLabelEn: string;
  actionLabelHe: string;
  signal: keyof FirstMonthSignals;
}

const STEP_SPECS: readonly FirstMonthStepSpec[] = [
  {
    id: 'bank',
    order: 1,
    titleEn: 'Connect bank or import a statement',
    titleHe: 'חיבור חשבון בנק או ייבוא דף חשבון',
    summaryEn: 'Link a live feed or import a CSV / OFX / QFX bank statement for the month.',
    summaryHe: 'חברו הזנת בנק או ייבאו קובץ דף חשבון (CSV / OFX / QFX) לחודש הראשון.',
    target: { tab: 'banking' },
    actionLabelEn: 'Open Banking',
    actionLabelHe: 'פתיחת בנקאות',
    signal: 'hasBankActivity',
  },
  {
    id: 'opening-balances',
    order: 2,
    titleEn: 'Record opening balances',
    titleHe: 'רישום יתרות פתיחה',
    summaryEn: 'Enter starting bank, receivable, and payable balances against Opening Balance Equity.',
    summaryHe: 'הזינו יתרות פתיחה לבנק, לקוחות וספקים מול חשבון יתרת פתיחה מאוזן.',
    target: { tab: 'transactions' },
    actionLabelEn: 'Open Transactions',
    actionLabelHe: 'פתיחת תנועות יומן',
    signal: 'hasOpeningBalance',
  },
  {
    id: 'first-invoice',
    order: 3,
    titleEn: 'Send the first customer invoice',
    titleHe: 'הפקת חשבונית ראשונה ללקוח',
    summaryEn: 'Create and issue an invoice so revenue and accounts receivable post to the ledger.',
    summaryHe: 'צרו והפיקו חשבונית ראשונה כדי לרשום הכנסה וחוב לקוח בספרים.',
    target: { tab: 'sales' },
    actionLabelEn: 'Open Sales',
    actionLabelHe: 'פתיחת מכירות',
    signal: 'hasIssuedInvoice',
  },
  {
    id: 'first-reconciliation',
    order: 4,
    titleEn: 'Complete the first bank reconciliation',
    titleHe: 'השלמת התאמת בנק ראשונה',
    summaryEn: 'Match statement lines against posted entries until the difference is zero.',
    summaryHe: 'התאימו שורות דף בנק מול פקודות היומן עד להפרש אפס.',
    target: { tab: 'reconciliation' },
    actionLabelEn: 'Open Reconciliation',
    actionLabelHe: 'פתיחת התאמות',
    signal: 'hasReconciledStatement',
  },
  {
    id: 'first-vat-report',
    order: 5,
    titleEn: 'Review the first VAT or sales-tax report',
    titleHe: 'בדיקת דוח מע״מ או מס מכירות ראשון',
    summaryEn: 'Inspect calculation figures for the month before locking the period.',
    summaryHe: 'בדקו את נתוני החישוב לתקופה לפני סגירת החודש.',
    target: { tab: 'reports', sub: 'tax-liability' },
    actionLabelEn: 'Open Tax Report',
    actionLabelHe: 'פתיחת דוח מס',
    signal: 'hasTaxSetupOrReturn',
  },
];

export function firstMonthStorageKey(userId: string | null | undefined, workspaceId: string | null | undefined): string {
  return `lf_first_month_v1:${userId || 'guest'}:${workspaceId || 'default'}`;
}

export function loadFirstMonthManualState(
  userId: string | null | undefined,
  workspaceId: string | null | undefined,
): Partial<Record<FirstMonthStepId, boolean>> {
  try {
    const raw = localStorage.getItem(firstMonthStorageKey(userId, workspaceId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Partial<Record<FirstMonthStepId, boolean>> = {};
    for (const spec of STEP_SPECS) {
      const val = (parsed as Record<string, unknown>)[spec.id];
      if (typeof val === 'boolean') out[spec.id] = val;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveFirstMonthStep(
  userId: string | null | undefined,
  workspaceId: string | null | undefined,
  stepId: FirstMonthStepId,
  done: boolean,
): Partial<Record<FirstMonthStepId, boolean>> {
  const current = loadFirstMonthManualState(userId, workspaceId);
  const next: Partial<Record<FirstMonthStepId, boolean>> = { ...current, [stepId]: done };
  try {
    localStorage.setItem(firstMonthStorageKey(userId, workspaceId), JSON.stringify(next));
  } catch {
    // ignore storage quota errors
  }
  return next;
}

export function evaluateFirstMonthChecklist(
  signals: FirstMonthSignals,
  manual: Partial<Record<FirstMonthStepId, boolean>>,
): { steps: FirstMonthStep[]; completedCount: number; totalCount: number } {
  const steps: FirstMonthStep[] = STEP_SPECS.map(spec => {
    const detectedDone = Boolean(signals[spec.signal]);
    const manualDone = Boolean(manual[spec.id]);
    return {
      id: spec.id,
      order: spec.order,
      titleEn: spec.titleEn,
      titleHe: spec.titleHe,
      summaryEn: spec.summaryEn,
      summaryHe: spec.summaryHe,
      target: spec.target,
      actionLabelEn: spec.actionLabelEn,
      actionLabelHe: spec.actionLabelHe,
      detectedDone,
      manualDone,
      done: detectedDone || manualDone,
    };
  });
  return {
    steps,
    completedCount: steps.filter(step => step.done).length,
    totalCount: steps.length,
  };
}
