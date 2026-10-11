# US 1099 draft review, not a filing export (E-10)

`src/lib/tax/us1099Preview.ts` prepares read-only **1099-NEC** and selected **1099-MISC** box summaries plus a **1096 transmittal *review* summary** from *already-authoritatively-aggregated* vendor payment amounts supplied as typed inputs. The helper does not find/verify the vendor's tax treatment; it never posts money, stores complete tax IDs or fabricates missing W-9 details.

**Thresholds:** 2025 or earlier payments $600 for ordinary NEC / MISC rents and miscellaneous income, rising to $2,000 for 2026. Exceptions: MISC box 2 royalties $10 and MISC box 10 attorney gross proceeds $600. These are only a subset of IRS rules; backup withholding, corporate exceptions, other reportable boxes and corrections require separate handling.

Sources:
- https://www.irs.gov/businesses/small-businesses-self-employed/am-i-required-to-file-a-form-1099-or-other-information-return
- https://www.irs.gov/instructions/i1099mec
- https://www.irs.gov/filing/e-file-information-returns-with-iris

**Not a full E-10 release.** LedgerFlow's existing `src/lib/algorithms/compliance-1099.ts` currently produces formatted preview totals and does not guarantee complete payment history. The vendor W-9 fields and storage are still assigned to AI #1; do not parse formatted amounts or use fuzzy names for actual filings. The IRS IRIS portal requires year/form-specific upload templates (Publication 5717); our `us1099ReviewCsvRows` explicitly labels its output *NOT IRIS*. No official file, printable statutory form or tax-authority submission is connected by this PR. Review/approve the complete figures, then map to the current official forms and current IRIS templates with golden tests.

The 1096 summary is a total/count for human review, not the actual printed IRS Form 1096. Testing a threshold alone does not make a filing compliant.
