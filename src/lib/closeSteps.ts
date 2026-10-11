/**
 * A checklist per client (BD-10): the accountant's own month-end steps for one workspace ("Get the
 * payroll report from the client", "File the VAT return" at each quarter end), shown on Month-End
 * Close below the built-in checks. Each step due that month needs a sign-off, like a built-in item
 * that needs attention, before the month is ready to close. Owners and accountants keep the list
 * (saved by the server on the workspace); sign-offs are kept per month with the others (`step:<id>`).
 */
export type CloseStepFrequency = 'monthly' | 'quarterly' | 'yearly';

export interface CloseStep {
  id: string;
  title: string;
  frequency: CloseStepFrequency;
}

export const MAX_CLOSE_STEPS = 30;
export const STEP_PREFIX = 'step:';
export const STEP_ID = /^cs_[a-z0-9]{6,20}$/;

export const FREQUENCY_LABEL: Record<CloseStepFrequency, string> = {
  monthly: 'Every month',
  quarterly: 'At each quarter end',
  yearly: 'At the year end',
};

const FREQUENCIES = new Set<string>(Object.keys(FREQUENCY_LABEL));

/** What is wrong with a list of steps someone wants to save, or null. Ids may be missing (new steps). */
export function closeStepsProblem(steps: unknown): string | null {
  if (!Array.isArray(steps)) return 'The steps must be a list';
  if (steps.length > MAX_CLOSE_STEPS) return `At most ${MAX_CLOSE_STEPS} steps`;
  const titles = new Set<string>();
  const ids = new Set<string>();
  for (const raw of steps) {
    const step = (raw || {}) as Partial<CloseStep>;
    const title = typeof step.title === 'string' ? step.title.trim() : '';
    if (title.length < 2 || title.length > 120) return 'Each step needs a name of 2 to 120 characters';
    if (!FREQUENCIES.has(String(step.frequency))) return `"${title}": say how often it is due`;
    const key = title.toLocaleLowerCase();
    if (titles.has(key)) return `"${title}" is in the list twice`;
    titles.add(key);
    if (step.id !== undefined) {
      if (typeof step.id !== 'string' || !STEP_ID.test(step.id) || ids.has(step.id)) return 'A step has a bad id';
      ids.add(step.id);
    }
  }
  return null;
}

/** The months a step is due: every month, the last month of each fiscal quarter, or of the fiscal year. */
export function stepDue(step: Pick<CloseStep, 'frequency'>, month: string, fiscalYearStartMonth = 1): boolean {
  if (step.frequency === 'monthly') return true;
  const start = Math.min(Math.max(Math.trunc(fiscalYearStartMonth) || 1, 1), 12);
  const position = (Number(month.slice(5, 7)) - start + 12) % 12; // 0 = first month of the fiscal year
  return step.frequency === 'quarterly' ? position % 3 === 2 : position === 11;
}

export interface CloseStepItem {
  id: string;
  stepId: string;
  title: string;
  status: 'attention';
  detail: string;
  count: 0;
}

/** The steps due in the month, as checklist items that need a sign-off. */
export function closeStepItems(steps: CloseStep[] | undefined, month: string, fiscalYearStartMonth = 1): CloseStepItem[] {
  return (steps || []).filter(s => stepDue(s, month, fiscalYearStartMonth)).map(s => ({
    id: `${STEP_PREFIX}${s.id}`, stepId: s.id, title: s.title, status: 'attention' as const, count: 0 as const,
    detail: `This client's own step · ${FREQUENCY_LABEL[s.frequency].toLowerCase()}. Sign it off when it is done.`,
  }));
}
