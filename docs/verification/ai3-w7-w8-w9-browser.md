# W7, W8 and W9 — browser evidence for the three AI #3 journeys (19 October 2026)

**Rows:** [`docs/RELEASE_GATE.md`](../RELEASE_GATE.md) —
**W7** (Israel VAT month: invoices with allocation numbers → VAT report → PCN874 → close),
**W8** (US quarter: sales tax by state → summary → 1099 preview → close) and
**W9** (month-end close and reopen). Until this change W7 and W8 had no browser test at all, and W9's
browser column was only partly covered. The three read-only screens are A-151
([close journey](ai3-a151-close-journey.md)), A-152 ([Israel month](ai3-a152-israeli-month.md)) and
A-153 ([US quarter](ai3-a153-us-quarter-journey.md)); this page records the browser test of each.

**Branch:** `arena/e00bed69-ledgerflow`, from `main` `0ace84f` (which carries A-151, A-152 and A-153).

## 1. What was added

| File | Tests | Row | What it drives |
|---|---|---|---|
| `e2e/month-end-close-journey.spec.ts` | 2 | W9 | the real **Month-End Close** view: the read-only Close journey on a month that still has work, then an owner closing a clean month and reopening it |
| `e2e/tax-journeys-browser.spec.ts` | 1 | W7 | the real **Reports → Israel Month Journey** view |
| `e2e/tax-journeys-browser.spec.ts` | 1 | W8 | the real **Reports → US Quarter Journey** view |

Each test mounts the shipped view (not a copy of it) against the app's own Zustand stores, with the
HTTP boundary stubbed by Playwright, so the screen renders the same components, text and money
formatter a user sees. Every API and REST request is answered by the test; nothing is written to a
database.

## 2. W9 — month-end close and reopen

Fixture: workspace `close-browser`, owner role, USD, month **2026-09**.

**Test 1 — a month with work (phone, 390 px).** Two cash accounts, four bank lines (one with no
account), a draft dated 12 Sep, invoice 1001 of 1,180.00 with 180.00 paid, bill 9001 of 600.00, and
two live September journal entries plus one deleted and one dated 1 October. Asserted literally:

| What | Expected |
|---|---|
| steps | all nine, in order, from *1. Reconcile each bank* to *9. Take the report pack* |
| each bank apart | Bank 1000 → 2 lines / 1 unmatched; Bank 1010 → 1 / 0; **Lines with no bank account** → 1 / 1 |
| detail | `2 bank lines of 4 in 2026-09 not matched: Bank 1000 (1), Lines with no bank account (1).` |
| open documents | `1 invoice still open at 2026-09-30, USD 1,000.00 due in USD.` and `1 bill still open at 2026-09-30, USD 600.00 due in USD.` (1,180.00 − 180.00 = 1,000.00; the bill is 600.00) |
| accruals | `1 journal entry dated in 2026-09.` — the deleted one and the October one are left out |
| summary | `2 of 9 steps done · 1 blocking · 2 needing attention · next: Reconcile each bank.` |
| the blocker | the checklist's own draft blocker, shown as **Blocks the close**; **Close 2026-09** and **Soft close** are disabled |
| navigation | **Open Reconcile** sets the app's page to `reconciliation` (`#reconciliation`) — the step opens the screen that does the work |
| layout / a11y | the panel fits 390 px, and a scoped axe scan of `section[aria-labelledby="close-journey"]` finds no serious or critical violation |

**Test 2 — a clean month closes and reopens.** No drafts, bank lines, invoices or bills, so the
checklist is clean; the journey says `5 of 9 steps done · 1 needing attention · next: Lock the month.`
and `2026-09 is open.` The owner clicks **Close 2026-09**; the test asserts the real request
`POST …/periods/2026-09/close` with body `{ "mode": "hard" }`, then the screen shows
**Closed: nobody can post**, the journey's lock step becomes **Done** (6 done, no attention) and says
`nothing in the recorded data blocks the close.` A reason shorter than five characters keeps
**Reopen 2026-09 and later months** disabled; after typing *A supplier bill arrived late* the click
sends `POST …/periods/2026-09/reopen` with `{ "reason": "A supplier bill arrived late" }`, and the
screen is open again with the close button back.

