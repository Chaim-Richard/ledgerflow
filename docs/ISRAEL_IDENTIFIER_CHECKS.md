# E-13 — Israeli identity and company-number format checks

**Status:** pure, client-side format/check-digit validator and tests. Not an Israeli ID registry or Corporations Authority lookup. The shared contact form integration belongs to AI #1 because `src/components/common/PartyModal.tsx` is reserved in `docs/COORDINATION.md`.

## API

`src/lib/tax/israeliIdentifiers.ts` exports:

- `checkIsraeliIdentifier(input, 'identity' | 'company')` returning `state: empty | valid-format | warning`, `isValid`, `reason` and a **masked** value only for structurally valid inputs.
- `israeliIdentifierWarning(result)`, returning a safe error explanation or null.
- The validator is pure. Nothing is logged, posted, persisted or sent to an API. It must be a **non-blocking warning** and never certify an identifier as issued, active or belonging to the party.

**Identity IDs:** digits and optional spaces/hyphens, padded left with zeros to nine digits before the familiar 1/2 alternating check digit. An empty field gets no warning. An all-zero ID is rejected even though its mathematical checksum would pass. Shortened (leading-zero omitted) numbers may be entered, with no loss of the original field value.

**Company numbers:** exactly nine digits, starting with 5 and using the nine-digit check. Do **not** force prefix `51` or `52`: the company-number namespace has other issuer categories. The separate type choice matters; a personal ID is not an incorporated-company registration solely because it passes the same check. Neither check verifies the person's or company's existence.

**Privacy:** Never show the full ID in validation messages or send it to an external checksum service. This implementation returns at most a masked four-digit suffix. The original typed field remains controlled by the existing form; the helper neither normalizes saved values nor changes party metadata.

## AI #1 integration required

The existing customer form has `metadata.vatNumber` and tax country `metadata.taxPlace.country`, but there is no explicit *identifier kind* and the shared vendor form has no comparable dedicated ID field. Consequently, running a company check against every VAT/dealer number would incorrectly reject sole-trader IDs and non-Israeli IDs.

Only the owner of `src/components/common/PartyModal.tsx` should:

1. Provide an explicit selection (`identity`, `company`) where an Israeli ID/company number is entered on **both customer and vendor** forms. If country is other than `IL`, the Israeli warning does not apply.
2. Preserve the entered value in the existing controlled input while typing. After a nonempty value, call `checkIsraeliIdentifier(value, kind)`, and show `israeliIdentifierWarning(...)` directly under the field as a visible, accessible non-blocking warning. Empty values have no warning.
3. Do not change `onSave`, number sequences, posting paths, server allowlists, or `TaxProfile` registration validation without a separate approved design. A soft format warning must never silently delete a record.
4. Verify the warning changes when the contact or kind changes, is keyboard accessible and does not leak any full identifier to browser logs, toast errors or analytics.
5. If identifiers are persisted beyond the existing `metadata.vatNumber`, agree on the metadata allowlist / server schema and privacy access rules separately. A validated checksum does not establish entitlement to store or use sensitive ID data.

## Independent references

- [python-stdnum Israeli company number](https://arthurdejong.org/python-stdnum/doc/2.1/stdnum.il.hp): format, prefix and documented valid/invalid checksums (for instance `516179157`).
- [python-stdnum Israeli ID number implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/il/idnr.py): left zero padding and checksum algorithm.
- [Israeli Corporations Authority — official company extract](https://www.gov.il/en/service/company_extract): authoritative registry checks are separate from a local format check.

The tests cover known company-number examples, personal IDs, padding, separators, invalid prefix/check digits, empty/all-zero input and not reflecting raw numbers in warnings. **This is a formatting feature, not a tax compliance approval.**
