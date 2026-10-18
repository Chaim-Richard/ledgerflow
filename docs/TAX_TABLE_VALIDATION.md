# Tax table structure checks (D-26, AI #4)

Run `npm ci`, then `npm run check:tax-tables`. The command exits nonzero on invalid rows and prints the file, export, row and rule. Its focused contracts also run in the normal unit suite (`npx tsx --test src/tests/tax-table-validator.test.ts`).

The catalog declares 24 table contracts across the existing tax directory. It imports actual exports, including generated product/digital/marketplace rows, rather than copying expected values. Every module is classified; new modules and unclassified structured tax exports fail discovery. Application vocabularies, derived state lists, import functions and calculation/document/profile helpers are not dated legal tables.

Checks cover real ISO calendar dates (including leap days), reversed ranges, source URLs, authority/retrieval metadata where supplied, explicit units and inclusive date overlap within each declared tax scope. Bounds are 0–1 for fractions, 0–100 for percentages, and nonnegative safe integers for monetary amounts. Allocation thresholds use money units even though their legacy field is named `rate`. An absent optional rate is allowed for an unclear/exempt treatment; a reduced treatment needs its rate.

Histories are grouped by jurisdiction and the table's actual category: province/kind, state/category, country/kind/application, withholding payment/residence/payee kind, registration scheme/window, and so on. Independent simultaneous categories are allowed. A range ending February 29 may be followed by March 1; a shared boundary day overlaps. Open ends overlap subsequent versions; unsorted/nested intervals are checked too. Holiday bands retain publication windows and separate band identities. Annual W-2 reference rows use the stated calendar year. VAT identifier patterns have review dates, not invented legal effective dates; their sources and review dates are checked separately.

The validator does not fetch authority sites, verify their contents, prove completeness of historical rates, or certify legal correctness. Existing international tables receive structural checks only; this adds no countries, rates, payroll calculations or filing capability. Per PLAN §15, controlled-beta correctness remains US/Israel only; already-built expansion packs remain unverified.

To add or change a table, edit its original data in the owning lane, declare its export, business identity, units and date shape in `scripts/tax-table-catalog.ts`, and run the command. If a module has no embedded source table, record its reason in `NON_TABLE_MODULES`. Never group history by a version-specific ID just to hide an overlap. Never alter a financial value merely to make this checker pass: hand the source finding to AI #1.

Verification status: implementation prepared; local execution environment is still starting. GitHub's existing full gates will verify the branch; no local test pass is claimed yet.
