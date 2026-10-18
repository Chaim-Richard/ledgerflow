# Independent Audit Agent — exhaustive function and workflow review

**Owner request, 18 October 2026.** This is an **audit mission**, not a claim that every bug has already been found. Run it with a dedicated coding/research agent that can read, execute, test, and follow call sites throughout the checked-out repository. Do not equate indexed source with inspected source.

## Assignment and authority

- Suggested identity: **AI #9 — Independent Audit & Beta Readiness** (confirm the number with the lead before starting; the agent has no authority to take the money lane).
- This agent is independent of implementation. Read `AGENTS.md`, `docs/COORDINATION.md`, `docs/LEAD_RUNBOOK.md`, `docs/PLAN.md`, `docs/ROADMAP.md`, `docs/CAPABILITIES.md`, `docs/TODO_2.md`, and `docs/CODE_ATLAS.md`.
- Inspect and report on any file, but **do not directly edit financial posting, migrations, live data, production secrets, or `main`**. Submit evidence-backed issues and focused reproduction tests on isolated branches. Financial fixes go to the lead after review.
- **Do not reassign established agents' work.** Before opening an issue, check the tracker, existing issues, and active PRs. Each verified finding gets one owner and one reproduction.
- Every conclusion is pinned to a full commit SHA and source Git blob. When code changes, affected review evidence becomes stale until rechecked.
- No live customer records, production DB changes, production credentials, or external service charges in the audit. Use synthetic fixtures, disposable accounts, and isolated Postgres.

## Why a second depth of review is necessary

The existing **Code Intelligence Atlas** is the canonical **per-file** map. Its 16 October input snapshot indexed **2,141 files**, including **1,967 code-related paths**, but only **54 targeted-source-inspected entries** and **126 reviewer-annotated entries**. It also records **82 unresolved module/glob links** and **259 computed HTTP call sites**. These counts describe that *pinned snapshot* only; regenerate them for the current HEAD.

**Do not build a second per-file atlas.** Use `scripts/code-atlas.mjs` as the file inventory, dependency map, symbol starting point, and change-impact aid. Extend its canonical review/evidence model for **function-level results** when needed rather than maintaining an incompatible parallel per-file truth. Purely automatic extraction is inventory, not review.

## Two independent audit passes

### Pass A — every function, including micro-helpers

At a pinned SHA, inventory every in-scope executable: exported/local functions, arrow functions, callbacks, React components/hooks/effects, class methods/constructors, HTTP handlers/middleware, jobs, parsers, SQL functions/triggers, test setup, scripts and runtime configuration. Include unexported helpers and closures. For each, independently read **the full body and adjacent guard logic**, then trace callers, data dependencies, return consumers, and all durable side effects.

For every function record:
1. **Identity:** source revision, path/blob SHA, symbol, exact line span, owning workflow and role (or "orphan/unknown").
2. **Contract:** inputs/assumptions; outputs, error path, async behavior, side effects, database tables, authorization requirements, units/currency/date semantics.
3. **Branches:** each conditional/return/throw/catch/fallback/early exit, zero/negative/missing/boundary values, stale or ambiguous states, success after failure, and overflow.
4. **Integration:** actual importer/caller and its expected contract; handlers and routes that reach it; security context; browser cache vs database authority; cross-workspace or cross-entity leakage.
5. **Execution:** applicable existing tests *executed at this revision*, new adversarial test or tiny counterexample, property/mutation/fuzz or database-concurrency case when appropriate.
6. **Outcome:** `verified-no-finding`, `verified-defect`, `needs-reproduction`, `unsupported/unknown`, or `not-yet-reviewed`. Never call code correct because TypeScript or a happy-path test passed.
7. **Evidence:** exact lines + reproducible command/fixture + expected vs observed behavior. Include all limitations (especially mocked vs real DB).

Use an explicit count of **total / reviewed / failing / uncertain / changed-since-review** functions. Make coverage visible per subsystem and workflow; never imply that 100% syntactic indexing is 100% audited. For functions that cannot be exercised, mark the reason.

