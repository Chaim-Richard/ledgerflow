/**
 * E-12 — read-only Israeli sales-document classification (no issuance or numbering).
 *
 * Distinguish the *kind actually issued* from accounting state. Being paid does
 * not turn a tax invoice into a combined tax-invoice/receipt. No type here is
 * evidence that an invoice was legally issued, assigned a number, signed,
 * allocated by the Tax Authority, or accepted for a tax filing.
 *
 * Document nomenclature: Israel Tax Authority uniform file / software-house
 * document types, https://www.gov.il/BlobFolder/generalpage/hor-software-other/he/IncomeTax_software-houses-100923.pdf
 */

export type IsraeliDocumentType = 'tax-invoice' | 'receipt' | 'tax-invoice-receipt' | 'credit';
export type IsraeliDocumentLifecycle = 'draft' | 'issued' | 'void';
export type IsraeliVatStatus = 'registered' | 'exempt' | 'unknown';

export interface IsraeliDocumentLabel {
  kind: IsraeliDocumentType;
  /** The Hebrew title to display on a reviewed, explicitly issued document. */
  titleHe: string;
  titleEn: string;
}

const LABELS: Readonly<Record<IsraeliDocumentType, Readonly<IsraeliDocumentLabel>>> = {
  'tax-invoice': {
    kind: 'tax-invoice', titleHe: 'חשבונית מס', titleEn: 'Tax invoice',
  },
  receipt: {
    kind: 'receipt', titleHe: 'קבלה', titleEn: 'Receipt',
  },
  'tax-invoice-receipt': {
    kind: 'tax-invoice-receipt', titleHe: 'חשבונית מס / קבלה', titleEn: 'Tax invoice / receipt',
  },
  credit: {
    kind: 'credit', titleHe: 'חשבונית זיכוי', titleEn: 'Credit note',
  },
};

export type IsraeliDocumentEvidence =
  | {
      source: 'invoice';
      lifecycle: IsraeliDocumentLifecycle;
      /** Tax invoice must be an explicitly issued kind, not inferred from payment state. */
      issuedAs: 'tax-invoice' | 'tax-invoice-receipt' | 'transaction-invoice' | 'unknown';
      vatStatus: IsraeliVatStatus;
      /** True only when the receipt was issued in the SAME document at the same issuance. */
      receiptOnSameDocument?: boolean;
    }
  | {
      source: 'payment';
      lifecycle: IsraeliDocumentLifecycle;
      /** A made payment is not a customer receipt. */
      direction: 'received' | 'made';
      /** Payment posting alone is not evidence a receipt was issued. */
      receiptIssued: boolean;
    }
  | {
      source: 'credit-note';
      lifecycle: IsraeliDocumentLifecycle;
      /** Whether this is a tax-invoice credit or some other credit document. */
      credits: 'tax-invoice' | 'other' | 'unknown';
      vatStatus: IsraeliVatStatus;
      /** Required for an issued tax-invoice credit; does not verify the original. */
      originalInvoiceReference?: string;
    };

export type IsraeliDocumentClassification =
  | ({ status: 'classified' } & IsraeliDocumentLabel)
  | { status: 'needs-review' | 'not-issued'; kind: null; titleHe: null; titleEn: null; reason: string };

function unknown(reason: string, status: 'needs-review' | 'not-issued' = 'needs-review'): IsraeliDocumentClassification {
  return { status, kind: null, titleHe: null, titleEn: null, reason };
}

function labelled(kind: IsraeliDocumentType): IsraeliDocumentClassification {
  return { status: 'classified', ...LABELS[kind] };
}

/** Pure classification from verified issuance facts; never modifies the record. */
export function classifyIsraeliDocument(evidence: IsraeliDocumentEvidence): IsraeliDocumentClassification {
  if (evidence.lifecycle === 'draft') return unknown('Draft: no issued document has been established.', 'not-issued');
  if (evidence.lifecycle === 'void') {
    return unknown('Voided document: inspect the original issuance and cancellation record.');
  }
  if (evidence.lifecycle !== 'issued') return unknown('Unknown issuance state.');

  if (evidence.source === 'payment') {
    if (evidence.direction !== 'received') return unknown('Outgoing payments are not customer receipts.');
    if (!evidence.receiptIssued) return unknown('Payment recorded, but no receipt issuance was confirmed.');
    return labelled('receipt');
  }

  if (evidence.source === 'credit-note') {
    if (evidence.credits === 'unknown') return unknown('Credit document does not identify its original type.');
    if (evidence.credits === 'tax-invoice') {
      if (evidence.vatStatus !== 'registered') {
        return unknown('Tax-invoice credit requires a verified VAT-authorized issuer.');
      }
      if (!evidence.originalInvoiceReference?.trim()) {
        return unknown('Tax-invoice credit needs a reference to its original invoice.');
      }
      return {
        status: 'classified', kind: 'credit',
        titleHe: 'חשבונית מס זיכוי', titleEn: 'Tax credit note',
      };
    }
    return labelled('credit');
  }

  if (evidence.source === 'invoice') {
    if (evidence.issuedAs === 'transaction-invoice') {
      return unknown('Transaction invoice is distinct from a tax invoice and outside the four supported types.');
    }
    if (evidence.issuedAs === 'unknown') return unknown('Issued document type is not recorded.');
    if (evidence.vatStatus !== 'registered') {
      return unknown('Tax invoices require a verified VAT-authorized issuer.');
    }
    if (evidence.issuedAs === 'tax-invoice-receipt') {
      if (evidence.receiptOnSameDocument !== true) {
        return unknown('Combined document requires evidence that a receipt was issued on the same document.');
      }
      return labelled('tax-invoice-receipt');
    }
    if (evidence.receiptOnSameDocument === true) {
      return unknown('Conflicting invoice type and same-document receipt evidence.');
    }
    return labelled('tax-invoice');
  }
  return unknown('Unsupported document source.');
}

/** Titles only — no new numbering scheme and no authority-approved file type codes. */
export function israeliDocumentTitle(kind: IsraeliDocumentType, language: 'he' | 'en' = 'he'): string {
  return language === 'he' ? LABELS[kind].titleHe : LABELS[kind].titleEn;
}
