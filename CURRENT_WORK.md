# Current work — read this first (every AI, every session)

Updated 25 Oct 2026 by AI #5 (Arena) — E-53 IIF export + E-44/45/46/47 provider imports; verification evidence: [`docs/verification/ai5-e53-e44-e47-2026-10-25.md`](docs/verification/ai5-e53-e44-e47-2026-10-25.md). This page is the one place for **what to do now**. Status of the
product is in [`docs/RELEASE_GATE.md`](docs/RELEASE_GATE.md) (14 workflows: connected / checked against worked
figures / browser-tested). Full task wording is in your queue in [`docs/COORDINATION.md`](docs/COORDINATION.md).
History (finished tasks, old messages) is in [`docs/archive/`](docs/archive/) — read it only when you need it.

## Not done yet — the short list (updated every merge)

Everything below is open. Finished items leave this list. Full wording is in COORDINATION (other AIs) and TRACKER (AI #1).

**Stage A (synthetic bookkeeping beta) is READY.** All 9 workflows (W1, W2, W3, W4, W5, W6, W9, W10, W14) are Connected, Verified with worked figures, and Browser-tested. See [`audit/LAUNCH_READINESS_FINAL_AUDIT_2026-10-23.md`](audit/LAUNCH_READINESS_FINAL_AUDIT_2026-10-23.md) and [`docs/RELEASE_GATE.md`](docs/RELEASE_GATE.md).

| Workflow / Gate | Status | Who |
|---|---|---|
| Done for A | **W1, W2, W3, W4, W5, W6, W9, W10, W14** (all 9 Yes/Yes/Yes; D-98 and D-99 browser journeys merged in #324; L-123 server balances merged in #334, #345, #351; G-24 journey merged in #282) | — |
| Owner launch actions | Paste L-123 migration in Supabase, set `DATABASE_CA_CERT` in Vercel, rotate 4 secrets (items in `docs/FOR_YOU.md`) | Owner |
| Stage B: W11 QuickBooks/CSV | Import acceptance matched to source (AU-4) | AI #5 / AI #9 |
| Stage B: W13 stock | Full stock browser journey (W13-GOLD figures verified #281) | AI #4 / AI #9 |
| Stage B: ERPNext depth | Repost engine (EG-1 #348 design), Payment ledger (EG-2), Period closing voucher (EG-3), Stock snapshots (EG-7) | AI #1 / AI #9 |

**Pull request for this branch**

| PR | State |
|---|---|
| new (from `arena/8d145257-ledgerflow`) | E-53 IIF export + E-44/E-45/E-46/E-47 provider list imports |

**Waiting on you (owner)** — details in `docs/FOR_YOU.md`
- Replace the four generated secrets (item 2), try sign-up on the live site (3), deployment protection (4).
- Email sender + provider (5, 7), database certificate (6), Stripe last 2 steps (8), privacy papers (17).
- GitHub: require CI before merging to `main` (L-67).

**After stage A (stage B)**: W11 QuickBooks/CSV import matched to the source (AU-4), W13 stock journey, Israeli allocation numbers, production gates. W12's group-report browser gate is complete in PR #370. **Stage C**: tax filing automation, payroll processing. The ~400 "LATER" ideas stay in TRACKER and are not on this list.

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
| #3 Arena | **25 Oct: A-218, A-219, A-220 done; A-72 screen done (`[~]`, PDF waits on AI #1).** On `arena/e7001268-ledgerflow`: printing P&L / balance sheet / trial balance on A4 or US Letter with a `@page` rule, landscape when the table is wider than a portrait sheet, and a print block that keeps every column (scroll boxes print in full, names wrap in their cell, amounts never split); a help page that exists for all **215** registered screens (15 area pages, 4 newly written in English + Hebrew, no more Overview fallback); dates and amounts on report headers per locale (`Oct 1, 2026` / `1 Oct 2026` / `1 באוק׳ 2026`, from the workspace's saved format); and a customer/vendor **statement by entity label** on the existing `computeStatement` (worked figures: 640.00 whole account, 850.00 Entity A, 0.00 Entity B, 90.00 unlabelled; payments scoped to their own allocations, unapplied money counted and said on screen). The statement JSON/PDF stay whole-account and those two buttons are refused while an entity is chosen — **AI #1 owns adding an `entity` argument to `loadStatement` and the PDF route**. Evidence: [`docs/verification/ai3-a72-a218-a219-a220-2026-10-25.md`](docs/verification/ai3-a72-a218-a219-a220-2026-10-25.md). Earlier in the day: FINAL A-queue sweep on `arena/7456594f-ledgerflow` (see git history) | PR from `arena/e7001268-ledgerflow` (this branch); **no unblocked `[ ]` A-task left** — see Messages |
| #5 | **On this branch (ready for review): the E-53/E-44/E-45/E-46/E-47 imports-exports batch** — the IIF **writer** (`src/lib/iifExport.ts`, lists only — no `!TRNS`/`!SPL`, no balances/quantities; the E-29 reader is its round-trip test) with an owner-only card on Settings → Backup & Export built from the checksum-verified server backup; and four documented-provider list readers wired into the Import-data source select: Xero chart/contacts (E-44 done), Wave customers (E-45), Zoho Books (E-46), Sage 50 CHART/CUSTOMER/VENDOR/ITEM (E-47, the documented numeric type-code table, with retainage/contra codes refused by row, never reclassified). 7 fixtures shaped on the cited templates; tests 6+4+5+3+4+5 lib/ui + 4 screen. Merged earlier: E-58, E-26/E-43, E-28, E-29, E-32/E-36–E-40 (#355), E-35. **Next:** E-55's PCN874 validation screen (the only unblocked row left); E-17/E-33/E-34/E-54 spec-blocked, E-50/E-51 provider-blocked, E-56 needs real photos, E-57's four totals wait on AI #1's snapshot. Queue re-read: [`docs/verification/ai5-queue-audit-2026-10-23.md`](docs/verification/ai5-queue-audit-2026-10-23.md). Evidence: [`docs/verification/ai5-e53-e44-e47-2026-10-25.md`](docs/verification/ai5-e53-e44-e47-2026-10-25.md). | `arena/8d145257-ledgerflow` |
| #4 | #370 is merged (D-47 and F-47/W12). W13 purchase → stock → sale → valuation now has a real-router/Postgres browser journey at both widths/themes, awaiting review. D-42/D-44/D-76 reconciled as already delivered. Next: D-99 fully authenticated four-account/W14 proof, which remains open. | `ai4/w13-full-stock-journey`; [evidence](docs/verification/ai4-w13-full-stock-journey-2026-10-24.md) |
| #2 Codex | **C-35 access review and C-36 audit evidence pack are done** (25 Oct, **PR #381**, review findings fixed in `f418cec3`): Settings → Security → **Access review** (role, last recorded sign-in, two-step login, last role change; CSV + print; owners and accountants; read-only) and **Audit evidence pack** (a period → one ZIP: audit trail, period locks, approvals, approval rules, access review, README). No money/server/schema change; limits said on screen. Evidence: `docs/verification/ai2-c35-c36-2026-10-25.md`. Next: C-54/C-71 empty states and C-67/C-89 column chooser, then C-38 export templates is already built (verify and tick) — check each against `main` first. No new tax screens (stage C) | PR #381 (review) |
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
