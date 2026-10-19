# A-151 — Month-end close journey (AI #3, 19 October 2026)

**Task:** [A-151 in `docs/COORDINATION.md`](../COORDINATION.md) — "Journey: month-end close checklist
screen — reconcile each bank, uncategorised entries, open bills/invoices, accruals reminder, lock
month, report pack; each step links to its screen and shows done/not done (P2-2, read-only checks)".
It moves the **W9** row of [`docs/RELEASE_GATE.md`](../RELEASE_GATE.md) ("Month-end close and
reopen").

**Branch:** `arena/f4208ff9-ledgerflow`, from `main` `f145735`.

## 1. What was built

A read-only **Close journey** panel on **Month-End Close**
(`src/components/ledger/CloseJourneyPanel.tsx`, over the pure `src/lib/closeJourney.ts`). It lists
the month's path in the order the work is done; each step says whether the recorded data shows it
done and opens the screen that does it. Signing off, closing, reopening and the close package stay
where they were — in the checklist and the server behind it.

| # | Step | Status comes from | Opens |
|---|---|---|---|
| 1 | Reconcile each bank | one row per bank/cash account (`resolveAccountRole`) and one for lines with no account; a line is unmatched when pending or with no matched transaction | Reconcile |
| 2 | Give every entry an account | `buildCloseChecklist` item `categorize`, unchanged | Ledger & Journal |
| 3 | Open invoices at month end | `calculateAmountDue` on issued invoices dated through month end; another currency is counted, never converted | Sales |
| 4 | Open bills at month end | the same rule on bills | Purchases |
| 5 | Review accruals and prepayments | the number of journal entries dated in the month — a reminder that decides nothing | Ledger & Journal |
| 6 | Clear the drafts dated in the month | `buildCloseChecklist` item `drafts` — blocker kept as a blocker | Ledger & Journal |
| 7 | Check the trial balance | `buildCloseChecklist` item `trial-balance` — blocker kept as a blocker | Reports → Trial Balance |
| 8 | Lock the month | `monthCloseState` from the workspace's own locks; soft, hard and closed-with-unlocked-dates all count as closed | Month-End Close |
| 9 | Take the report pack | static reminder: the Close package (.xlsx) is built on Month-End Close from the same checklist and sign-offs | Month-End Close |

The blocker and attention checks are **the checklist's own** (`src/lib/closeChecklist.ts`), passed
in from the screen, so the journey cannot show a softer answer than the close gate. The step's
`readyToClose` ignores review-only steps (open documents and accruals do not block a close) and
counts attention, blockers and a bad month.

## 2. Worked figures (hand-checked, September 2026)

`src/tests/close-journey.test.ts` (7 cases) and `src/tests/close-journey-panel.test.tsx` (5 cases).
September 2026 (30 days), workspace currency ILS:

| bank line | account | date | status | matched |
|---|---|---|---|---|
| 1 | 1000 | 3 Sep | matched | t1 |
| 2 | 1000 | 10 Sep | pending | — |
| 3 | 1010 | 2 Sep | matched | t2 |
| 4 | none | 30 Sep | pending | — |
| 5 | 1000 | 1 Oct | pending | — (next month, left out) |

The test asserts: 4 lines in the month, 2 unmatched; per account 1000 → 2 lines / 1 unmatched, 1010
→ 1 / 0, unassigned → 1 / 1.

Open documents at 30 September:

| document | amount | paid | due | result |
|---|---|---|---|---|
| invoice 1001 | 1,180.00 | 180.00 | 1,000.00 | counted |
| invoice 1002 | 500.00 | 0 | 500.00 | dated 2 Oct — left out |
| invoice 1003 | 400.00 | 400.00 | 0 | paid — left out |
| invoice 1004 | USD 500.00 | 0 | USD 500.00 | counted apart, never converted |
| bill 9001 | 600.00 | 0 | 600.00 | counted |

So the receivables step shows 2 invoices open, 1,000.00 due in ILS and one counted apart; the
payables step shows 1 bill, 600.00. Journal entries: two live in September (one deleted and one
dated 1 October are left out) — the accrual reminder says 2 and states that the screen cannot decide
which costs belong to the month.

Carried statuses: drafts → blocker (2), categorize → attention (3), trial balance → done. With the
month open, the journey reports 1 blocker, 3 attention (banks, categorize, lock) and next step
"Reconcile each bank". With clean items and a hard or soft close it reports every step done and
`readyToClose`; a close with a date range unlocked is still closed and says so.

## 3. Honest limits

- The panel reads the lists the Month-End Close screen already loads; a capped or failed list makes
  the journey provisional, and the screen around it says so where it knows.
- "Open" uses the document's own `calculateAmountDue` and status set (`draft`, `void`, `cancelled`,
  `rejected`, `paid` are not open); it does not decide whether an invoice should have been paid or
  written off.
- Bank matching is read from each line's own `status` / `matchedTransactionId`; a line with no
  account is shown apart in its own row, never assigned to a bank by guess.
- The accrual step is deliberately a review-only reminder: nothing in the ledger data says which
  costs belong to which month.
- Nothing is signed off, closed, reopened or posted from the journey. Those actions remain the
  checklist's and the server's, with their roles, period lock and audit log.

## 4. Files

- `src/lib/closeJourney.ts` (new) — the steps, per-bank rows, open-document and accrual figures,
  readiness and problems.
- `src/components/ledger/CloseJourneyPanel.tsx` (new) — the read-only panel.
- `src/components/ledger/MonthEndCloseView.tsx` — renders the panel after the checklist (no change to
  its own checks, actions or server calls).
- `src/tests/close-journey.test.ts` (7), `src/tests/close-journey-panel.test.tsx` (5).
- `docs/CAPABILITIES.md` row 193, `docs/RELEASE_GATE.md` W9, this document, `docs/COORDINATION.md`.

No money calculation, posting, server, migration, screenshot baseline or quality budget was changed.

## 5. Checks (this branch)

- `npm ci` — clean (node v22.22.3; engine warning only).
- `npx tsc --noEmit -p tsconfig.json` — clean.
- New tests: `close-journey.test.ts` 7/7, `close-journey-panel.test.tsx` 5/5.
- Guard tests: screen help, capabilities, orphan modules, reachability, tables, money format,
  collections, index and test discovery — all pass.
- Full `npm test` — **2,906 passed / 0 failed** (731 suites; database suites skipped without
  `LF_TEST_DATABASE_URL`, as on every branch here).
- `npm run lint:eslint` — 0 errors / **210 warnings** (the cap is unchanged at 210; the new files
  add none). `npm run build` — passes (client bundle + `build/server.cjs`).
