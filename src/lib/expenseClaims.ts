/**
 * Expense claims (K-22): someone paid for the business out of their own pocket and asks to be paid
 * back. A claim is a bill owed to that person (a vendor of type "employee"), so approving posts it
 * like any bill and paying it is a bill payment (or a payment run). While it waits for approval it is
 * a draft: nothing is in the books. Owners and accountants decide; nobody approves their own claim
 * except the owner (a business of one).
 */

export type ClaimState = 'submitted' | 'approved' | 'rejected';

export interface ClaimRecord {
  state: ClaimState;
  submittedBy: string;
  submittedByName?: string;
  submittedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  reason?: string;
}

export interface ClaimLine { description: string; accountId: string; amountCents: number }

/**
 * Mileage and per diem (BE-09, BE-10): two more kinds of claim line, worked out from what the person
 * types; the rate is theirs (or their organisation's), never a made-up default. Each becomes an
 * ordinary claim line whose description says how its amount was reached.
 */
export type ClaimLineKind = 'expense' | 'mileage' | 'perDiem';
export type DistanceUnit = 'km' | 'mi';

/** "0.68" → 680 (thousandths of the currency unit: mileage rates are often in tenths of a cent, 65.5¢). */
export function rateInThousandths(text: string): number {
  const value = Number(String(text).replace(/,/g, '').trim());
  return Number.isFinite(value) && value > 0 ? Math.round(value * 1000) : 0;
}

export function decimalNumber(text: string): number {
  const value = Number(String(text).replace(/,/g, '').trim());
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Distance × rate per km/mile, in whole cents. */
export function mileageCents(distance: number, rateThousandths: number): number {
  return distance > 0 && rateThousandths > 0 ? Math.round(distance * rateThousandths / 10) : 0;
}

/** Days × daily rate, in whole cents (half days allowed). */
export function perDiemCents(days: number, dailyRateCents: number): number {
  return days > 0 && dailyRateCents > 0 ? Math.round(days * dailyRateCents) : 0;
}

const amount = (thousandths: number) => (thousandths / 1000).toFixed(thousandths % 10 ? 3 : 2);

export function mileageLine(input: { purpose: string; from?: string; to?: string; distance: number; unit: DistanceUnit; rateThousandths: number; accountId: string; currency: string }): ClaimLine {
  const route = [input.from?.trim(), input.to?.trim()].filter(Boolean).join(' → ');
  const how = `${input.distance} ${input.unit} × ${input.currency} ${amount(input.rateThousandths)}/${input.unit}`;
  return {
    description: ['Mileage', route, `(${how})`].filter(Boolean).join(' ') + (input.purpose.trim() ? `: ${input.purpose.trim()}` : ''),
    accountId: input.accountId,
    amountCents: mileageCents(input.distance, input.rateThousandths),
  };
}

export function perDiemLine(input: { purpose: string; days: number; dailyRateCents: number; accountId: string; currency: string }): ClaimLine {
  const how = `${input.days} day${input.days === 1 ? '' : 's'} × ${input.currency} ${(input.dailyRateCents / 100).toFixed(2)}`;
  return {
    description: `Per diem (${how})` + (input.purpose.trim() ? `: ${input.purpose.trim()}` : ''),
    accountId: input.accountId,
    amountCents: perDiemCents(input.days, input.dailyRateCents),
  };
}

/** What a mileage or per-diem line still needs, or null. */
export function workedLineProblem(kind: ClaimLineKind, input: { distance?: number; rateThousandths?: number; days?: number; dailyRateCents?: number }): string | null {
  if (kind === 'mileage' && !(input.distance && input.distance > 0)) return 'Mileage needs the distance';
  if (kind === 'mileage' && !(input.rateThousandths && input.rateThousandths > 0)) return 'Mileage needs the rate per km or mile';
  if (kind === 'perDiem' && !(input.days && input.days > 0)) return 'Per diem needs the number of days';
  if (kind === 'perDiem' && !(input.dailyRateCents && input.dailyRateCents > 0)) return 'Per diem needs the daily rate';
  return null;
}

interface ClaimBill {
  status?: string;
  metadata?: { expenseClaim?: ClaimRecord } & Record<string, unknown>;
}

export function claimOf(bill: ClaimBill): ClaimRecord | undefined {
  const claim = bill.metadata?.expenseClaim;
  return claim && typeof claim === 'object' && typeof claim.state === 'string' ? claim : undefined;
}

/** Why this person can't approve or reject the claim, or null when they can. */
export function decisionProblem(claim: ClaimRecord | undefined, role: string, uid: string): string | null {
  if (!claim) return 'Not an expense claim';
  if (claim.state !== 'submitted') return `Already ${claim.state}`;
  if (role !== 'owner' && role !== 'accountant') return 'Only owners and accountants approve expense claims';
  if (claim.submittedBy === uid && role !== 'owner') return 'Someone else must approve your own claim';
  return null;
}

/** Why the claim can't be submitted, or null. */
export function claimProblem(input: { payeeName: string; date: string; lines: ClaimLine[] }): string | null {
  if (!input.payeeName.trim()) return 'Who paid? Type their name';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return 'Choose the date';
  const lines = input.lines.filter(l => l.description.trim() || l.amountCents);
  if (lines.length === 0) return 'Add what was paid for';
  if (lines.some(l => !Number.isInteger(l.amountCents) || l.amountCents <= 0)) return 'Every line needs an amount';
  if (lines.some(l => !l.accountId)) return 'Every line needs a category';
  return null;
}

/** The bill a claim is saved as (a draft until approved). */
export function claimBill(input: {
  payee: { id: string; name: string };
  date: string;
  lines: ClaimLine[];
  note?: string;
  submittedBy: string;
  submittedByName?: string;
  now: string;
  currency: string;
}) {
  const lines = input.lines.filter(l => l.description.trim() || l.amountCents);
  const amountCents = lines.reduce((sum, l) => sum + l.amountCents, 0);
  return {
    vendorId: input.payee.id,
    vendorName: input.payee.name,
    date: input.date,
    dueDate: input.date,
    status: 'draft' as const,
    currency: input.currency,
    exchangeRate: 1,
    amountCents,
    splits: lines.map(l => ({ accountId: l.accountId, amountCents: l.amountCents, description: l.description.trim() })),
    metadata: {
      memo: input.note?.trim() || `Expense claim: ${input.payee.name}`,
      expenseClaim: { state: 'submitted', submittedBy: input.submittedBy, submittedByName: input.submittedByName, submittedAt: input.now } as ClaimRecord,
    },
  };
}

/** The changes that approve (posts the bill) or reject (it stays out of the books) a claim. */
export function claimDecision(bill: ClaimBill, approve: boolean, by: string, now: string, reason?: string) {
  const claim = claimOf(bill);
  return {
    status: approve ? ('approved' as const) : ('rejected' as const),
    metadata: { ...(bill.metadata || {}), expenseClaim: { ...(claim as ClaimRecord), state: approve ? 'approved' : 'rejected', decidedBy: by, decidedAt: now, ...(reason ? { reason } : {}) } },
  };
}
