# Current work — read this first (every AI, every session)

Updated 20 Oct 2026 by AI #1 (Claude); 21 Oct: AI #2 closed the screen-wiring lane (see Messages in COORDINATION). This page is the one place for **what to do now**. Status of the
product is in [`docs/RELEASE_GATE.md`](docs/RELEASE_GATE.md) (14 workflows: connected / checked against worked
figures / browser-tested). Full task wording is in your queue in [`docs/COORDINATION.md`](docs/COORDINATION.md).
History (finished tasks, old messages) is in [`docs/archive/`](docs/archive/) — read it only when you need it.

## Not done yet — the short list (updated every merge)

Everything below is open. Finished items leave this list. Full wording is in COORDINATION (other AIs) and TRACKER (AI #1).

**To reach stage A (synthetic beta) — the 14 workflows in RELEASE_GATE**

| Workflow | What is missing | Who |
|---|---|---|
| W1 sign-up → first report | browser journey merged (#282, 21 Oct); left: worked figures | AI #7 |
| W5 labels → reports by label | balance sheet by label merged (#283, 21 Oct); left: AI #3's end-to-end worked check on the real report (A-210) + browser journey (F-50) | AI #3, AI #7 |
| W10 backup → restore | browser test (F-46) | AI #7 |
| W14 roles and access | browser journey | AI #7 |
| G-02 first hour without dead ends | walk-through + fixes (D-97) | AI #4 |
| Done for A | W2, W3, W4, W6, W9 | — |

**Pull requests waiting**

| PR | State |
|---|---|
| — | none open (21 Oct: #265–#272 merged; #254 replaced by #266–#270) |

**Waiting on you (owner)** — details in `docs/FOR_YOU.md`
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
| #1 Claude (lead) | Reviews/merges and the plan; wire A-77 branding into PDFs when AI #3's resolver lands; L-94 server-side document postings (design) | — |
| #9 Opus (money lane) | **P0:** W5-BS balance sheet by label, AUD-01 statements, INT-6/INT-7 Stripe double-charge guards; then W13 browser, AU-4 (W11), YEAR-END-GOLD, FX-GOLD, DIM-3, U-12, ISS-143, CON-4b (full list in COORDINATION). FIFO/lot costing waits for the owner | — |
| #7 | **P0:** G-24 first-hour journey test (W1, taken over from AI #8), F-46 backup → restore browser test (W10), W5 labels → reports browser journey, W14 roles browser journey, a browser check of the help center/feedback screens from #252; then F-48, F-49 flakes | — |
| #3 Arena | **P0:** W5 worked figures — labelled invoices/bills/payments → P&L and balance sheet by label, figures by hand (new A-210). Stock A-112…A-117 after (stage B) | A-72 waits for AI #9's AUD-01; A-75/A-76/A-77 released 21 Oct |
| #4 | **P0:** G-02 first hour without dead ends — walk the first-hour path on phone and desktop, fix wording/dead ends (new D-97); then D-87 onward | — |
| #5 | **P1:** accountant export pack (trial balance, GL, A/R, A/P, tax liability by period as CSV/PDF — new E-58); then E-17 onward | — |
| #2 Codex | **Screen wiring C-102…C-126 is done** (21 Oct: all 50 modules in `workspaceExports.ts` reach a screen; C-115/C-117/C-120/C-121/C-122 ticked). Next: C-35 access review, C-36 audit evidence pack, then C-54/C-71 empty states and C-67/C-89 column chooser — check each against `main` first, several older rows are already built. No new tax screens (stage C) | — |
| #6 | S-01–S-05 merged 21 Oct (#266–#270); next: S-1 onward in its queue | — |
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
