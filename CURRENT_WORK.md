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
| W1 sign-up → first report | browser journey merged (#282, 21 Oct); left: worked figures (W1-GOLD) | AI #9 |
| W5 labels → reports by label | A-210 done (21 Oct: by-label P&L + balance sheet browser journey on the real report, hand figures 2/2); browser journey and worked figures done | — |
| W10 backup → restore | browser test (F-46, now D-98) | AI #4 |
| W14 roles and access | browser journey (now D-99) | AI #4 |
| G-02 first hour without dead ends | wording/dead-end fixes done (D-97 batches 1–2); left: AI #7's authenticated G-24 journey certifies G-02 | AI #4 / AI #7 |
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

0. **Where you push.** Run `git remote -v`. If `origin` is **`Chaim-Richard/ledgerflow`** (a fork — AI #6, #7, #8 work
   there), your work reaches the owner only as a **pull request from the fork into `shmuelbiller1/ledgerflow`, base
   `main`**, with "Allow edits by maintainers" ticked. Start every task from the owner's latest main, not the fork's:
   `git remote add upstream https://github.com/shmuelbiller1/ledgerflow.git` (once), then
   `git fetch upstream && git checkout -b ai<N>/<task-id> upstream/main`; push with `git push origin ai<N>/<task-id>`.
   Full steps: COORDINATION "AIs that work from the fork". If `origin` is `shmuelbiller1/ledgerflow`, push your
   branch there and open the PR as usual. Only AI #1 pushes to `main`.
1. Look at **your own open PRs** first (on `shmuelbiller1/ledgerflow`, including ones from the fork). Fix the ones AI #1 sent back (push to the same branch). A task in an open
   PR is not free to start again; if your next task needs that code, branch from that PR and say "builds on #NNN".
2. Then take the next task below, from the latest `main`.

## Rules that never change

- **AI #9 (Opus)** may change money/tax/stock code **in its lane only** (files listed in COORDINATION "AI #9"), always through a PR that AI #1 reviews; every money change comes with a test of worked figures.
- **AI #1 (Claude)** is the lead: pushes straight to `main`, merges everyone's PRs, owns money, posting, tax maths,
  statements/PDFs and `src/server/`. **Every other AI** works on its own branch and opens a PR; never merge your own.
- Problems in AI #1's area → write them under Messages in COORDINATION; don't patch them.
- Before opening a PR run: the type check, **the whole unit suite** (`npm test` with the local test database), ESLint
  (0 errors, warnings ≤ 205), the browser spec(s) you touched, and `npm run test:rules` if you touched SQL.
  Say the pass counts in the PR. A PR that fails its own test is sent back.
- Screens follow [`docs/UI_GUIDE.md`](docs/UI_GUIDE.md); every button's visible text is part of its name (axe).
- Plan: [`docs/PLAN.md`](docs/PLAN.md) **§17 bookkeeping first** (stages A/B/C, P0/P1/P2) — do P0 work first; tax automation and payroll processing are stage C; skip `[P]` (parked) tasks.
- Copilot "Potential fix for code scanning alert" PRs are reviewed by AI #1 like any other PR.

## Each AI's next tasks

| AI | Do next, in order — **P0 for stage A first** (PLAN §17) | Open PRs / blocked |
|---|---|---|
| #1 Claude (lead) | Reviews/merges and the plan; wire A-77 branding into PDFs when AI #3's resolver lands; L-94 server-side document postings (design) | — |
| #9 Opus (money lane) | **P0:** L94-STEP2 (the server builds invoice/bill entries); then ISS-160, PREV-5, AUD-15, L94-STEP2B, W7-GOLD, W8-GOLD, PREV-6, AUD-13, ISS-143+AUD-03, AUD-10, … (24 open, about 3 days; full order in COORDINATION). FIFO/lot costing waits for the owner | — |
| #7 (fork: Chaim-Richard) | Not active recently — its stage-A tasks moved to AI #4. When active: F-48/F-49 flakes, stability queue (F-*). How to send work: COORDINATION "AIs that work from the fork" | — |
| #3 Arena | **A-194/196/197 + A-148 + A-206 ready for review** (PR #306, `arena/db0fd1ce-ledgerflow`); next in order: help A-201/202/149 → A-185, A-183, A-182, A-138, A-137, A-131/132, A-190/192/193, A-180, A-107, A-72 | PR #306 (`arena/db0fd1ce-ledgerflow`) |
| #4 | **P0 first (moved from AI #7):** D-98 = F-46 backup → restore browser journey (W10), D-99 = W14 roles browser journey; then its D-queue | — |
| #5 | **E-58 landed on main** (Reports → Accountant export pack: trial balance, GL, A/R, A/P, tax by period; ZIP of CSVs + print/PDF, guarded and worked-figure tested) and **E-26/E-43 landed on main** (Banking → Import statement: Israeli bank activity CSV read by column name, date order chosen not guessed, totals/balance lines refused). Queue audit done: E-18…E-27, E-30, E-31, E-41…E-43, E-48 ticked with evidence; **E-17 left open** (the 856 file is a worksheet, not the authority's fixed-width file). Next: E-28 (Xero invoices/bills), E-29 (QuickBooks IIF), E-32…E-34 (exports), E-36…E-40 (IL address, phone/email, duplicates, currency/country tables) | PR #310 now docs-only (`fd00366e`); code commits are in `main` |
| #2 Codex | **Screen wiring C-102…C-126 is done** (21 Oct: all 50 modules in `workspaceExports.ts` reach a screen; C-115/C-117/C-120/C-121/C-122 ticked). Next: C-35 access review, C-36 audit evidence pack, then C-54/C-71 empty states and C-67/C-89 column chooser — check each against `main` first, several older rows are already built. No new tax screens (stage C) | — |
| #6 (fork: Chaim-Richard) | S-01–S-05 merged 21 Oct (#266–#270); next: S-1 onward in its queue. How to send work: COORDINATION "AIs that work from the fork" | — |
| #8 (fork: Chaim-Richard) | Works now and then: G-9 sample companies (IL + US), then its G-queue. How to send work: COORDINATION "AIs that work from the fork" | — |

## Where things are

| What | File |
|---|---|
| Product status, what blocks release | `docs/RELEASE_GATE.md` |
| Your full queue (task wording) and Messages | `docs/COORDINATION.md` |
| AI #1's own list | `docs/TRACKER.md` (open items only) |
| Questions for the owner | `docs/FOR_YOU.md` |
| Architecture and data rules | `AGENTS.md` |
| Finished tasks, old messages, old plans | `docs/archive/` |
