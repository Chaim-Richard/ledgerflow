# E-11: State and local sales-tax rate importers — controlled staging

**Status: staging only, NOT APPROVED FOR TAX CALCULATION OR FILING.** The adapters in src/lib/tax/stateLocalRateImporters.ts normalize *already extracted and reviewed* tables. They do not download files, parse native XLSX/ZIP/PDF, locate a taxable address, decide product taxability, or post money. The output field readyForTaxCalculation remains **false**, even when no issues are returned.

## Source authority and reviewed-intermediate input

| State | Official authority | Accepted reviewed input | Not covered |
| --- | --- | --- | --- |
| TX | [Texas Comptroller](https://comptroller.texas.gov/taxes/sales/city.php) | Name, Local Code, plus Total Rate or Local Rate | City/county/special-district geography, sourcing, and overlaps. Total Rate is combined, never added to components. |
| CA | [CDTFA](https://cdtfa.ca.gov/taxes-and-fees/sales-use-tax-rates.htm) | Location, percentage-point Rate | County, district, address boundaries, and transaction applicability. |
| NY | [New York Tax Department](https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/sales_tax_rate_publications.htm) | Locality, Tax rate %, Reporting code | Publication 718 is not an address-to-rate file; product-specific publications may differ. |
| WA | [Washington DOR](https://dor.wa.gov/taxes-rates/sales-use-tax-rates/downloadable-database) | **Reviewed joined** ZIP5, ZIP+4 low/high, Location Code, fractional Rate | DOR publishes separate quarterly geography and location-code/rate files. Verify joins and exact address applicability. |
| CO | [Colorado DOR](https://tax.colorado.gov/DR1002) | Jurisdiction, percentage-point Sales Tax Rate | Home-rule cities and other local authorities may have separately administered tax; individual components cannot be blindly summed. |

These column names describe **reviewed intermediate tables**. They do not claim that raw state XLSX, ZIP, CSV, or PDF files use the same headings. Preserve original bytes of each official edition and track their source URL, acquisition date, SHA-256, publisher-effective start/end dates, edition ID, extraction method, and reviewer separately. An official landing-page URL alone is not proof of a particular data edition.

## Invariants enforced here

1. Validate required columns and reject duplicate headings before parsing any records; report missing or invalid cell values with one-based source row numbers.
2. Keep rates as fractional numeric values, not percentage points. TX/WA bare numbers mean fraction; CA/NY/CO bare numbers mean percentage points; an explicit percent sign is honored. Automatic guesses based on a number's magnitude are prohibited inside these importers.
3. Preserve official source URL, effective start date, nullable effective end date, optional edition, jurisdiction, component-versus-combined status, codes and ZIP+4 intervals. A null end date is **unknown**, not everlasting.
4. Washington ZIPs must have five digits and complete four-digit ZIP+4 lower/upper bounds with a location code. Preserve leading zeroes. Flag overlapping ranges. Duplicate source rows are rejected.
5. Fail closed: a parsed preview is never authorized for live tax; no valid rows generates an issue; **any issue blocks promotion of the complete publication**. Never silently import just the successful rows into the authoritative database.
6. The rate ceiling (20%) is a defensive unit sanity check, not a statement of any jurisdiction's legal maximum.
7. A combined rate must never be added to its own components. Colorado component records are not full customer-level rates.

## Claude (AI #1): work outside the AI #5 scope

**Source acquisition / history:** Build safe, versioned downloads for the official XLSX/ZIP tables and reviewed PDF conversion. Validate transport, file types and byte counts; defend against decompression bombs and ZIP traversal. Retain immutable raw files and hashes, preserve old editions, log changes in source layouts, and refresh at the publisher's cadence (Washington quarterly).

**Verified geographic resolver:** Add address verification and jurisdiction boundaries, including city/county/district membership and home-rule Colorado. ZIP5 or ZIP+4 is not universally sufficient. For an ambiguous customer address, return a clear needs-review outcome, never invent the rate.

**Authoritative money path:** Only Claude's shared server tax engine resolves state/county/city/special districts, seller nexus, marketplace responsibility, origin-versus-destination, product taxability, exemptions/certificates, holidays, shipping, and local filings. Use the publication effective date and jurisdiction hierarchy; never add combined rates to components. Calculate and post once, with exact money rounding. Historical posted documents, credits, refunds and returns must preserve original tax decisions and provenance.

**Promotion / operations:** Stage and validate entire editions atomically. Compare row counts, rates, interval overlaps and changes against the prior edition, then require approved golden examples and accountable sign-off. Reject stale or incompatible sources, monitor updates and failures, and provide an audited rollback path.

## Required acceptance tests before production

- [ ] Real official source edition from each state checked for layout, release date, raw-file checksum and relevant ranges.
- [ ] Three or more independently checked official data examples per state, including geographic boundaries and changes across effective dates.
- [ ] Missing/duplicate headings, ambiguous rate units, reversed or overlapping ZIP+4 ranges, invalid effective dates and empty files reject promotion.
- [ ] Cross-boundary address and district applicability tests: no ZIP-only guessing and clear needs-review outcome.
- [ ] Combined-versus-component tax tests, plus taxability, nexus, exemption, marketplace, sourcing and specialty rules in Claude's engine.
- [ ] Atomic promotion and safe rollback; old period documentation unaffected by a new publication.
- [ ] Full TypeScript, unit, database, browser, integration and performance verification in a checked-out repository.
- [ ] Review by Claude and a qualified state-tax professional before removing any tax-not-ready warning or issuing filings.

## Handoff

AI #5 owns staging adapters, validation fixtures and documentation. AI #1 owns source import orchestration, schema, server-side lookup, jurisdiction decisions and postings. This PR must not be merged as proof that US local sales tax is compliant or filing-ready. See docs/PLAN.md and docs/COORDINATION.md.
