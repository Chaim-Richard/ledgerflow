/**
 * Incoming events (K-37): what outside services told LedgerFlow about this workspace and what came of
 * it — a customer's online card payment from Stripe (recorded, waiting for the bank, refused…), a plan
 * change, and the email provider's delivery reports (delivered, bounced, marked as spam). Read from
 * what the server already keeps: `stripeProcessedEvents` (one row per Stripe event, with its outcome)
 * and `emailEvents` (the send log). Nothing here changes anything.
 */

export type EventSource = 'stripe' | 'email';
export type EventTone = 'ok' | 'waiting' | 'problem' | 'info';

export interface IncomingEvent {
  id: string;
  source: EventSource;
  at: string;
  /** what it was, in words ("Online card payment", "Email bounced") */
  what: string;
  /** what came of it, in words */
  outcome: string;
  tone: EventTone;
  /** the invoice or document it is about, when known */
  recordId?: string;
  detail?: string;
}

const STRIPE_OUTCOMES: Record<string, [string, EventTone]> = {
  recorded: ['Payment recorded against the invoice', 'ok'],
  pending: ['Waiting for the bank to clear it; recorded when Stripe confirms', 'waiting'],
  currency_mismatch: ['Not recorded: paid in a different currency from the invoice', 'problem'],
  nothing_paid: ['Not recorded: no amount was paid', 'problem'],
  invoice_not_found: ['Not recorded: the invoice was not found', 'problem'],
  plan_updated: ['Plan updated', 'ok'],
  plan_cancelled: ['Plan cancelled', 'info'],
  ignored: ['Nothing to do for this kind of event', 'info'],
};

const STRIPE_WHAT: Record<string, string> = {
  'checkout.session.completed': 'Online card payment',
  'checkout.session.async_payment_succeeded': 'Online payment cleared',
  'customer.subscription.deleted': 'Subscription ended',
};

const EMAIL: Record<string, [string, string, EventTone]> = {
  delivered: ['Email delivered', 'Delivered to the recipient', 'ok'],
  bounced: ['Email bounced', "Not delivered: the address won't be emailed again until it is changed", 'problem'],
  complaint: ['Marked as spam', "The recipient marked it as spam: the address won't be emailed again", 'problem'],
};

const at = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') return (value as { toDate: () => Date }).toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return '';
};

/** One Stripe event row in words. */
export function describeStripeEvent(row: Record<string, unknown>): IncomingEvent {
  const outcome = String(row.outcome || row.note || (row.paymentId ? 'recorded' : ''));
  const [text, tone] = STRIPE_OUTCOMES[outcome] || ['Received', 'info' as EventTone];
  const amount = typeof row.amountCents === 'number' ? ` (${(row.amountCents / 100).toFixed(2)})` : '';
  return {
    id: String(row.id || ''),
    source: 'stripe',
    at: at(row.processedAt),
    what: (STRIPE_WHAT[String(row.type)] || String(row.type || 'Stripe event')) + amount,
    outcome: text,
    tone,
    recordId: row.invoiceId ? String(row.invoiceId) : undefined,
  };
}

/** One email delivery report in words (the "sent" rows are the send log, not incoming events). */
export function describeEmailEvent(row: Record<string, unknown>): IncomingEvent | null {
  const known = EMAIL[String(row.event)];
  if (!known) return null;
  return {
    id: String(row.id || ''),
    source: 'email',
    at: at(row.timestamp),
    what: known[0],
    outcome: known[1],
    tone: known[2],
    recordId: row.documentId ? String(row.documentId) : undefined,
    detail: row.recipient ? String(row.recipient) : undefined,
  };
}

/** Both kinds together, newest first. */
export function incomingEvents(stripeRows: Record<string, unknown>[], emailRows: Record<string, unknown>[], limit = 200): IncomingEvent[] {
  return [
    ...stripeRows.map(describeStripeEvent),
    ...emailRows.map(describeEmailEvent).filter((e): e is IncomingEvent => e !== null),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
