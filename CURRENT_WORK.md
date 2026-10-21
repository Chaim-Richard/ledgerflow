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
| W5 labels → reports by label | A-210 done (21 Oct: by-label P&L + balance sheet browser journey on the real report, hand figures 2/2); left: F-50 wider labels journey + W14 (AI #7) | AI #7 |
| W10 backup → restore | browser test (F-46) | AI #7 |
| W14 roles and access | browser journey | AI #7 |
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

1. Look at **your own open PRs** first. Fix the ones AI #1 sent back (push to the same branch). A task in an open
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
| #9 Opus (money lane) | **P0:** ISS-156 withholding after certificate expiry, AUD-01 statements, W1-GOLD first-hour figures; then AU-4, YEAR-END-GOLD, FX-GOLD, L94-SHADOW-MORE, DIM-3, U-12, W12-GOLD, AUD-19, ISS-160, ISS-143, AUD-10, BM-04+BH-02, L-123 design, CON-4b (17 tasks, full wording in COORDINATION). FIFO/lot costing waits for the owner | — |
| #7 | **P0:** G-24 first-hour journey test (W1, taken over from AI #8), F-46 backup → restore browser test (W10), W5 labels → reports browser journey, W14 roles browser journey, a browser check of the help center/feedback screens from #252; then F-48, F-49 flakes | — |
| #3 Arena | **A-210 done (21 Oct)** — by-label P&L + balance browser journey on the real report, hand figures. **A-116 + A-117 done (21 Oct)** — Kit Assembly plan and Stock Value by Location & Lot (no posting; per-lot on-hand not tracked, stated). **A-75 + A-76 done (21 Oct)** — dated per-country rate tables + claim prefill. **A-77 already on main (#296)** — verified 13/13; AI #1 wires `pdfService`. Next: AUD-01 wait for A-72; anything new from AI #1 | A-72 waits for AI #9's AUD-01 |
| #4 | **D-97 wording pass complete (21 Oct, PR #295 on `arena/7b5d662c-ledgerflow`):** reconciliation, bank import, template selector and chart of accounts renamed to plain bookkeeping language; five Codex P2 review findings fixed (scoped reconciled %, `useDialog` modal, AI-card claim, action-boundary toasts, importer loading toast); reconcile visual baselines need the maintainer's refresh workflow. G-02 certification still waits on AI #7's G-24. Next: **D-89** list money alignment/sticky headers, then **D-91** icon-only button labels; D-44 report picker after | — |
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
