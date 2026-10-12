# E-16 — US State and ZIP+4 Parsing (Read-only)

**Scope:** parse postal state/region and ZIP from a typed address or free-text address field. No address verification, geocoding, city/county/district boundary check, sales tax calculation, posting, or change to existing customer records.

## Sources

- [USPS Publication 28, Appendix B: official two-letter postal abbreviations](https://pe.usps.com/text/pub28/28apb.htm) — 50 states, DC, eight postal territories/affiliated regions, and three military postal regions.
- [USPS Addressing Mailpieces](https://faq.usps.com/articles/Knowledge/Addressing-Mailpieces) — city, state and ZIP/ZIP+4 convention on the delivery address's final line.
- [USPS ZIP Code basics](https://faq.usps.com/articles/Knowledge/ZIP-Code-The-Basics) — ZIP boundaries and municipal limits need not agree.
- [HUD USPS ZIP crosswalk](https://www.huduser.gov/portal/datasets/usps_crosswalk.html) — ZIP codes can cross political/jurisdiction boundaries, so ZIP-only tax lookup is unsafe.

## API and behavior

`parseUsStateAndZip(address)` in `src/lib/usAddressStateZip.ts` accepts a free-text address (including CRLF/multiline) or typed fields:

```ts
parseUsStateAndZip({
  address: '125 Main Street',
  city: 'Boston',
  state: 'Massachusetts',
  postalCode: '02110-0042',
  country: 'US',
});
// {
//   status: 'parsed', state: 'MA', regionKind: 'state',
//   zip5: '02110', zip4: '0042', postalCode: '02110-0042',
//   issue: null, readyForTaxCalculation: false
// }
```

The result includes `state`, `regionKind`, `zip5`, `zip4`, `postalCode`, an explicit `status` and a short `issue` code. It **does not return raw address text** and never sets `readyForTaxCalculation` to true.

**Rules:**

- Region names can be two-letter USPS abbreviations or exact full state names, **never fuzzy name matching**. Street lines, generic words like “in”, and bare ZIPs are not silently converted into a state.
- Region must occur in a plausible last-line position: before a five-digit ZIP/ZIP+4, or after a comma without ZIP. Spaces, capitalization, line endings, trailing “US”, “USA” or “United States” are supported.
- Leading zeros survive because all postal codes are strings. Parsing does not validate ZIP allocation by USPS.
- Explicit typed region/ZIP fields are compared against the free-text last line. Contradictions, malformed ZIP+4, unknown regions and multiple candidate city/state/ZIP lines return **needs-review**, never silently choose a candidate.
- Country other than US yields `foreign-country`. Military mail (AA/AE/AP) is distinguished from actual states, requiring review. Territories such as PR/VI/GU are distinguished from states.
- Missing state or ZIP yields a partial/needs-review result rather than a tax jurisdiction. A repeated city name or a ZIP prefix does not prove the state.

## Scope boundary for AI #1 and future integrations

1. This pure recognition helper can support address-input suggestions or surface a “review address” warning. **Do not automatically alter `Customer.metadata.taxPlace`**, persisted contacts, invoice ship-to, or historical posted lines from this result.
2. Authoritative address validation/geocoding and dated state/county/city/special district rules remain required for taxation. Jurisdiction can differ within the same ZIP/ZIP+4; location and sourcing rules must be verified separately.
3. The `city` typed field is **not geocoded or validated**; its presence is not sufficient to confirm a rate. This parser does not resolve shipping/origin nexus or taxability.
4. If later wiring the parser into the customer form `src/components/common/PartyModal.tsx`, obtain approval from Claude, its reserved-file owner. Make the warning nonblocking and preserve the saved draft on server refusal.
5. Real USPS address validation / provider APIs, if needed, belong behind an explicit consent/role-aware server integration; the pure parser makes no network calls.

## Tests

`src/tests/us-address-state-zip.test.ts` includes 16 groups covering state code coverage, multi-line/ZIP+4 parsing, full names, typed-field agreement/refusal, multiple address blocks, state-only/ZIP-only inputs, foreign countries, territories and military addresses, privacy, and no tax-readiness claim.

**Status:** A staging parser pending review and CI. Does not qualify tax returns or verify a deliverable address.
