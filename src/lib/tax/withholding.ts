/**
 * Tax withheld at source on payments to vendors (PLAN IL-5, Israel ניכוי במקור; the same shape fits
 * US backup withholding). The vendor's certificate says the rate and until when it is good
 * (`withholding` in their `metadata`, like T-05's exemption certificates). On a payment the tax
 * withheld is the rate × the part of the payment that is not VAT; the vendor gets the rest, and the
 * withheld tax is owed to the tax authority (a liability account), reported yearly (Form 856).
 * Pure.
 */
export interface WithholdingCertificate {
  /** percent, 0 to 100 (0 = a certificate of exemption from withholding) */
  ratePercent: number;
  number?: string;
  /** YYYY-MM-DD, the last day it is good for */
  expires?: string;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function withholdingOf(vendor?: { metadata?: unknown } | null): WithholdingCertificate | undefined {
  const own = (vendor?.metadata as { withholding?: Partial<WithholdingCertificate> } | undefined)?.withholding;
  if (!own || typeof own.ratePercent !== 'number' || !Number.isFinite(own.ratePercent) || own.ratePercent < 0 || own.ratePercent > 100) return undefined;
  return {
    ratePercent: own.ratePercent,
    ...(typeof own.number === 'string' && own.number.trim() ? { number: own.number.trim().slice(0, 40) } : {}),
    ...(typeof own.expires === 'string' && YMD.test(own.expires) ? { expires: own.expires } : {}),
  };
}

/** On `date`: the certificate when good, 'expired' after its last day, or null with none. */
export function withholdingOn(vendor: { metadata?: unknown } | null | undefined, date: string): { state: 'good' | 'expired'; certificate: WithholdingCertificate } | null {
  const certificate = withholdingOf(vendor);
  if (!certificate) return null;
  return { state: certificate.expires && date > certificate.expires ? 'expired' : 'good', certificate };
}

/** The tax to withhold from a payment of `paidCents` of which `vatCents` is VAT: rate × (paid − VAT), whole cents. */
export function withheldCents(paidCents: number, vatCents: number, ratePercent: number): number {
  const base = Math.max(0, paidCents - Math.max(0, vatCents));
  return Math.round(base * ratePercent / 100);
}

/** The liability account withheld tax is owed on: a liability whose subtype is withholding or whose name says so. */
export function isWithholdingAccount(account: { type?: string; subtype?: string; name?: string; isArchived?: boolean }): boolean {
  if (account.isArchived || String(account.type || '').toLowerCase() !== 'liability') return false;
  return String(account.subtype || '').toLowerCase() === 'withholding' || /withh?eld at source|withholding tax|ניכוי במקור/i.test(String(account.name || ''));
}
