/**
 * Time tracking (V-01 time entries, V-03 billable, V-04 rates, V-05 approval, V-06 time → invoice
 * lines). A person logs time on a day (what, for which customer or project, billable or not) and
 * submits it; an owner or accountant approves it (or sends it back); approved billable time becomes
 * the lines of a draft invoice for its customer. Nothing is posted until that invoice is.
 * Kept with the workspace's documents (kind "timeEntry", and one "timeRates"), written by the server
 * only (src/server/services/timeService.ts).
 */
export const TIME_KIND = 'timeEntry';
export const RATES_KIND = 'timeRates';
export const MAX_DESCRIPTION = 300;

export type TimeStatus = 'open' | 'submitted' | 'approved' | 'invoiced';

export interface TimeEntry {
  id: string;
  kind: typeof TIME_KIND;
  workspaceId: string;
  /** who did the work */
  person: string;
  date: string;
  minutes: number;
  description: string;
  customerId?: string;
  projectId?: string;
  billable: boolean;
  /** a rate for this entry only, in cents an hour (V-04: it wins over every other) */
  rateCents?: number;
  status: TimeStatus;
  note?: string;
  invoiceId?: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

/** V-04: hourly rates in cents by project, customer and person; the first one that applies is used. */
export interface TimeRates { projects?: Record<string, number>; customers?: Record<string, number>; people?: Record<string, number> }

export const STATUS_LABEL: Record<TimeStatus, string> = { open: 'Not submitted', submitted: 'Waiting for approval', approved: 'Approved', invoiced: 'Invoiced' };

/** "1:30", "1.5", "1,5", "90m" or "2h" into minutes; null when it is not a duration. */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase();
  let minutes: number;
  if (/^\d{1,2}:\d{2}$/.test(t)) { const [h, m] = t.split(':').map(Number); if (m >= 60) return null; minutes = h * 60 + m; }
  else if (/^\d+(?:[.,]\d+)?\s*h?$/.test(t)) minutes = Math.round(Number(t.replace(/h$/, '').trim().replace(',', '.')) * 60);
  else if (/^\d+\s*m$/.test(t)) minutes = Number(t.replace('m', '').trim());
  else return null;
  return minutes > 0 && minutes <= 24 * 60 ? minutes : null;
}

export const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;

/** The hourly rate that applies: the entry's own, else its project's, its customer's, its person's, else none. */
export function rateFor(entry: Pick<TimeEntry, 'rateCents' | 'projectId' | 'customerId' | 'person'>, rates: TimeRates | undefined): number {
  const pick = (map: Record<string, number> | undefined, key: string | undefined) => (key && map && Number.isSafeInteger(map[key]) ? map[key] : undefined);
  return entry.rateCents ?? pick(rates?.projects, entry.projectId) ?? pick(rates?.customers, entry.customerId) ?? pick(rates?.people, entry.person) ?? 0;
}

/** What the time is worth, whole cents (minutes × rate / 60, rounded once). */
export const entryValueCents = (entry: Pick<TimeEntry, 'minutes' | 'rateCents' | 'projectId' | 'customerId' | 'person'>, rates: TimeRates | undefined) => Math.round(entry.minutes * rateFor(entry, rates) / 60);

export interface TimeInput { date?: unknown; minutes?: unknown; description?: unknown; customerId?: unknown; projectId?: unknown; billable?: unknown; rateCents?: unknown }

export function timeProblem(input: TimeInput): string | null {
  if (typeof input.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Choose the day';
  if (typeof input.minutes !== 'number' || !Number.isSafeInteger(input.minutes) || input.minutes < 1 || input.minutes > 24 * 60) return 'How long: between 1 minute and 24 hours';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (description.length < 2 || description.length > MAX_DESCRIPTION) return `Say what was done (2 to ${MAX_DESCRIPTION} characters)`;
  for (const key of ['customerId', 'projectId'] as const) if (input[key] !== undefined && (typeof input[key] !== 'string' || (input[key] as string).length > 200)) return 'Choose the customer or project again';
  if (input.billable !== undefined && typeof input.billable !== 'boolean') return 'Billable is yes or no';
  if (input.rateCents !== undefined && (typeof input.rateCents !== 'number' || !Number.isSafeInteger(input.rateCents) || input.rateCents < 0)) return 'The rate is an amount an hour, 0 or more';
  if (input.billable === true && !input.customerId) return 'Billable time needs its customer';
  return null;
}

export function ratesProblem(rates: unknown): string | null {
  if (!rates || typeof rates !== 'object') return 'The rates must be a list';
  for (const key of ['projects', 'customers', 'people'] as const) {
    const map = (rates as Record<string, unknown>)[key];
    if (map === undefined) continue;
    if (!map || typeof map !== 'object' || Object.keys(map).length > 2000) return 'The rates must be a list';
    for (const v of Object.values(map)) if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) return 'Each rate is an amount an hour, 0 or more';
  }
  return null;
}

/** V-06: approved billable time not yet invoiced, as invoice lines (hours to two decimals, the rate, the amount). */
export function invoiceLinesFromTime(entries: TimeEntry[], rates: TimeRates | undefined) {
  return entries
    .filter(e => e.billable && e.status === 'approved' && !e.invoiceId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map(e => ({
      id: `time-${e.id}`,
      description: `${e.date} · ${e.description} (${formatDuration(e.minutes)} h)`,
      quantity: Math.round(e.minutes / 60 * 100) / 100,
      rateCents: rateFor(e, rates),
      amountCents: entryValueCents(e, rates),
      // no account picked: posting uses the workspace's income account
      accountId: '',
      metadata: { timeEntryId: e.id },
    }));
}
