# E-25 — Payment-card number masking in free text

AI #5 / 14 October 2026. This is a best-effort client-side privacy safeguard, **not a payment compliance attestation**.

## What is masked

`src/lib/cardNumberMask.ts` detects stand-alone 13–19 digit values with optional space/dash grouping and a valid Luhn checksum. It keeps only the final four numerals. The helper does not log original text or call any external service. Ordinary document and reference identifiers with an invalid checksum are left unchanged.

The helper is applied **before the following text is saved or sent**:
- `src/components/intelligence/Copilot.tsx` — user prompts, their displayed chat entries, and text labels from account/transaction summaries sent along with those prompts.
- `src/components/support/SupportView.tsx` — ticket subject, initial ticket message and replies, whether the server-message endpoint succeeds or the existing browser persistence path is used.
- `src/lib/feedbackTicket.ts` — feedback body and screen title at the central ticket/message construction boundary, including the normal screenshot-feedback workflow.
- `src/lib/recordNotes.ts` — new and edited record-note helper results.

The original stored data of historical tickets and notes is **not** rewritten. The API backend's `SecurityService.scrubPII` remains a separate defense; this change does not claim to inspect attachments, image pixels, other records' free-text fields, direct API calls, every error/diagnostics payload or developer API traffic. Luhn is not proof that a number is a payment credential and checksum-invalid values can evade this safeguard. Sensitive text should not be entered into messaging fields.

## Verification

`src/tests/card-number-mask.test.ts` covers valid and invalid checksums, multiple candidate sequences, plain and grouped numbers, Hebrew text, surrounding identifier boundaries, immutable record-note editing, and feedback ticket/message output.

No saved payment record or transaction amount is changed. No database, migration, posting, financial calculations, backend authorization or quality thresholds are changed. An acting lead should run full type/lint/tests and inspect any additional free-text input paths before treating this control as comprehensive.
