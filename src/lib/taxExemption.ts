/**
 * Customer tax exemption certificates (T-05): a customer who doesn't pay tax (a charity, a reseller,
 * a government body) gives a certificate; its number and the date it runs out are kept on the
 * customer (`taxExemption` in their `metadata`, Customers → Edit). A new invoice for them says so
 * and offers to charge no tax; once the certificate has run out the invoice says that instead, so
 * tax is charged again until a new one comes in. Nothing is posted differently: the invoice's tax
 * code decides, as always.
 *
 * A-55: the certificate also carries the type it claims (resale, nonprofit, a multistate form…),
 * from the vocabulary in `src/lib/tax/usExemptionCertificates.ts`; a recorded type outside the
 * vocabulary is dropped rather than guessed at. The type is information for the reader of the
 * certificate: which types a state accepts is the state's own rule, as that table says.
 */
import { exemptionCertificateType } from './tax/usExemptionCertificates';

export interface TaxExemption {
  number: string;
  /** YYYY-MM-DD, the last day it is good for; none when it does not run out */
  expires?: string;
  /** A-55: what the certificate claims (a type id from usExemptionCertificates.ts); none when not recorded */
  type?: string;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** The customer's certificate, or undefined when they have none. */
export function taxExemptionOf(contact?: { metadata?: unknown } | null): TaxExemption | undefined {
  const own = (contact?.metadata as { taxExemption?: unknown } | undefined)?.taxExemption as Partial<TaxExemption> | undefined;
  if (!own || typeof own.number !== 'string' || !own.number.trim()) return undefined;
  // the type is kept only when it is one of A-55's vocabulary ids; a junk string is dropped, never guessed
  const type = typeof own.type === 'string' ? own.type.trim().toLowerCase() : '';
  return {
    number: own.number.trim().slice(0, 80),
    ...(typeof own.expires === 'string' && YMD.test(own.expires) ? { expires: own.expires } : {}),
    ...(type && exemptionCertificateType(type) ? { type } : {}),
  };
}

/** On `date` (YYYY-MM-DD): 'exempt' with a good certificate, 'expired' after its last day, null with none. */
export function exemptionOn(contact: { metadata?: unknown } | null | undefined, date: string): { state: 'exempt' | 'expired'; certificate: TaxExemption } | null {
  const certificate = taxExemptionOf(contact);
  if (!certificate) return null;
  return { state: certificate.expires && date > certificate.expires ? 'expired' : 'exempt', certificate };
}