For every function look for:
- Whole-cent and currency-scale correctness; negative, reversal, rounding, allocation, exchange rate, tax-date and period boundaries.
- Missing auth/role/workspace/entity/ownership checks; user-controlled paths, unsafe logs and network behavior.
- Retry and cancellation, idempotency and replay identity, transactional races, stale reads and partial commits.
- Pagination/limits, memory growth, unbounded/recursive work, timestamp locale, null vs missing vs empty, unexpected status codes.
- Hook/effect lifecycle, background-tab recovery, stale workspace results, loading/empty-state flapping and draft retention.
- Schema drift, malformed imports, Unicode/English/Hebrew, CSV quoting, PDF and API value consistency.
- Actual UI reachability; error reported truthfully; no test-only simulation presented as a live feature.

**Micro-function acceptance:** for arithmetic/formatting/parsers, run boundary-value tables and automatically generated properties; independently compute expected results. For stateful I/O, fault injection at *each await boundary*. For concurrency, use a real isolated database with two simultaneous requests, not only mocks.

### Pass B — across the whole workflow and strategy

Build a **capability-to-implementation map** from `docs/CAPABILITIES.md` + `docs/TODO_2.md` + registered screens/routes + schema/migrations + the Code Atlas workflow traces. For each capability, state:
`Absent | Code only | Reachable | Persists | Correctness tested | Error/retry tested | Real-DB E2E | Verified for invited testers`.

Walk both forward and backward:
`User action → UI → validation → authenticated API → role/ownership → transaction/RLS → ledger/stock/tax → persisted record → report/screen → CSV/PDF/email → undo/replay/recovery`.

Also walk backward from financial outputs to original sources. Demand **the same source-of-truth figures and scope** across screens, API, PDFs and exports. Identify parallel implementations, features that can be reached but not completed, fake/demo results, obsolete code, duplicate functions and unused libraries.

Audit these workflow groups independently:
1. Account creation, initial company setup, returning-user refresh, changing books.
2. Chart of accounts, opening balances, standard posting, correction and period close.
3. Invoices/quotes/orders/deposits/delivery, bills/credits and payments.
4. Bank links, cursor synchronization, CSV imports, matching and reconciliation.
5. Inventory valuation, warehouse receipts, COGS, returns and historical stock.
6. Multiple currencies, dimensions, intercompany and group consolidation.
7. Jurisdiction-specific US and Israeli tax decisions, returns and supported/unsupported status.
8. Pay runs and restricted tax forms, with non-validated actions unavailable.
9. Reports, account/customer statements, drill-down, PDF, CSV and email.
10. Backups/restore, disaster recovery, migrations, RLS, remote TLS and secrets.
11. Notifications, scheduled jobs, queue/outbox, retries and deployment differences.
12. Admin, entitlements/billing, invite/security controls and audit logs.
13. Performance and stability: empty/large books, offline, 2 browser tabs, 2 users, phone/keyboard, Hebrew mixed data.

### Strategy review questions

- Which **few** shared primitives could prevent **families** of defects (rather than 100 scattered fixes)?
- What is the thinnest complete first-tester experience? Which modules should be hidden, disabled or explicitly labeled incomplete?
- Which ledger/tax/document functions duplicate the same rule with different defaults?
- Where are names/labels being mistaken for separate legal books, or browser cache mistaken for authoritative history?
- Which calculations are marketing/demo logic rather than a supported financial operation?
- Which missing integrations can silently lose data or show success before a committed write?
- Which tests are only helper tests and which perform a persisted, authenticated, multi-step round trip?
- Which changes would actually reduce first-hour setup and month-end work, rather than merely raise the feature count?
- What can be **deferred safely** without expanding the risk of the beta?

## Prioritization and publication

Severity is about the user's outcome, not how small the function is:
- **P0 stop invitation:** potential loss/incorrect attribution of ledger/bank data, tenant isolation defect, silently wrong financial report/export, unsafe restore or unauthenticated privileged action, or unsupported tax automation shown as authoritative.
- **P1 beta prerequisite:** nondeterministic first-run, trapped payment flow, broken backups/close, misleading completion, unbounded failed requests, essential admin controls, disabled or absent error recovery.
- **P2 usable-with-clear-limits:** nonessential feature gaps, polish, convenience and performance outside realistic beta workloads.
- **P3 later:** expansion countries, industry add-ons, broad analytics and unrelated cosmetic enhancements.

