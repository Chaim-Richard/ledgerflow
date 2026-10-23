# Current work — read this first (every AI, every session)

Updated 23 Oct 2026 by AI #5 (Arena); AI #2 closed the screen-wiring lane on 21 Oct (see Messages in COORDINATION). The E-32/E-36–E-40 batch is in PR #355; verification evidence: [`docs/verification/ai5-e32-e40-2026-10-23.md`](docs/verification/ai5-e32-e40-2026-10-23.md). This page is the one place for **what to do now**. Status of the
product is in [`docs/RELEASE_GATE.md`](docs/RELEASE_GATE.md) (14 workflows: connected / checked against worked
figures / browser-tested). Full task wording is in your queue in [`docs/COORDINATION.md`](docs/COORDINATION.md).
History (finished tasks, old messages) is in [`docs/archive/`](docs/archive/) — read it only when you need it.

## Not done yet — the short list (updated every merge)

Everything below is open. Finished items leave this list. Full wording is in COORDINATION (other AIs) and TRACKER (AI #1).

**To reach stage A (synthetic beta) — the 14 workflows in RELEASE_GATE** (its workflow table is the source of truth; this list only says who does what is left)

| Workflow | What is missing | Who |
|---|---|---|
| W10 backup → restore | D-98 merged #324; browser passes with stubbed HTTP boundary; deployment restore drill remains separate | AI #4 / lead |
| W14 roles and access | D-99 screen-role checks merged #324; real four-account authentication/post/approval/payroll journey remains | AI #4 |
| G-02 first hour without dead ends | wording/dead-end fixes done (D-97 batches 1–2); left: AI #7's authenticated G-24 journey certifies G-02 | AI #4 / AI #7 |
| Done for A | W1 (browser #282, worked figures W1-GOLD #291), W2, W3, W4, W5, W6, W9 | — |

**Pull requests waiting**

| PR | State |
|---|---|
| #355 | E-32 and E-36–E-40 accountant/contact/ISO batch; open for review from `arena/981150a6-ledgerflow` |

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
| #3 Arena | **A-201 + A-202 ready for review** (`arena/4c574f50-ledgerflow`: Hebrew help for all 113 reports, and "what does this number mean?" for the 10 main report totals); #306 (A-194/196/197, A-148, A-206) merged 22 Oct. Next: A-149 (rest of my screens), A-185, A-183, A-182, A-138, A-137, A-131/132, A-190/192/193, A-180, A-107, A-72 | `arena/4c574f50-ledgerflow` |
| #4 | #324 merged (D-98 screen journey, D-99 partial role journey, D-13/D-14 docs; D-12 load measurements partial). D-44 grouped report picker in progress; D-47 sync remains open. Real authenticated W14 proof remains open. | `arena/395851ed-ledgerflow` |
| #5 | **E-58, E-26/E-43, E-28 and E-29 are on main.** PR #355 completes the E-32 audit and E-36–E-40 batch (address suggestions, explicit opt-in phone/email cleanup, E-38 duplicate-review audit, ISO currency/country references). **E-17 remains open** pending the authority's fixed-width file specification; E-33/E-34 remain deferred until their specifications are verified. Next eligible item: E-35. Checks and the full-suite time limit are recorded in [`docs/verification/ai5-e32-e40-2026-10-23.md`](docs/verification/ai5-e32-e40-2026-10-23.md). | PR #355 open from `arena/981150a6-ledgerflow`; PR #310 is docs-only (`fd00366e`) |
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
