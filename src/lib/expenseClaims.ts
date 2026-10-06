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
