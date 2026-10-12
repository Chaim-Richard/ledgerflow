import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyIsraeliDocument, israeliDocumentTitle, type IsraeliDocumentEvidence,
} from '../lib/tax/israeliDocumentTypes';

const invoice: IsraeliDocumentEvidence = {
  source: 'invoice', lifecycle: 'issued', issuedAs: 'tax-invoice', vatStatus: 'registered',
};

test('E-12 Hebrew and English titles match distinct Israeli document kinds', () => {
  assert.equal(israeliDocumentTitle('tax-invoice'), 'חשבונית מס');
  assert.equal(israeliDocumentTitle('receipt'), 'קבלה');
  assert.equal(israeliDocumentTitle('tax-invoice-receipt'), 'חשבונית מס / קבלה');
  assert.equal(israeliDocumentTitle('credit'), 'חשבונית זיכוי');
  assert.equal(israeliDocumentTitle('tax-invoice', 'en'), 'Tax invoice');
});

test('E-12 issued tax invoice stays an invoice even if payment exists elsewhere', () => {
  assert.deepEqual(classifyIsraeliDocument(invoice), {
    status: 'classified', kind: 'tax-invoice', titleHe: 'חשבונית מס', titleEn: 'Tax invoice',
  });
  assert.equal(classifyIsraeliDocument({ ...invoice, receiptOnSameDocument: false }).kind, 'tax-invoice');
});

test('E-12 combined tax-invoice/receipt requires explicit same-document evidence', () => {
  const candidate: IsraeliDocumentEvidence = {
    ...invoice, issuedAs: 'tax-invoice-receipt',
  };
  assert.equal(classifyIsraeliDocument(candidate).status, 'needs-review');
  assert.equal(classifyIsraeliDocument({ ...candidate, receiptOnSameDocument: false }).status, 'needs-review');
  assert.deepEqual(classifyIsraeliDocument({ ...candidate, receiptOnSameDocument: true }), {
    status: 'classified', kind: 'tax-invoice-receipt',
    titleHe: 'חשבונית מס / קבלה', titleEn: 'Tax invoice / receipt',
  });
  assert.equal(classifyIsraeliDocument({ ...invoice, receiptOnSameDocument: true }).status, 'needs-review');
});

test('E-12 receiving a payment requires receipt issuance; made payments are not receipts', () => {
  const payment: IsraeliDocumentEvidence = {
    source: 'payment', lifecycle: 'issued', direction: 'received', receiptIssued: true,
  };
  assert.deepEqual(classifyIsraeliDocument(payment), {
    status: 'classified', kind: 'receipt', titleHe: 'קבלה', titleEn: 'Receipt',
  });
  assert.equal(classifyIsraeliDocument({ ...payment, receiptIssued: false }).status, 'needs-review');
  assert.equal(classifyIsraeliDocument({ ...payment, direction: 'made' }).status, 'needs-review');
});

test('E-12 a tax-invoice credit requires original reference and VAT-eligible seller', () => {
  const credit: IsraeliDocumentEvidence = {
    source: 'credit-note', lifecycle: 'issued', credits: 'tax-invoice',
    vatStatus: 'registered', originalInvoiceReference: 'INV-2026-001',
  };
  assert.deepEqual(classifyIsraeliDocument(credit), {
    status: 'classified', kind: 'credit', titleHe: 'חשבונית מס זיכוי', titleEn: 'Tax credit note',
  });
  assert.equal(classifyIsraeliDocument({ ...credit, originalInvoiceReference: '' }).status, 'needs-review');
  assert.equal(classifyIsraeliDocument({ ...credit, originalInvoiceReference: '   ' }).status, 'needs-review');
  assert.equal(classifyIsraeliDocument({ ...credit, vatStatus: 'unknown' }).status, 'needs-review');
  assert.equal(classifyIsraeliDocument({ ...credit, vatStatus: 'exempt' }).status, 'needs-review');
});

test('E-12 ordinary credit remains a credit, without assuming it adjusts VAT', () => {
  assert.deepEqual(classifyIsraeliDocument({
    source: 'credit-note', lifecycle: 'issued', credits: 'other', vatStatus: 'unknown',
  }), {
    status: 'classified', kind: 'credit', titleHe: 'חשבונית זיכוי', titleEn: 'Credit note',
  });
  assert.equal(classifyIsraeliDocument({
    source: 'credit-note', lifecycle: 'issued', credits: 'unknown', vatStatus: 'registered',
  }).status, 'needs-review');
});

test('E-12 exempt/unknown VAT status never silently produces a tax invoice', () => {
  assert.equal(classifyIsraeliDocument({ ...invoice, vatStatus: 'exempt' }).status, 'needs-review');
  assert.equal(classifyIsraeliDocument({ ...invoice, vatStatus: 'unknown' }).status, 'needs-review');
});

test('E-12 transaction invoice is not renamed as tax invoice', () => {
  const result = classifyIsraeliDocument({ ...invoice, issuedAs: 'transaction-invoice' });
  assert.equal(result.status, 'needs-review');
  assert.equal(result.kind, null);
});

test('E-12 draft and void documents do not receive ordinary issued titles', () => {
  const draft = classifyIsraeliDocument({ ...invoice, lifecycle: 'draft' });
  assert.equal(draft.status, 'not-issued');
  assert.equal(draft.titleHe, null);
  const voided = classifyIsraeliDocument({
    source: 'payment', lifecycle: 'void', direction: 'received', receiptIssued: true,
  });
  assert.equal(voided.status, 'needs-review');
  assert.equal(voided.kind, null);
});

test('E-12 classification does not modify input facts or calculate amounts/numbers', () => {
  const frozen: IsraeliDocumentEvidence = Object.freeze({
    source: 'invoice', lifecycle: 'issued', issuedAs: 'tax-invoice-receipt',
    vatStatus: 'registered', receiptOnSameDocument: true,
  });
  const first = classifyIsraeliDocument(frozen);
  const second = classifyIsraeliDocument(frozen);
  assert.deepEqual(first, second);
  assert.deepEqual(frozen, {
    source: 'invoice', lifecycle: 'issued', issuedAs: 'tax-invoice-receipt',
    vatStatus: 'registered', receiptOnSameDocument: true,
  });
  assert.equal(Object.hasOwn(first, 'number'), false);
  assert.equal(Object.hasOwn(first, 'taxCents'), false);
});
