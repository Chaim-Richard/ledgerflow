/**
 * How a customer or vendor wants documents delivered (Y-27). Every contact has one preferred
 * channel; "Email" is the default and what the app did before anyone asked, so a contact that
 * never chose anything keeps getting emails. Choosing a paper method (Print or Post) or "Nothing
 * automatic" only changes what goes out **by itself**: the daily reminders, the monthly statement
 * batch and the "email it when the invoice is saved as sent" step. A person pressing Email (on one
 * invoice, or in the bulk bar) still sends — that is a decision, not automation — and the send log
 * says it went against the contact's preference.
 */

export type DeliveryMethod = 'email' | 'print' | 'post' | 'none';

/** The contact fields this reads; a Customer or a Vendor fits, and so does a plain document. */
export interface DeliveryPreference {
  deliveryMethod?: string | null;
}

export const DEFAULT_DELIVERY: DeliveryMethod = 'email';

/** Shown in order, in the contact form and on the contact's page. Labels stay English (decision 10). */
export const DELIVERY_METHODS: Array<{ value: DeliveryMethod; label: string; note: string }> = [
  { value: 'email', label: 'Email', note: 'the document is emailed as a PDF' },
  { value: 'print', label: 'Print', note: 'someone prints it and hands it over' },
  { value: 'post', label: 'Post', note: 'a paper copy is mailed' },
  { value: 'none', label: 'Nothing automatic', note: 'nothing is sent by itself; the payment link still works' },
];

const BY_VALUE = new Map(DELIVERY_METHODS.map(m => [m.value as string, m]));

/** The methods that mean "no paper, no email of its own accord" — for the database queries. */
export const PAPER_DELIVERY_METHODS: DeliveryMethod[] = ['print', 'post', 'none'];

/**
 * The stored choice, cleaned: unknown, empty or missing values are Email (how it was before
 * anyone could choose). Values are compared without case, so an import writing "POST" is honoured.
 */
export function preferredDelivery(party: DeliveryPreference | null | undefined): DeliveryMethod {
  const stored = String(party?.deliveryMethod ?? '').trim().toLowerCase();
  return BY_VALUE.has(stored) ? (stored as DeliveryMethod) : DEFAULT_DELIVERY;
}

/** The label to show someone ("Post", or "Email" when nothing was chosen). */
export function deliveryLabel(method: string | null | undefined): string {
  return BY_VALUE.get(String(method ?? '').trim().toLowerCase())?.label ?? BY_VALUE.get(DEFAULT_DELIVERY)!.label;
}

/** What to say about it in a sentence: "a paper copy to print", "a posted copy"… */
export function deliveryPhrase(method: DeliveryMethod): string {
  switch (method) {
    case 'print': return 'a printed copy';
    case 'post': return 'a posted copy';
    case 'none': return 'nothing automatically';
    default: return 'an emailed copy';
  }
}

/** True when documents may go out by email on their own (the default). */
export function sendsByEmail(party: DeliveryPreference | null | undefined): boolean {
  return preferredDelivery(party) === DEFAULT_DELIVERY;
}

/**
 * What the send log notes when an email went out although the contact asked for paper:
 * null when there is nothing to say (the normal case, and for contacts without an email field).
 */
export function againstPreference(party: DeliveryPreference | null | undefined): DeliveryMethod | null {
  const method = preferredDelivery(party);
  return method === DEFAULT_DELIVERY ? null : method;
}
