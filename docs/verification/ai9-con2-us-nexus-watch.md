# AI #9 — CON-2 US nexus watch on a screen, from posted invoices

Reports → **US Nexus Watch** (`us-nexus-watch`). The library is `src/lib/tax/usNexusWatch.ts`, built on the A-27
threshold table and `nexusWatch` (capability 138). It is read-only: nothing files, posts or registers.

**What it shows.**
- **Sales per state.** For each US state the customers are in: sales before sales tax, in the home currency, from
  posted invoices less credit notes. It uses the same `taxReturnDocument` figures and `COUNTED_SALES` statuses as the
  sales-tax return.
- **Two windows.** Each state shows its sales and number of sales for this calendar year to the as-of date and for
  the whole previous calendar year, against the state's threshold.
- **Status.** Each state is "Threshold crossed: ask about registering", "At 80% or over: watch" or "Below 80%".
  Crossed states are listed first, then flagged ones.
- **Permit and table columns.** "Permit" means one is recorded on the books or on any entity label. "Table" reads
  "Checked" for TX, CA, NY, WA and CO, and "Not verified" for other states.
- **What is left out.** A customer with no tax place is in no state, and the count of such sales is shown. A sale
  abroad is in no state. Credit notes lower sales but not the count of sales.
- **Wording.** It says plainly that states measure differently, and that this is a watch, never a conclusion that a
  seller must register.

**Worked figures** (`src/tests/con2-us-nexus-watch.test.tsx`, cents, as of 2026-10-20):
- **Texas** ($500,000): $300,000 + $120,000 − $20,000 credit = **$400,000**, 2 sales, so **80% exactly: flagged,
  not crossed**. 2025: $100,000, so 20%.
- **New York** ($500,000 **and** 100 sales):
  - 2025: 120 × $5,000 = $600,000, so **crossed**;
  - 2026: 99 × $6,000 = $594,000, so not crossed (99 < 100) but flagged at 119%.
  - The permit on the NY entity label is found.
- **Illinois:** €25,000 × 1.08 = **$27,000**, so 27%, **not verified**.
- Drafts, a German customer and dates outside 2025–2026 or after the as-of date count nowhere; one sale is unplaced.

Browser: `e2e/us-nexus-watch.spec.ts` (phone width, axe, no horizontal overflow).

**Noted, not changed:** the A-27 `nexusWatch` treats a threshold as met at `>=`, while New York's row says "more
than $500,000 and more than 100 sales". At exactly $500,000 or 100 sales this calls it crossed one sale early. That is
the table's rule, so it is raised under Messages rather than changed here.

Release gate: W8. The nexus watch is now on a screen; W8 stays Partly.

**Review fixes (#241, merged; follow-up PR from main 9bfccab6).**
1. **One currency.** The thresholds are US dollars, so books kept in another currency are refused with the reason.
   Nothing is converted at a guessed rate.
2. **Where a sale went.** A sale counts in its own tax place, then its ship-to state, and only then the customer's
   place. Moving a customer no longer moves its past sales.
3. **A capped customer list** marks the figures provisional.
4. **States with no test** (OR, DE, MT, NH) say "No economic-nexus test in this state", never "Below 80%".
5. **Each selling entity on its own.** Totals and the permit are per selling entity (PLAN §6). Two $300,000 Texas
   entities are 60% each, never one $600,000 crossing. An entity that lists its own registrations does not inherit
   the parent's permit.
6. **The Reports period starts the watch**, and the date field still overrides it.

The merged test's New York sales now carry the NY entity's label, so its permit counts for its own sales, as fix 5
requires. The figures are unchanged.

**#255 review (2 × P1).**
1. **The selling entity comes from the invoice's lines.** Saved invoices keep their labels on their lines. The entity
   is the one all lines name. A sale whose lines name two entities is left out and counted on screen ("left out rather
   than split by a guess"), never pooled. A credit note follows its invoice's entity and destination. Tests: Sub LLC
   $200,000 and Parent $100,000 kept apart, with a mixed $50,000 sale left out; a $30,000 credit on Sub LLC's Oklahoma
   sale gives $170,000 in Oklahoma.
2. **Destination snapshot.** Saved invoices do not yet store their own tax place or ship-to, so a sale is still placed
   by the customer's place as recorded now. The screen now says so. Storing a snapshot at save time touches the
   invoice form and the server's allowed invoice fields, which are outside this lane. It is asked of AI #1 under
   Messages (20 Oct).

**Destination snapshot (#255 finding 2, AI #1's answer of 20 Oct; branch `ai9/invoice-destination`).**
- **When it is taken.** When an invoice is issued (Save & Close or Send), InvoiceModal keeps the customer's tax place in
  `metadata.taxPlace`, using `saleDestinationSnapshot` in `usInvoiceTax.ts`.
- **When it changes.**
  - A draft takes no snapshot; it takes one when it is issued.
  - An issued invoice keeps its snapshot while it stays with the same customer.
  - Moving the invoice to another customer takes that customer's place, or clears the snapshot (null) when they have none.
- **Server.** No change. The invoice schema already keeps `metadata` as sent, and the posting code carries it.
- **Screen.** The nexus watch says that invoices keep their customer's place from the day they were issued, and that
  older invoices without one are placed by the customer's place now.
- **Worked figures** (`src/tests/invoice-destination.test.tsx`). A $300,000 sale is issued while the customer is in
  Austin, TX, and the customer then moves to Tulsa, OK. The watch still counts 30,000,000 cents in Texas and nothing
  in Oklahoma. An older invoice without a snapshot follows the customer to Oklahoma.
- **Lines added to InvoiceModal.** One, plus one name on an existing import line. The file stays at 799 lines.
