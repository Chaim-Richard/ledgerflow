# E-9: PCN874 historical layout fixture writer

This is **not a live-filing exporter**. The pure helper `src/lib/tax/pcn874Draft.ts` formats a typed list of documents into a fixed-width `O` header, document records and `X` closing record. The header aggregates from those exact document fixtures. The outputs always declare `filingReady: false`.

**Reference:** Israel Tax Authority archived English PCN874 Appendix A: https://www.gov.il/BlobFolder/generalpage/tax-vat-online-invoice-reporting/ar/IncomeTax_IncomeTaxSoftwareHousesInfo_874-eng.pdf (historical document dating to 2010; current acceptance not verified).

- Header: **131 characters**; one transaction: **60 characters**; closing: **10 characters**, CRLF-separated.
- Numeric fields are left-zero-filled; invoice group four ASCII characters; type/sign, nine-digit IDs, eight-digit dates, and record counts are checked.
- Source fixtures must explicitly classify sales vs inputs, input equipment vs other, and provide rounded whole-NIS figures. **No VAT rate, tax treatment or exchange conversion is guessed.**
- Output is intentionally **not** wired into any production submission screen, because 2026 Tax Authority requirements (including invoice allocation numbers, exceptions and any revised record layouts) require primary-source confirmation. It also does not assert check-digit or taxpayer eligibility.
- Before release: compare byte-for-byte with current official golden files, connect AI #1's authoritative `israelVatDocuments` source, reconcile signed header totals to a closed period, and obtain accountant/Tax Authority validation.

Tests validate field sizes, signs, counts, padding and rejection cases. A structural unit test is not sufficient for official filing acceptance.
