/**
 * Milestone billing (V-09): a schedule kept on a sales order (an accepted estimate), e.g. 30% on
 * signing, 40% halfway, 30% at the end, each with an optional date. Invoicing the next milestone
 * invoices that percentage of the order (K-04) and marks it done. The schedule changes nothing in
 * the books by itself.
 */
export interface Milestone {
  id: string;
  label: string;
  percent: number;
  due?: string;
  invoicedAt?: string;
}

export const MAX_MILESTONES = 20;

export function milestonesProblem(list: Milestone[]): string | null {
  if (list.length > MAX_MILESTONES) return `${MAX_MILESTONES} milestones at most`;
  let total = 0;
  for (const m of list) {
    if (!m.label.trim() || m.label.length > 80) return 'Each milestone needs a name (up to 80 characters)';
    if (!(m.percent > 0) || m.percent > 100 || Math.round(m.percent * 100) / 100 !== m.percent) return `"${m.label}": a percentage above 0, at most 100, two decimals at most`;
    if (m.due && !/^\d{4}-\d{2}-\d{2}$/.test(m.due)) return `"${m.label}": choose a date, or none`;
    total += m.percent;
  }
  if (Math.round(total * 100) > 10000) return `The milestones add up to ${Math.round(total * 100) / 100}%: at most 100%`;
  return null;
}

/** The first milestone not invoiced yet. */
export const nextMilestone = (list: Milestone[] | undefined) => (list || []).find(m => !m.invoicedAt);

/** Milestones not invoiced whose date has come (for the reminder on the list). */
export const dueMilestones = (list: Milestone[] | undefined, today: string) => (list || []).filter(m => !m.invoicedAt && m.due && m.due <= today);