For every finding, output a linked issue with: unique defect mechanism, complete source evidence, **shortest reproduction**, independent expected result, affected users/workflows, severity and likelihood, exact scope, proposed correction, adversarial acceptance test, and duplicate issue/PR search. **Never silently change a financial expected number simply to make CI green.**

Publish a current **audit scorecard** after each logical slice: pinned SHA, files/functions counted and reviewed, subsystems completed, known P0/P1 blockers, tests actually run, migrations verified/unverified, unknowns and a proposed next 10-function batch. A clean pass means all in-scope branches inspected and no unresolved P0—not an assertion that software can have zero bugs.

## Existing tooling to run (not to claim as already run)

```sh
node scripts/code-atlas.mjs stats
node scripts/code-atlas.mjs validate
node scripts/code-atlas.mjs unknowns --limit 100
node scripts/code-atlas.mjs workflow FLOW-PERMISSIONS
node scripts/code-atlas.mjs workflow FLOW-TAX
node scripts/code-atlas.mjs workflow V1-04
npx tsx scripts/bug-patterns.ts
npm run lint:types
npm run lint:eslint
npm test
npm run test:rules
npm run build
```

Run the repo's approved Postgres fixture, property, concurrency, timezone and Playwright checks under `docs/LEAD_RUNBOOK.md`. Record exact commands/execution environment; do not infer that a locally skipped suite passed.

## First required audit cases (recheck against latest main first)

1. **AF-001 durable bank cursor:** `src/server/routes/plaidRoutes.ts` updates `syncCursor` when API pages arrive; `Banking.tsx` may show success without persisting returned lines. Verify crash/reload/replay, modified/removed transactions, and bank-line provenance before accepting cursor progression.
2. **AF-002 label reconciliation:** `TransactionTemplates.ts:spreadLabels` rounds A/R, discounts and tax separately. Example: two $100 labeled revenue parts; $36 tax; $1.01 discount; $234.99 total. Compute per-label trial balances independently and reproduce a possible +1/-1 cent mismatch. Then test payments/fees/FX/credits.
3. **AF-003 statement scope:** `AUD-01` / issue #141: selected period and entity must match server JSON, screen, PDF, export and email.
4. **AF-004 tax fact authority:** compare `composeFacts`, `evaluateRules`, `resolveSellerProfile`, `TaxPlaceSuggestion`, `ilVatReturn`, and `usSalesTaxReturn`; trace entity ownership, conflicting facts and unverified rule packs all the way to posting.
5. **AF-005 stock/as-of:** issues #130 and #131; stock history must reconcile to past dates and cannot change valuation without balanced journal entries.
6. **AF-006 RMA and restore:** issue #143 and AUD-02; server-side state transition and coherent backup/restore under concurrent writes.
7. **AF-007 report cache:** cached report must follow an explicit revocation and post-write freshness policy; test member revocation during TTL and changed figures.
8. **AF-008 DB trust and deployments:** AUD-20 remote TLS defaults, migrations actually applied, and daily-job parity between Vercel and standalone.
9. **AF-009 first-hour path:** P2-1 end-to-end sign-up → setup → bank → invoice → saved reports → logout/login; test new and existing books.
10. **AF-010 high-risk micro-functions:** `allocateCents`, `parseAmountToCents`, registration/period date matching, CSV escaping, reversals, effective-rate overlap and stale async guards.

Treat these as **starting hypotheses backed by source observations**, not ten closed defects. Verify before changing code.

## Completion report format

1. **Snapshot and coverage**, honest review percentage and list of unknowns.
2. **Top verified failures** with reproduction and exact source.
3. **Integration graph:** capabilities with full paths, missing link, proposed owner.
4. **Beta readiness matrix:** see `docs/FIRST_TESTERS_GATE.md`.
5. **Architecture shortcuts:** remove duplication and repair shared contracts without rebuilding working modules.
6. **Three work queues**: blocking now; needed before real bookkeeping; parked until first feedback.
7. **Status**: what has actually been tested, what is inferred, and what is still inaccessible.

**Instruction to the agent:** start with AF-001 and AF-002 (high potential data-integrity impact), followed by the smallest failing function-level examples in the connected call graph. Continue slice by slice until all in-scope functions are either reviewed or explicitly excluded with a reason. Never report an unexecuted scan as finished.
