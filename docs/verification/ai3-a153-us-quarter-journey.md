# A-153 — US quarter journey (AI #3, 18 October 2026)

**Task:** [A-153 in `docs/COORDINATION.md`](../COORDINATION.md) — "Journey: US quarter — sales tax by
state → return screens → 1099 preview → quarter close checklist (P2-4)". The 18 Oct plan (PLAN §15)
put A-153 next in my lane after A-146/A-147; it moves the **W8** row of
[`docs/RELEASE_GATE.md`](../RELEASE_GATE.md) ("US quarter: sales tax by state → summary → 1099
preview → close").

**Branch:** `arena/f5106a05-ledgerflow`, from `main` `26d3275`.

## 1. What was built

One read-only screen, **Reports → US Quarter Journey**
(`src/components/reporting/UsQuarterJourneyReportView.tsx`), over the pure library
`src/lib/usQuarterJourney.ts`. It walks a US quarter end to end and, for each step, says what the
recorded data shows and opens the screen that does the work:

| # | Step | Screen it opens | Figure source (unchanged, reused) |
|---|---|---|---|
| 1 | Sales-tax permits for the quarter | Settings → Tax profiles | `registrationsOn` / `registrationKey` (`src/lib/tax/profile.ts`) |
| 2 | Sales tax by state (one return per permit) | Reports → Tax return | `usSalesTaxReturn` (`src/lib/tax/usSalesTaxReturn.ts`), `filingDueDate` (`usFilingCalendar.ts`), `nexusThreshold` (`usNexus.ts`) |
| 3 | Use tax on out-of-state purchases | Reports → Use tax review | `reviewUseTax` (`src/lib/tax/usUseTax.ts`) |
| 4 | Exemption certificates behind zero-tax sales | Reports → Customer tax certificates | `exemptionOn` (`src/lib/taxExemption.ts`) |
| 5 | 1099 preview for the tax year | Reports → Vendor 1099 readiness | `vendor1099Readiness` (`src/lib/vendor1099Readiness.ts`) → `threshold1099Cents` (`us1099Preview.ts`) |
| 6 | Close the quarter's months | Month-end close | the workspace's own lock settings through `monthCloseState` (`src/lib/periodLock.ts`) |

No second rule is invented: every money figure on the screen is produced by the library the target
screen already uses, so the journey and the return screen cannot disagree. Nothing posts, files,
pays or closes anything.

Two facts are read live rather than assumed: **which months are closed** comes from the workspace's
own lock settings through `monthCloseState` (the same pure rule the Month-End Close screen shows),
and **"recorded as filed"** comes from `GET /api/v1/workspaces/{id}/tax-returns` — the filed returns
the return screen itself keeps on the server. Until that read settles the screen says it is loading
rather than claiming a return is unfiled, and a failed read leaves the column as "Not recorded here"
instead of guessing.

## 2. Worked figures (the test's own arithmetic, hand-checked)

`src/tests/us-quarter-journey.test.ts` (14 cases). The Texas entity holds permit 3200; the quarter
is Q3 2026 (1 Jul – 30 Sep 2026). A document's `amountCents` is its tax-inclusive total, so the net
is the amount less its tax:

| document | date | customer | amount | tax | treatment |
|---|---|---|---|---|---|
| i1 | 10 Aug 2026 | Austin | 1,000.00 | 82.50 (state 62.50, Austin 20.00) | taxable |
| i4 | 5 Jul 2026 | Austin | 200.00 | 16.50 (state 12.50, Austin 4.00) | taxable |
| i2 | 15 Aug 2026 | Houston | 500.00 | 0 (resale certificate to 31 Dec 2027) | exempt |
| i6 | 1 Sep 2026 | Dallas | 300.00 | 0 (certificate ran out 31 Dec 2025) | exempt, **expired** |
| i7 | 10 Sep 2026 | Dallas | 250.00 | 0 (no certificate) | exempt, **missing** |
| c1 | 25 Aug 2026 | credit to Austin | 100.00 | 8.25 (state 6.25, Austin 2.00) | reduces the quarter |
| i3 | 20 Aug 2026 | California | 1,000.00 | 0 | another state — not this return |
| i5 | 1 Oct 2026 | Austin | 100.00 | 8.25 | next quarter |
| i8 | 30 Jun 2026 | Austin | 50.00 | 4.13 | previous quarter |

Result, asserted literally: **gross 2,150.00 · exempt 1,050.00 · taxable 1,100.00 · tax collected
90.75 · 6 documents · Austin 22.00 · Texas state 68.75**. Planning due date **20 Oct 2026** (Texas
files by the 20th of the following month; a weekend would move, a holiday is not known here). Texas
economic nexus is revenue only at 500,000.00, so 2,150.00 does not reach it.

Other worked cases in the same file: use tax — one bill with no item category (30,000.00, never
estimated) and one general-goods bill (100,000.00 at the Texas 6.25% state rate = 6,250.00), and the
bill with tax charged is not a candidate; 1099 — the 2026 NEC/MISC threshold is 2,000.00, Ava's
Design paid 2,500.00 (over) and Blue Ridge LLC 1,500.00 (below); certificates — 3 zero-tax sales,
1 missing, 1 expired; close — 2026-07 and 2026-08 soft-closed, 2026-09 still open.

Boundary and honesty cases: a quarter that is not written `2026-Q3` is reported rather than guessed;
a permit that ran out before the quarter and an Israeli VAT registration are not US sales-tax
permits; a quarter with nothing in it owes nothing; a quarter before 2020 says the 1099 threshold
table covers 2020 and later instead of asking a table with no row; the journey's document count is
cross-checked against an independent count of the counted documents; a fully clean quarter is
`readyToClose`, and a closed quarter with unfiled use tax, certificates or 1099 work is **not**.

`src/tests/us-quarter-journey-view.test.tsx` (5 cases) renders the panel: every step is listed with
its status and its button, the return's own figures and the planning due date are shown, a flagged
step is labelled, a return the server recorded is shown as filed (and nothing says "not recorded"),
an unreadable quarter is reported, and a capped list is called provisional.

## 3. What was NOT done (and is not claimed)

- **No browser run here.** Playwright's browsers are not downloadable in this sandbox and GitHub CI
  does not run on pushes. The screen is registered in
  `e2e/view-registry-coverage.spec.ts` (mount, no error boundary, no `NaN`, no new serious axe
  violation), so GitHub's Playwright job is the check that has not been run locally.
- **No database run here.** `LF_TEST_DATABASE_URL` is unset, so the DB/RLS suites skip. This change
  adds no migration and no server route, so nothing in the database lane is affected.
- The journey does **not** know a filing holiday, a marketplace facilitator, a local (city/county/
  district) return, or a transaction-count nexus test, and it never says "you must file".
- CON-1 and CON-2 (the state return screens' own wiring) remain the lead's work; this screen reads
  the same libraries they use but does not finish them.

## 4. Checks run here (18 Oct 2026, this sandbox)

| Check | Result |
|---|---|
| `npm ci` | 1,307 packages, clean |
| `npx tsc --noEmit` | clean |
| `npm run lint:eslint` | **0 errors / 210 warnings** (cap 210, unchanged) |
| `npm test` | **2,856 passed / 0 failed** (731 suites; DB suites skip without `LF_TEST_DATABASE_URL`) |
| `npm run build` | passes (`dist/` + `build/server.cjs`) |
| New tests | 20 (15 pure + 5 view) |
| Guards touched | capabilities-guard, screen-help, view-registry-coverage, ledger-collections, no-orphan-modules, money-format — all green |

Files changed: `src/lib/usQuarterJourney.ts` (new), `src/components/reporting/UsQuarterJourneyReportView.tsx`
(new), `src/tests/us-quarter-journey.test.ts` (new), `src/tests/us-quarter-journey-view.test.tsx`
(new), `src/config/registry.tsx` (VIEW_COMPONENTS + REPORT_TABS_REGISTRY), `src/config/screenHelp.ts`
(English help), `docs/CAPABILITIES.md` (row 191), `docs/COORDINATION.md` (A-153 ticked + message),
`docs/RELEASE_GATE.md` (W8), `e2e/view-registry-coverage.spec.ts` (mount case).
