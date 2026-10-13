/**
 * A-49: the quotes a customer can accept on the customer portal. The list shows the customer's own
 * estimates (and the proposal written for each, when one exists) that are still live: open to sign,
 * expired, or already signed. Declined, converted and draft estimates are not shown to the customer.
 * Accepting uses the same signature rules as the signing link (Y-20, src/lib/estimateSignature.ts):
 * a full name and an explicit "I accept"; the server records who, when and from where, and turns
 * the estimate into an order exactly as if the business had pressed Order.
 *
 * Pure: it reads the documents it is given and writes nothing. The portal route that saves the
 * signature stays on the server.
 */
import { signatureProblem, signState, type SignState } from './estimateSignature';
import type { Estimate } from '../types';
import type { Proposal } from './proposals';

export interface CustomerQuoteItem {
  estimateId: string;
  number: string;
  /** a proposal written for this estimate, shown with its title; the estimate itself otherwise */
  kind: 'estimate' | 'proposal';
  title: string;
  date: string;
  expiryDate?: string;
  amountCents: number;
  currency?: string;
  state: SignState;
  /** true only when the customer can accept it today */
  canAccept: boolean;
  /** plain words for the customer when they cannot accept it */
  reason?: string;
}

const STATE_REASON: Record<Exclude<SignState, 'open'>, string> = {
  signed: 'You have already accepted this quote.',
  expired: 'This quote has expired. Ask us for an updated one.',
  closed: 'This quote is no longer open for acceptance.',
};

/** The live quotes of one customer, open ones first, then by date (newest first). */
export function customerOpenQuotes(
  estimates: Array<Pick<Estimate, 'id' | 'customerId' | 'number' | 'date' | 'expiryDate' | 'amountCents' | 'status' | 'orderedAt' | 'signature' | 'lines'> & { currency?: string }>,
  customerId: string,
  today: string,
  proposals: Record<string, Pick<Proposal, 'title'>> = {},
): CustomerQuoteItem[] {
  if (!customerId) return [];
  const items = estimates
    .filter(e => e.customerId === customerId)
    .map((e): CustomerQuoteItem => {
      const state = signState(e, today);
      const proposal = proposals[e.id];
      return {
        estimateId: e.id,
        number: e.number || e.id,
        kind: proposal ? 'proposal' : 'estimate',
        title: proposal?.title || e.number || 'Quote',
        date: String(e.date || '').slice(0, 10),
        ...(e.expiryDate ? { expiryDate: String(e.expiryDate).slice(0, 10) } : {}),
        amountCents: e.amountCents || 0,
        ...(e.currency ? { currency: e.currency } : {}),
        state,
        canAccept: state === 'open',
        ...(state === 'open' ? {} : { reason: STATE_REASON[state] }),
      };
    })
    .filter(item => item.state !== 'closed' || !['draft', 'declined', 'converted'].includes(String(estimates.find(e => e.id === item.estimateId)?.status)));
  const rank: Record<SignState, number> = { open: 0, expired: 1, signed: 2, closed: 3 };
  return items.sort((a, b) => rank[a.state] - rank[b.state] || b.date.localeCompare(a.date) || a.number.localeCompare(b.number));
}

/** Why the customer cannot accept this quote now (the form's message), or null when they can. */
export function acceptQuoteProblem(item: Pick<CustomerQuoteItem, 'canAccept' | 'reason'>, input: { name?: unknown; agree?: unknown }): string | null {
  if (!item.canAccept) return item.reason || 'This quote cannot be accepted.';
  return signatureProblem(input);
}
