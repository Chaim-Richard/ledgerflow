# E-15 — EU and UK VAT-number structural warnings

**Status:** pure/read-only checks. Format matches are *not evidence of an assigned or active registration*. No VIES/HMRC API request, tax posting, return submission, registration storage or customer-form edit occurs in this branch.

## Source and verification contract

The European Commission states that VAT-number structures differ by Member State and that national authorities issue the numbers. The VAT Information Exchange System (VIES) reads national registers; matching a pattern locally does **not** produce a VIES confirmation or a cross-border tax exemption. HMRC similarly distinguishes UK registration numbers from mere formatting. For any actual transaction requiring verification, AI #1 must use an approved, server-side VIES/HMRC workflow and retain the resulting response, query time, number's country and entity metadata for review.

- [European Commission — country-specific VAT information and format reference](https://taxation-customs.ec.europa.eu/taxation/vat/vat-directive/vat-rates/country-specific-information-vat_en)
- [European Commission — VIES verification](https://ec.europa.eu/taxation_customs/vies/)
- [Your Europe — what a valid or invalid VIES response means](https://europa.eu/youreurope/business/finance-and-tax/vat/check-vat-number-vies/index_en.htm)
- [HMRC — ordinary UK registration format](https://www.gov.uk/hmrc-internal-manuals/vat-registration-manual/vatreg03700)
- [HMRC — special government registration formats](https://www.gov.uk/hmrc-internal-manuals/vat-government-and-public-bodies/vatgpb9400)
- [HMRC — distinguishing format from active registration](https://www.gov.uk/hmrc-internal-manuals/enquiry-manual/em3058)

## Code contract

`src/lib/tax/vatNumberFormat.ts` exports `checkVatNumber(value, selectedCountry)`, `vatFormatWarning(result)`, `maskVatNumber(value, selectedCountry)`, `VAT_COUNTRIES` and `VAT_COUNTRY_FORMATS`.

Supported countries: all 27 EU Member States, plus `GB` and Northern Ireland `XI`. The selected country must come from a trusted tax-country picker or verified tax place. `GR` is mapped to the Greek VAT code `EL`; `UK` is an input alias for `GB`. Never collapse `GB` into `XI`; their registration verification channels differ.

The helper accepts an optional matching national prefix, human spacing/dots/hyphens, and the country-specific local pattern. Incorrect prefixes are warned; unknown countries are unsupported; empty strings produce no warning. All results contain only a static problem reason or **masked** suffix, never the full input. Particularly short national identifiers (for example Romanian two-digit patterns) are completely obscured instead of exposing all digits.

The patterns are intentionally **structure-only**. They do not claim all national checksum algorithms have passed and do not implement the many national exception/legacy registries; ambiguous cases must go to review. The `reviewedOn` source metadata is a reference snapshot date, **not** a statutory `validFrom` or `validTo` for a VAT registration. It does not modify the entity fact or rule graph.

### Examples

```ts
checkVatNumber('DE123456789', 'DE');
// { status: 'valid-format', country: 'DE', masked: 'DE••••6789', problem: null }

checkVatNumber('EL123456789', 'GR');
// { status: 'valid-format', country: 'EL', masked: 'EL••••6789', problem: null }

checkVatNumber('GB123456789', 'DE');
// { status: 'warning', country: 'DE', masked: null, problem: 'country-mismatch' }
```

## Handoff to Claude (AI #1)

`src/components/common/PartyModal.tsx` is explicitly in AI #1's reserved lane. Its customer VAT number field currently accepts any country and is not connected to these warnings. Please:

1. Keep the original typed input and saved metadata untouched. Determine the actual customer's tax country, from an explicit country selection, before applying the E-15 helper; no country means an optional blank/selection reminder rather than guessing from a prefix.
2. Show `vatFormatWarning(checkVatNumber(vatNumber, taxCountry))` below the field as an accessible **nonblocking** warning. Validate again when country changes or a new contact opens; do not block saving other contact fields or silently rewrite the number.
3. Save only fields already approved by server allowlists. Protect sensitive identifiers from read-only activity logs, AI messages and unrelated exports; use `maskVatNumber` for read-only views.
4. For tax decisions and legal use, verify through the applicable national authority or VIES. The helper's `valid-format` is strictly insufficient for exemption, reverse charge, filing or credential approval.
5. Add form tests for edits, wrong-country warnings, missing country, keyboard navigation and reset on workspace/contact switch. AI #5 has no authority to edit PartyModal or posting code in this task.

E-15 is **partial until these customer-form warnings are integrated**. No type was added to a customer schema, and no tax rate, posting or tax return code changed. Tests in `src/tests/vat-number-format.test.ts` cover all country pattern entries, special formats, mistaken prefixes, short-number privacy, placeholders, Unicode, and read-only behavior.
