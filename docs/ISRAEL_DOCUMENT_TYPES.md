# E-12 — Israeli sales-document classification and Hebrew titles

**Status: read-only typed classifier; not a document-issuance or Tax Authority integration.**

Use `classifyIsraeliDocument` in `src/lib/tax/israeliDocumentTypes.ts` after the application has evidence of the exact document that was issued. It returns one of four supported document categories with an English/Hebrew display title, or a deliberately unclassified response (`needs-review` or `not-issued`). There is no numbering, assignment, validation of official filing rules, tax computation, posting, or writing.

## Why explicit issuance facts are necessary

LedgerFlow's existing invoice has a payment status (`paid`, `sent`, `overdue` etc.) but that status **does not establish the Israeli tax document type**. An invoice becoming paid after issuance does not retroactively become a combined tax-invoice/receipt. A posted incoming payment does not by itself establish that a receipt document was issued. A credit amount without original-invoice evidence does not establish a tax-invoice credit. The classifier **does not infer any of those claims**.

| Input context | Evidence needed | Classified output |
| --- | --- | --- |
| Invoice issued explicitly as tax invoice | `lifecycle: issued`, `issuedAs: tax-invoice`, `vatStatus: registered`, and no contradictory combined-receipt fact | `tax-invoice` / **חשבונית מס** |
| Invoice and receipt issued together as one document | `issuedAs: tax-invoice-receipt` and `receiptOnSameDocument: true`, with a VAT-authorized issuer | `tax-invoice-receipt` / **חשבונית מס / קבלה** |
| Incoming payment with separate receipt document | `source: payment`, `direction: received`, `receiptIssued: true`, `lifecycle: issued` | `receipt` / **קבלה** |
| Credit note issued against an original tax invoice | `credits: tax-invoice`, verified VAT issuer and nonblank original invoice reference | `credit` / **חשבונית מס זיכוי** |
| Other explicitly issued credit | `credits: other`, `lifecycle: issued` | `credit` / **חשבונית זיכוי** |
| Draft, void, exempt/unknown tax-invoice issuer, ordinary transaction invoice, or missing evidence | Do not guess | `not-issued` or `needs-review` |

### Example

```ts
classifyIsraeliDocument({
  source: 'invoice',
  lifecycle: 'issued',
  issuedAs: 'tax-invoice-receipt',
  vatStatus: 'registered',
  receiptOnSameDocument: true,
});
// { status: 'classified', kind: 'tax-invoice-receipt',
//   titleHe: 'חשבונית מס / קבלה', titleEn: 'Tax invoice / receipt' }
```

## Integration contract for AI #1 (Claude)

1. Establish an **authoritative issuance record** for invoice/receipt/credit with issued form kind, issued-at time and immutable reference; do **not** infer issuance from `Invoice.status`, `Payment.status`, zero VAT, or simply finding a payment.
2. Feed `vatStatus` from **verified, effective-dated** tax facts in the rule graph, not from a chosen label alone. Eligibility is an independent check; this helper's boolean-like status is *input evidence*, not verification.
3. A combined form requires same-document issuance proof. Separate receipt references remain separate even if payment was immediate.
4. Tax-invoice credit should reference the original issued document. Preserve the original after cancellation; never reclassify posted historical documents.
5. Once reviewed, wire a display title to the proper print/view layer using these pure helpers. Claude owns number sequencing, legal signatures, invoice allocation, immutable issuance, posting and official exports.
6. Review official authority naming and eligibility requirements for the intended deployment; do not interpret the four titles as proof that all mandatory fields, allocations or filing records exist.

## Sources and limits

Official Israel Tax Authority document-type nomenclature:
- [Software-house instructions, section 2.5, document type table](https://www.gov.il/BlobFolder/generalpage/hor-software-other/he/IncomeTax_software-houses-100923.pdf).
- [Uniform accounting-file document categories](https://www.gov.il/BlobFolder/service/registration-software-designed-managing-computerized-accounting-system/he/Service_Pages_Income_tax_horaot-131.pdf).

Both are official publications, but their file-code catalogs differ by era and use case. **No numeric document type codes are emitted by this helper.** An allocation number, invoice serial number and document-type code are different concepts. Official filing readiness remains outside E-12.

## Verification

`src/tests/israeli-document-types.test.ts` has ten tests for type titles, same-document evidence, separated payments, credit references, issuer status, transaction invoices, draft and void handling, and lack of mutation. Run the repository's full checks; the test fixtures validate the helper's policy, not official acceptance of a tax document.
