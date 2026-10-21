# Current work — read this first (every AI, every session)

Updated 20 Oct 2026 by AI #1 (Claude). This page is the one place for **what to do now**. Status of the
product is in [`docs/RELEASE_GATE.md`](docs/RELEASE_GATE.md) (14 workflows: connected / checked against worked
figures / browser-tested). Full task wording is in your queue in [`docs/COORDINATION.md`](docs/COORDINATION.md).
History (finished tasks, old messages) is in [`docs/archive/`](docs/archive/) — read it only when you need it.

## Not done yet — the short list (updated every merge)

Everything below is open. Finished items leave this list. Full wording is in COORDINATION (other AIs) and TRACKER (AI #1).

**To reach stage A (synthetic beta) — the 14 workflows in RELEASE_GATE**

| Workflow | What is missing | Who |
|---|---|---|
| W1 sign-up → first report | worked figures + browser journey (G-24) | AI #7 |
| W2 invoice → payment → statement | worked figures for separate payment records (DIM-1) | AI #1 |
| W5 labels → reports by label | balance sheet by label (report path) + browser journey | AI #1, then AI #3 / AI #7 |
| W10 backup → restore | browser test (F-46) | AI #7 |
| W14 roles and access | browser journey | AI #7 |
| G-02 first hour without dead ends | walk-through + fixes (D-97) | AI #4 |
| Done for A | W3, W4, W6, W9 | — |

**Pull requests waiting**

| PR | State |
|---|---|
| #254 AI #6 security (rate limits, headers, restore drill) | sent back twice: tests still can't run, counter not atomic |

**Waiting on you (owner)** — details in `docs/FOR_YOU.md`
- Paste one database change into Supabase: `supabase/migrations/20261021010000_inventory_cost_editable_at_zero.sql` (FOR_YOU, 21 Oct; connector timed out 3 times).
- Replace the four generated secrets (item 2), try sign-up on the live site (3), deployment protection (4).
- Email sender + provider (5, 7), database certificate (6), Stripe last 2 steps (8), privacy papers (17).
- GitHub: require CI before merging to `main` (L-67).

**After stage A (stage B)**: W11 QuickBooks/CSV import matched to the source (AU-4), W12 group report browser check, W13 stock journey, Israeli allocation numbers, production gates. **Stage C**: tax filing automation, payroll processing. The ~400 "LATER" ideas stay in TRACKER and are not on this list.

## Start of every session

1. Look at **your own open PRs** first. Fix the ones AI #1 sent back (push to the same branch). A task in an open
   PR is not free to start again; if your next task needs that code, branch from that PR and say "builds on #NNN".
2. Then take the next task below, from the latest `main`.

## Rules that never change

- **AI #9 (Opus)** may change money/tax/stock code **in its lane only** (files listed in COORDINATION "AI #9"), always through a PR that AI #1 reviews; every money change comes with a test of worked figures.
- **AI #1 (Claude)** is the lead: pushes straight to `main`, merges everyone's PRs, owns money, posting, tax maths,
  statements/PDFs and `src/server/`. **Every other AI** works on its own branch and opens a PR; never merge your own.
- Problems in AI #1's area → write them under Messages in COORDINATION; don't patch them.
- Before opening a PR run: the type check, **the whole unit suite** (`npm test` with the local test database), ESLint
  (0 errors, warnings ≤ 207), the browser spec(s) you touched, and `npm run test:rules` if you touched SQL.
  Say the pass counts in the PR. A PR that fails its own test is sent back.
- Screens follow [`docs/UI_GUIDE.md`](docs/UI_GUIDE.md); every button's visible text is part of its name (axe).
- Plan: [`docs/PLAN.md`](docs/PLAN.md) **§17 bookkeeping first** (stages A/B/C, P0/P1/P2) — do P0 work first; tax automation and payroll processing are stage C; skip `[P]` (parked) tasks.
- Copilot "Potential fix for code scanning alert" PRs are reviewed by AI #1 like any other PR.

## Each AI's next tasks

| AI | Do next, in order — **P0 for stage A first** (PLAN §17) | Open PRs / blocked |
|---|---|---|
| #1 Claude (lead) | Reviews/merges and the plan; **P0:** DIM-1 for separate payment records (W2 worked figures); then AU-4 (W11, stage B), INT-6/7 (Stripe), CON-4b (stage C), seams for A-72/A-75–A-77 | — |
| #9 Opus (money lane) | Finish open follow-ups: `ai9/con1-review`, #241/#243/#244 findings (small, nearly done). **P0:** W3 and W4 worked-figure tests (bill → payment run → vendor statement; bank import → reconciliation, figures by hand). Then **PAY-1** payroll-provider import (P1), ISS-130, DIM-2 (stage B). No new tax features (stage C). | — |
| #7 | **P0:** G-24 first-hour journey test (W1, taken over from AI #8), F-46 backup → restore browser test (W10), W5 labels → reports browser journey, W14 roles browser journey, a browser check of the help center/feedback screens from #252; then F-48, F-49 flakes | — |
| #3 Arena | **P0:** W5 worked figures — labelled invoices/bills/payments → P&L and balance sheet by label, figures by hand (new A-210). Stock A-112…A-117 after (stage B) | Waiting on AI #1: A-72, A-75, A-76, A-77 |
| #4 | **P0:** G-02 first hour without dead ends — walk the first-hour path on phone and desktop, fix wording/dead ends (new D-97); then D-87 onward | — |
| #5 | **P1:** accountant export pack (trial balance, GL, A/R, A/P, tax liability by period as CSV/PDF — new E-58); then E-17 onward | — |
| #2 Codex | **P1:** finish the screen wiring already started (C-102…C-126); no new tax screens (stage C) | — |
| #6 | Redo #254 as small PRs from latest main: S-01 first (tests in `node:test` with the test database, counter in one transaction) — see the second review | #254 sent back |
| #8 | (inactive) #252 merged by AI #1 on 20 Oct; G-9 sample companies (IL + US) when active | — |

## Where things are

| What | File |
|---|---|
| Product status, what blocks release | `docs/RELEASE_GATE.md` |
| Your full queue (task wording) and Messages | `docs/COORDINATION.md` |
| AI #1's own list | `docs/TRACKER.md` (open items only) |
| Questions for the owner | `docs/FOR_YOU.md` |
| Architecture and data rules | `AGENTS.md` |
| Finished tasks, old messages, old plans | `docs/archive/` |
