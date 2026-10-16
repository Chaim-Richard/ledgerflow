# Agent #3 (Arena) — FINAL status and launch list, 16 October 2026

**This document is the final list for AI #3's queue.** It records what is finished, what is partial
and what is still open, with the exact evidence. Read together with
[`docs/COORDINATION.md`](../COORDINATION.md) → "AI #3 (Arena): tasks" (the queue itself) and
[`agent3-warehouse-audit-2026-10-16.md`](agent3-warehouse-audit-2026-10-16.md) (the earlier scoped
warehouse batch, PR #140, merged).

## 1. What this session shipped (batch 12, branch `arena/8f84f1e9-ledgerflow`)

Four launch-useful, read-only additions, each with a pure library, a screen on the Reports tab and
tests. **No money calculation, posting path, server route, database migration, quality budget or
screenshot baseline was touched.**

| Task | What a user can now do | Library | Screen | Tests |
|---|---|---|---|---|
| **A-184** Document number gaps | See, per series (invoice, bill, credit note, estimate), the numbers missing between the first and last recorded number and any number recorded twice | `src/lib/documentNumberGaps.ts` | `DocumentNumberGapsReportView.tsx` → Reports → **Document Number Gaps** | `document-number-gaps.test.ts` (7), `document-number-gaps-view.test.tsx` (4) |
| **A-186** 13-week cash forecast | 13 weekly buckets of expected money in (open invoices), out (open bills, recurring) and a projected balance from a starting cash amount the reader types | `src/lib/cashForecast13Week.ts` | `CashForecast13WeekView.tsx` → Reports → **13-Week Cash Forecast** | `cash-forecast-13-week.test.ts` (9), `cash-forecast-13-week-view.test.tsx` (4) |
| **A-188** Vendor 1099 readiness | Posted outgoing payments per vendor for a year against the existing 1099 threshold, with the missing tax ID, address or 1099 marking named | `src/lib/vendor1099Readiness.ts` | `Vendor1099ReadinessReportView.tsx` → Reports → **Vendor 1099 Readiness** | `vendor-1099-readiness.test.ts` (7), `vendor-1099-readiness-view.test.tsx` (4) |
| **A-195** Duplicate bill finder | Candidate duplicate bills: one vendor, one currency, exactly the same amount, within a three-day window, with a shared number/order reference shown as stronger evidence | `src/lib/duplicateBills.ts` | `DuplicateBillsReviewView.tsx` → Reports → **Duplicate Bill Review** | `duplicate-bills.test.ts` (7), `duplicate-bills-view.test.tsx` (4) |

Registry and reachability wiring: `VIEW_COMPONENTS` + `REPORT_TABS_REGISTRY` entries, four
`SCREEN_HELP` entries (2–4 sentences each), four rows in
[`docs/CAPABILITIES.md`](../CAPABILITIES.md) (186–189, "Available with limits"), and four mount cases
in `e2e/view-registry-coverage.spec.ts` so GitHub's Playwright job proves each screen opens with no
error boundary, no `NaN` and no new serious axe violation.

**Honest limits stated on every screen** (this is an accounting system; an over-claim is a defect):

- A number gap is *not* proof that a document was deleted; drafts, voids, cancellations and
  rejections are excluded and counted, so a legitimate draft can explain a gap.
- A duplicate-bill pair is a question to check, not a finding; two real deliveries can match. The
  screen never merges, edits or deletes, and no other currency is converted.
- A cash forecast is arithmetic on recorded documents, not a prediction: it assumes customers pay on
  the due date, models no payment history, seasonality or new business, counts rather than converts
  another currency, and lists (never guesses) a recurring rule whose accounts do not resolve which
  way the money moves and which is therefore left out of the weekly totals.
- 1099 readiness shows a tax ID as a **mask only**, never assumes a country that is not recorded, and
  states that this workspace has no W-9 field, so it claims no form is on file. Postings only; bills
  that were never paid are not a payment.

## 2. Checks run on this batch

Environment: Node 22.22.3, npm 10.9.8, `LF_TEST_DATABASE_URL` unset (no local Postgres in this
sandbox, so the RLS/database suites are GitHub's).

- `npx tsc --noEmit -p tsconfig.json` — **pass**.
- New tests, all eight files — **46/46 pass**.
- Full local unit suite (`node --import tsx --test --test-concurrency=4` over the same globs as
  `npm test`) — see §5 for the final run.
- `npx eslint . --max-warnings 212` — **0 errors / 210 warnings, unchanged from main** (cap 212).
- `npm run build` — **pass** (client/PWA + server bundle).
- Quality ratchet, capabilities guard, table-a11y guard, reachability guard, ledger-collections
  guard, screen-help, money-format guard, store-selector guard, effect-cleanup guard, orphan-module
  guard — **pass**. (The ratchet caught one real regression during development — a `key={week.index}`
  — and it was fixed, not baselined.)
- Not run here: Playwright (no browser in the sandbox) and the database/RLS suites. Both run on
  GitHub for this branch; the job-level result is reported in the PR and in the coordination message.

## 3. The queue at a glance (218 A-tasks)

| State | Count | Meaning |
|---|---|---|
| `[x]` done | **100** (96 before this batch) | Reachable on a screen with tests, or explicitly completed by AI #1/another agent and reconciled |
| `[~]` partial | **10** | Real work landed; a named remaining step needs the reserved lane (see §4) |
| `[ ]` open | **108** | Not started; §4 groups them by what they need |

## 4. The partial tasks, with exactly what is missing

| Task | What works today | What is still missing (owner / AI #1) |
|---|---|---|
| A-19 item bundles | Parts editor, bundle library, tests | Expanding a bundle into invoice lines inside the reserved `InvoiceModal`/invoice line flow |
| A-32 units of measure | Unit definitions, conversions, item editor | Unit conversion shown on invoice/estimate lines (reserved sales forms) |
| A-33 serial/lot capture | Lookup screen on Reports | Recording serial/lot numbers on receipt/invoice lines (reserved document forms) |
| A-66 RMA approval authority | UI enforces a different-requester owner/accountant decision | Server-enforced transition + compare-and-swap/immutable history (issue #143) |
| A-69 credit limits | Limit editing, report screen | The credit-limit warning inside the reserved `InvoiceModal` |
| A-70 dunning | EN/HE preview, 7/21/45 schedule, CSV | Actually sending, the once-per-step log and the stored schedule need the reserved server email path |
| A-203 accessibility sweep | All four warehouse panels pass zero serious/critical axe checks | The same sweep over every other screen this agent built |
| A-204 phone sweep | Warehouse panels verified at 390px and 320px | The same sweep over every other screen this agent built |
| A-205 Hebrew sweep | Warehouse panels tested in Hebrew document mode with real CSV download | The same sweep over every other screen this agent built |
| A-208 handoff inventory | The three `[~]` audits and six implementation handoffs are written down | Reserved-owner work listed in this table |

**Blocked before implementation: A-72** (entity-filtered customer statements). `loadStatement`
always produces an all-history, all-entity PDF, so a browser-only entity filter would silently send a
statement with the wrong scope. Tracked as issue #141; AI #1 must define the entity contract shared
by screen, PDF and email.

## 5. The 108 open tasks, grouped by what they need

1. **Tax content packs (needs no server work): A-81…A-109, A-156…A-167.** US state rate packs, other
   countries' VAT/GST packs, payroll and threshold tables, per-diem/mileage tables. Each is dated
   rules with an official source and a golden test — the pattern A-110/A-111 and the existing packs
   already establish. This is the largest block of immediately startable work.
2. **Inventory and warehouse screens (mostly screen-only): A-112…A-117, A-140.** Serial capture,
   lot/expiry, transfers, min/max, kits, valuation by location/lot, aged inventory by lot. Postings
   stay AI #1's; the reports and documents are AI #3's.
3. **Purchasing, sales, projects, assets, documents (screens/reports): A-119…A-139, A-178…A-185.**
   Vendor quote comparison, PO approval thresholds, back-order release, customer item codes,
   commissions, shipping rates, timesheet approval, project templates, retention, asset
   disposal/transfer/maintenance, numbering rules, email templates, contact roles, bank-holiday and
   bank-code tables, IBAN/routing validation.
4. **Reports and data-quality checks whose data already exists: A-186 (done), A-187…A-197.**
   Aged receivables by salesperson, 1099 readiness (done), Israeli annual summary, top-20 trends,
   expense by employee, inventory turnover, margin by item group, entries missing required labels,
   duplicate bills (done), missing tax IDs/addresses, items without cost or price.
5. **Golden fixtures and help: A-145…A-149, A-198…A-202.** Full-year fixture sets (IL, US-TX, UK),
   the auditor export pack, per-screen help and "what does this number mean".
6. **Journeys (cross-screen, P2): A-150…A-155.** First hour, month-end checklist, Israeli month,
   US quarter, migration totals, accountant queue.
7. **Manufacturing light: A-168, A-169.** Bill of materials and a work-order screen (posting AI #1's).
8. **Audits and cleanup: A-203…A-209** (partial, see §4), plus A-206 performance and A-207 removing
   any library still unreachable from a screen.
9. **Owner decisions / reserved lane (not AI #3's): A-72** (statement scope, issue #141) and anything
   in §4.

## 6. What is *not* claimed

- This is **not a whole-system launch sign-off**. It is one agent's queue status with evidence.
- The main-branch CI **Playwright E2E job is red** (issues #136 mobile visual baselines, and older
  expectations), so "main is green" is not true and is not claimed. The E2E gate for this branch is
  GitHub's job, and its result is reported with the PR; a preview deployment is not release approval.
- No production database was inspected. Two migrations already on `main`
  (`20261014010000_unique_asset_tags.sql`, `20261014020000_workspace_custom_fields.sql`, and
  `20261015000000_purchase_order_blanket.sql` from the previous batch) still need applying/confirming
  in the deployed database; the screens say so when their saves are refused.
- Financial truth stays with AI #1: no posting, journal, tax calculation or valuation behaviour was
  changed by this batch, and none of these screens writes a financial field.

**Final for this batch:** the four tasks above are complete, tested and pushed on
`arena/8f84f1e9-ledgerflow`; the queue itself is the source of truth for what remains.