## 3. W7 — the Israeli month (September 2026)

Fixture: ILS workspace, VAT registration `vat:IL:514000000`, filing monthly. Invoice 1001
(10 Sep, business buyer, 11,800.00 including 1,800.00 VAT), invoice 1002 (15 Sep, private customer,
1,180.00 including 180.00), bill 9001 (20 Sep, 2,360.00 including 360.00). Asserted on screen:

- the five steps, in order: registration, allocation numbers, periodic VAT report (form 836
  figures), PCN874 draft, close the month;
- registration `514000000`, taxable sales **11,000.00** and **to pay 1,620.00** (output VAT
  1,980.00 − input VAT 360.00), the same figures the return screen computes;
- `1 invoice(s) need an allocation number: 1 without a usable one (#1001)`, and the allocation table
  says `No allocation number is recorded` — nothing is filled in;
- the PCN874 section says **not filing-ready**, names what cannot be written, and states that
  nothing files, posts, pays or closes;
- **Open Reports → Tax return** sets the app's page to `reports` / `tax-liability`;
- the panel fits 390 px and has no serious/critical axe violation.

## 4. W8 — the US quarter (Texas, Q3 2026)

Fixture: USD workspace, permit `TX 3200`, one invoice on 10 Aug 2026 for 1,082.50 including 82.50
tax (Texas state 62.50, Austin 20.00). Asserted on screen:

- the six steps, in order: permits, sales tax by state, use tax, exemption certificates, 1099
  preview, close the quarter's months;
- `TX 3200`, the planning due date `2026-10-20`, and `Texas state sales tax $62.50` from the
  quarter's own return;
- nothing files, posts, pays or closes;
- **Open Month-end close** sets the app's page to `month-end-close`;
- the panel fits 390 px and has no serious/critical axe violation.

The figures are the ones the libraries already produce (`israelVatReturn` / `usSalesTaxReturn` /
`filingDueDate`), not new arithmetic in the test.

## 5. One accessibility fix found while writing the tests

The three journey panels used `text-amber-600` for **Needs attention**. On the light theme's
`--surface` (#F4F8F7) amber-600 (#D97706) is about **3.2:1**, below the 4.5:1 required for normal
text, so the scoped axe scan would (correctly) fail. They now use
`text-amber-700 dark:text-amber-400` — amber-700 (#B45309) is about **5.0:1** on that surface, and
amber-400 keeps the dark theme readable. This is a colour-only change in
`CloseJourneyPanel.tsx`, `IsraelMonthJourneyReportView.tsx` and `UsQuarterJourneyReportView.tsx`;
no text, figure or behaviour changed.

## 6. Honest limits

- The HTTP boundary is stubbed: these tests prove what a browser renders and what request the screen
  sends, not that a live database accepts it. The server's own close/reopen transitions are covered
  by the existing database tests (`periodCloseService`, run on CI against Postgres, and skipped
  locally without `LF_TEST_DATABASE_URL`).
- The axe scans cover the panels named above, in the light theme only. They are not an app-wide
  accessibility audit and not a dark-theme check.
- The tax figures stop where the screens stop: US amounts are the state base rate with the invoice's
  own recorded local breakdown, the PCN874 layout is the historical draft and is never filing-ready,
  and no live Tax Authority / state filing is involved.
- Nothing here claims W7 or W8 are complete: their **Connected** and **Verified** columns still
  depend on CON-1…CON-4 (AI #1) and the other blockers listed in the release gate. This change only
  supplies the browser evidence column for the journeys AI #3 built.

## 7. How to run

```bash
npm ci
npx playwright install chromium
npm run test:e2e -- e2e/month-end-close-journey.spec.ts e2e/tax-journeys-browser.spec.ts
```

CI runs the same specs in shard 1/2 or 2/2 of the browser job (`npm run test:e2e -- --shard=…`).
