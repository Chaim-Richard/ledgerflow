# E-11: read-only state/local rate table adapters

These pure adapters accept already-parsed tabular data from the published jurisdiction files or reviewed transcriptions. Output shape: `{ state, jurisdiction, rate, validFrom, source, basis, code?, zip?, zip4Low?, zip4High? }`. `rate` is a *fraction* (10.75% = 0.1075), and `validFrom` is explicitly supplied from the effective date of the source edition. Invalid rows carry source-relative line numbers; nothing is quietly guessed. The adapters never write to the database or calculate transaction taxes. **`readyForTaxCalculation: false` on every result.**

| State | Official publication | Accepted reviewed table columns | Important limitation |
|---|---|---|---|
| TX | https://comptroller.texas.gov/taxes/sales/city.php | Name, Local Code, Local Rate, Total Rate | A `Total Rate` is combined, while a row without it is a separate local component. Do not sum both. Texas issues XLSX rate tables. |
| CA | https://cdtfa.ca.gov/taxes-and-fees/sales-use-tax-rates.htm | Location, Rate, County, Type | Official city/county rates are downloadable in XLSX. Some communities and boundaries are omitted; rates are percentage strings. |
| NY | https://www.tax.ny.gov/pubs_and_bulls/tg_bulletins/st/sales_tax_rate_publications.htm | County or other locality, Tax rate %, Reporting code | PUB 718 is a publication/PDF, **not** a machine-readable ZIP boundary lookup. A reviewed table conversion is necessary. |
| WA | https://dor.wa.gov/taxes-rates/sales-use-tax-rates/downloadable-database | ZIP, ZIP+4 Low, ZIP+4 High, Location Code, Rate | WA supplies quarterly compressed ZIP/ZIP+4 rate databases. Validate the extracted file's actual column order/header against its published field definitions; ZIP alone can be insufficient. |
| CO | https://tax.colorado.gov/DR1002 | Jurisdiction, Sales Tax Rate, Location Code | Colorado DR 1002 lists state, local and special-district *components*. Many home-rule cities administer their own tax. A PDF-to-rows extraction is NOT automatic and is incomplete for self-collected cities. |

## Before enabling a tax lookup

1. Read the state authority's latest published raw layout/edition and check at least 3 real records per state, including rate boundary cases.
2. Import ZIP/address boundary geometry and jurisdiction precedence; **a ZIP code is not a reliable universal location selector**. Never silently choose by five-digit ZIP alone if multiple authorities apply.
3. Mark whether a row is a component or combined rate and prevent double counting. Handle exemptions, taxability, special districts, holidays, origin/destination sourcing and effective/end dates.
4. Attach `validFrom`/`source` to every rate, add old-version retention and official golden tests, then connect to Claude's state/local rate lookup.
5. Reject a data import containing unrecognized headers rather than quietly interpreting values. A test of parsed fixture headings is not proof of compatibility with the downloaded official XLSX/ZIP/PDF file.

This PR delivers five **staging adapters**, not five production-ready state tax engines.
