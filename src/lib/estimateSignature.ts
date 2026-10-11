/**
 * Signing an estimate online (Y-20): the business sends a private link (`/e/<token>`); the customer
 * reads the estimate, types their full name and ticks "I accept". The server keeps who signed, when,
 * from which address and browser, and the estimate becomes an order (K-04), as if someone in the
 * business had pressed Order. An estimate is signed once; a declined, converted or expired one, or a
 * draft, cannot be.
 */
export const SIGN_TOKEN = /^es_[a-f0-9]{48}$/;
export const MAX_SIGNER_NAME = 120;

export interface EstimateSignature {
  name: string;
  signedAt: string;
  /** the address the page was signed from, and the browser, as evidence */
  ip?: string;
  userAgent?: string;
}

export type SignState = 'open' | 'signed' | 'expired' | 'closed';

/** Whether the estimate can be signed today. */
export function signState(est: { status?: string; orderedAt?: string; signature?: unknown; expiryDate?: string }, today: string): SignState {
  if (est.signature || est.orderedAt) return 'signed';
  if (['draft', 'declined', 'converted', 'expired'].includes(String(est.status))) return 'closed';
  if (est.expiryDate && String(est.expiryDate).slice(0, 10) < today) return 'expired';
  return 'open';
}

/** What the customer sent, checked; null when it is fine. */
export function signatureProblem(input: { name?: unknown; agree?: unknown }): string | null {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < 2 || name.length > MAX_SIGNER_NAME) return `Type your full name (2 to ${MAX_SIGNER_NAME} characters)`;
  if (!/\p{L}/u.test(name)) return 'Type your full name';
  if (input.agree !== true) return 'Tick "I accept" to sign';
  return null;
}
