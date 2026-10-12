# E-14 — US EIN / SSN formatting and masked warning helpers

**Status: pure input and display helpers only. Vendor contact-form wiring remains AI #1's reserved scope. No registry or IRS matching, tax-ID storage, filing or financial posting is performed.**

## Purpose and API

`src/lib/tax/usTaxIdFormat.ts` provides:

| Helper | Result | Suitable use |
| --- | --- | --- |
| `checkUsTaxId(value, 'ein' | 'ssn')` | `empty`, `warning` with a static reason, or `valid-format` with a **masked suffix only** | Nonblocking on-input validation |
| `usTaxIdWarning(check)` | Static non-identifying guidance or null | Accessible, on-screen warning |
| `maskUsTaxId(value, kind)` | `**-***1234` / `***-**-1234`, or null | Read-only masked display |
| `formatUsTaxIdForInput(value, kind)` | Complete conventional display formatting, or null | **Only inside a trusted, controlled input**, not for general display, logging, API errors, analytics, or saved history |

**Input kind must be chosen, never inferred from nine digits.** The same nine-digit string can meet the basic layout of both types; a caller must not silently recategorize it.

- EIN format: nine ASCII digits, displayed `XX-XXXXXXX` (two digits + seven).
- SSN format: nine ASCII digits, displayed `XXX-XX-XXXX` (three + two + four). The SSA identifies impossible patterns: first three digits 000, 666, or 900–999; middle group 00; last four 0000. Current checks deliberately **do not rely on historic geographic or high-group assignments** after SSA randomization.
- Plain nine digits or the complete standard segmented representation are accepted. The helper intentionally rejects extra punctuation, non-ASCII digits and inconsistent segments rather than silently stripping them. Empty is distinct from invalid.
- A placeholder with all zeros is not accepted. EIN has **no public check digit** used here; these checks cannot verify issuance or ownership. Do not hard-code historical EIN prefix-assignment lists without authoritative, date-aware evidence.

## Integration handoff to Claude (AI #1)

The shared `src/components/common/PartyModal.tsx` is reserved. Its vendor form has no dedicated, typed US tax-ID control yet; its current `withholding` certificate field is **not** an EIN/SSN field.

AI #1 must:

1. Add a vendor input with an explicit EIN/SSN choice, visible only when the appropriate US tax context is established. The selection should not be guessed from numbers, vendor type or the company name.
2. Render `usTaxIdWarning(checkUsTaxId(value, kind))` below that input, with `aria-describedby` or an equivalent accessible announcement. It is a **nonblocking** warning, not evidence that a vendor has a matching IRS record.
3. Keep raw values out of console logs, telemetry, toast errors, support attachments and general activity/audit text. Use `maskUsTaxId` for any read-only display; never use `formatUsTaxIdForInput` outside the focused, authorized editing control.
4. Agree separately on secure server-approved storage, encryption/access controls, W-9 collection, role authorization, audited access, redaction and data-retention policy before persisting an identifier. Existing `metadata` or certificate slots must not be repurposed silently. Tax collection/filing features remain incomplete without those contracts.
5. Confirm the warning clears when empty, updates when the kind changes or a different vendor is opened, and never blocks the ordinary contact save. Add UI tests for keyboard access, invalid formats, server refusal, and workspace switching when integrated.
6. Keep E-14 partial until this vendor UI is included and browser-tested. The pure module may merge independently as a prepared helper.

## Official references

- [2026 IRS General Instructions for Forms W-2 and W-3 — taxpayer identification numbers](https://www.irs.gov/instructions/iw2w3) supplies the two display layouts and requirements to use the assigned numbers.
- [SSA — Social Security Number Randomization FAQ](https://www.ssa.gov/employer/randomizationfaqs.html) describes current impossible groupings and obsolete geographic group rules.
- [IRS — About Form W-9](https://www.irs.gov/forms-pubs/about-form-w-9) explains the separately collected taxpayer identification and certification process.

The `src/tests/us-tax-id-format.test.ts` suite has ten focused tests for normal layouts, explicit kind selection, SSA impossible patterns, placeholder and malformed input, masking, static warning text and no mutation.

**This feature performs typing checks only. It neither confirms an issued number nor permits LedgerFlow to submit tax reports.**
