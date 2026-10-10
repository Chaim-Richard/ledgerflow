/**
 * The product tour (P-08): a short first-run tour of the basics only (the overview, money in, money
 * out, the bank, reports, and the search box). Screens of modules a new workspace doesn't use yet
 * (stock, projects, payroll) are not in it (BB-07). It can be skipped, is remembered per person in
 * this browser, and can be taken again from Help.
 */
import type { PinnedPage } from './pinnedPages';

export interface TourStep { id: string; title: string; text: string; page?: PinnedPage }

export const TOUR_STEPS: TourStep[] = [
  { id: 'overview', title: 'The overview', text: 'Start here each day: "Needs attention" lists what is waiting (bank lines, approvals, questions, last month\'s close), and each row opens the right place.', page: { tab: 'dashboard' } },
  { id: 'sales', title: 'Money in', text: 'Sales holds your invoices and the payments received against them. An invoice posts to the books when it is saved, not before.', page: { tab: 'sales' } },
  { id: 'purchases', title: 'Money out', text: 'Purchases holds your bills and what you paid. A bill can carry labels (a property, a project) and the stock it bought.', page: { tab: 'purchases' } },
  { id: 'bank', title: 'The bank', text: 'Reconcile matches each line from the bank to an entry. Import a statement, or connect the bank under Bank Connections.', page: { tab: 'reconciliation' } },
  { id: 'reports', title: 'Reports', text: 'Profit and loss, balance sheet, trial balance and more. Click any figure to see the entries behind it; they add up to it.', page: { tab: 'reports' } },
  { id: 'search', title: 'Find anything', text: 'Press Ctrl+K (⌘K on a Mac) to open any screen, record or setting by typing part of its name. Settings → Modules turns on more screens when you need them.' },
];

export const TOUR_EVENT = 'lf:start-tour';

const key = (uid: string) => `lf_tour_done_${uid}`;

/** Whether this person finished or skipped the tour in this browser (unknown storage: treated as done, so it never nags). */
export function tourDone(uid: string): boolean {
  try { return window.localStorage.getItem(key(uid)) === '1'; } catch { return true; }
}

export function markTourDone(uid: string): void {
  try { window.localStorage.setItem(key(uid), '1'); } catch { /* private mode: it shows again next time */ }
}

/** Open the tour from anywhere (Help → Take the tour). */
export const startTour = () => window.dispatchEvent(new window.Event(TOUR_EVENT));
