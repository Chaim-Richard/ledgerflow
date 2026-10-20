# AI #9 — CON-1 US sales-tax table and item taxability on the invoice

AI #1's decisions (20 Oct): option 1, where the invoice suggestion reads the items' tax categories, suggests a rate when
all lines agree and says "mixed" otherwise, with no change to tax maths or posting. Supported states: TX, CA, NY,
WA, CO. Every other state is labelled "not verified", and the screen says whether local rates are included. Builds on
#234 (the same suggestion component).

**What changed**
- `src/lib/tax/usInvoiceTax.ts`:
  - `usInvoiceTax` answers for the whole invoice:
    - `rate`: every line is taxed alike;
    - `mixed`: the lines' categories have different rates;
    - `confirm`: a category the state's taxability table marks *unclear*, or an unknown category;
    - `none`: no permit, export or certificate, the same as before.
  - It reads the state rate and product exemptions from the rule packs (137, 139) through `resolveLineTax`.
  - `lineTaxCategory` gives each line its item's category: from the linked item, or else from the item named on the
    line, because a service item fills the name only and stays unlinked. A service item with no category counts as
    Services; a free-text line counts as general goods and the screen says so.
- **Invoice suggestion.** It states the rate and its parts. For a single rate it also says "the TX state rate only: city, county and district rates are not included" (no local rows are loaded
  at runtime today), and outside the five states "Not verified". Mixed and unclear lines get no rate button.
- `InvoiceModal.tsx`: one prop (`lineCategories`) and one import, named here as AI #1 asked.

**Why "confirm" exists.** The rule packs give the full state rate for categories the taxability table marks unclear
(TX and CA services, NY clothing and groceries…). Suggesting that rate would state a guess as an answer.

**Worked figures** (`src/tests/con1-us-invoice-tax.test.tsx`):
- Texas general goods: 6.25%, so $1,000.00 carries 6,250 cents.
- With Austin's 2% city row loaded: 8.25%, so 8,250 cents, and "local rates included".
- Texas groceries: 0%. Groceries plus general goods: mixed (0% / 6.25%).
- California SaaS: 0%. Illinois general: 6.25%, not verified.
- New York with no permit: no tax.

**Found, not changed (Illinois is not a supported state):** the packs give Illinois groceries 6.25% + 1% = 7.25%,
when Illinois taxes groceries at a reduced 1% that replaces the 6.25%. Raised under Messages.

Release gate: W8. The invoice now uses the state table and item taxability for the supported states; W8 stays Partly
(CON-2, local rows).
