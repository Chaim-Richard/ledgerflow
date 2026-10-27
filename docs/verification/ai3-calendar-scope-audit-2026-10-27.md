# AI #3 — focused calendar and statement-validation audit, 27 October 2026

## Scope and coordination

Reviewed source revision: `0e89cd27cb73819053de7044a3561fabd138e1a1`.

| Source | Git blob |
|---|---|
| `src/lib/calendarDate.ts` | `ea7aa48f714962e6cc169929cc67fd5d10c969f7` |
| `src/lib/statementScope.ts` | `b0d0d6cacb0e4e4578cb3e423396d0d582e04abe` |

Agent #3 checked open PRs and its queue before starting. No #3 implementation PR was open. A-221–A-229 are already delivered; remaining partial A-19/A-32/A-33/A-70/A-72 work depends on reserved document/server integration. No new task was invented and none of those partial rows is marked complete. This pass adds independent test evidence only; it changes no application, posting, server, dependency, schema or quality-gate code.

This is **not** an exhaustive repository audit, a launch sign-off, or a replacement for AI #8's canonical function-audit ledger. The existing Stage A decision and owner production actions remain unchanged.

## Inspected contracts and execution

Read the complete bodies of the eight exported calendar helpers and the two exported statement-scope helpers, including their guards and local callbacks. Counts here concern those **10 exported functions only**, not every closure or every repository function: **10 reviewed / 1 failing / 9 with no finding within the tested domains / 0 changed since pinned source**. No global coverage percentage is claimed.

| Function | Contract and branches reviewed | Executed evidence / outcome |
|---|---|---|
| `isLeapYear` | Pure Gregorian divisibility by 4/100/400 | Every year 1600–2399 and explicit 1900/2000/2100: no finding in domain |
| `daysInMonth` | Pure month 1–12, February leap branch | 9,600 valid year/month pairs against independent UTC Date month-end oracle: no finding in domain |
| `dayNumber` | Integer epoch-day count for valid civil dates, before/after epoch | 292,194 dates, 1600–2399: no finding in domain |
| `fromDayNumber` | Inverse epoch-day conversion | Same 292,194 dates, including negative day numbers: no finding in domain |
| `civilDateParts` | Trimmed civil date, accepts unpadded month/day, rejects timestamps and impossible days | Full date enumeration plus 16 malformed/impossible inputs and explicit unpadded leap day: no finding in domain |
| `weekdayYMD` | Sunday=0, including negative modulo before epoch | Same 292,194 dates against `getUTCDay`: no finding in domain |
| `addDaysYMD` | Signed whole-day arithmetic without timezone conversion | Epoch, leap/nonleap century, year rollover, US DST start/end, inverse checks: no finding in domain |
| `addMonthsYMD` | Signed whole months; clamp to month end; optional recurring anchor | Six independent boundaries plus anchor restoration (Feb 28 → Mar 31 versus Mar 28): no finding in domain |
| `resolveStatementScope` | Missing/null/empty defaults; real YYYY-MM-DD; backwards interval returns error | Defaults, leap day, same-day, backwards, type confusion and overflow: **verified defect** below |
| `statementRows` | Opening row first, preserve subsequent rows/negative running balances; no input mutation | Frozen input/entry/array with +100 opening and −200 payment → −100 balance: no finding in domain |

Calendar arithmetic assumes valid civil date inputs and finite whole-number offsets. Invalid arithmetic inputs, years outside 1600–2399, negative years, fractional offsets, timezone business-policy selection and input validation at every calendar caller are **not certified** by this pass. The statement validator's `today` argument is assumed to come from its existing trusted workspace-date caller; malformed internal `today` is not certified.

### Caller trace

- `src/components/reporting/StatementView.tsx` calls `resolveStatementScope` directly during render, then checks the returned `scope`/`error` union. A thrown exception bypasses that error-state contract. This is a source trace, not a newly executed browser crash test.
- `src/server/services/statementService.ts` calls the same helper in `loadStatement`; it wraps **returned** errors as `StatementScopeError` only.
- `src/server/routes/reportRoutes.ts` maps `StatementScopeError` to HTTP 400, other unexpected errors to 500. The statement route query schema accepts date strings without validating their calendar range.
- `src/server/routes/documentRoutes.ts` likewise handles `StatementScopeError` specially for the statement PDF. A raw `RangeError` bypasses its intended validation branch.
- The existing entity-statement worked-figure tests were re-executed unchanged. This does not establish server entity/PDF support; A-72 remains partial.

## Finding: statement invalid-calendar input throws

**Priority:** P2 malformed-input handling; no ledger corruption or tenant-isolation defect established. **Owner:** AI #1, shared statement/server contract.

`realDay` first checks the numeric YYYY-MM-DD shape, then calls `new Date(...).toISOString()` without checking whether the Date is valid. Out-of-range month/day strings such as `2026-13-01`, `2026-00-01`, `2026-01-32` and `2026-01-00` reach `toISOString()` on Invalid Date and throw `RangeError`. By contrast, `2026-02-30` normalizes and returns the documented validation error. Both `startDate` and `endDate` reproduce the inconsistency.

Expected: `{ error: 'Statement dates are YYYY-MM-DD' }`, not an exception. The new reproduction deliberately **asserts the observed throws**, is named `audit DEFECT reproduction`, and must not be mistaken for desired product behavior. After the owner fixes the guard, replace those assertions with the expected validation-error results. No expected value in an existing test was changed.

Acceptance for AI #1: validate a finite Date before ISO serialization, or use a strict civil-date validator while preserving the YYYY-MM-DD-only statement contract; make all eight overflow cases return the error union. Add real-DB authenticated JSON/PDF assertions for HTTP 400 and a UI error-state test. Verify valid leap dates/defaults/amounts remain unchanged. No server patch is made in this branch.

## Reproduce

```sh
TZ=Pacific/Auckland npx tsx --test \
  src/tests/audit-ai3-calendar-scope.test.ts \
  src/tests/calendar-dates.test.ts \
  src/tests/statement-by-entity.test.ts
TZ=America/Los_Angeles npx tsx --test \
  src/tests/audit-ai3-calendar-scope.test.ts \
  src/tests/calendar-dates.test.ts \
  src/tests/statement-by-entity.test.ts
```

Both runs: **25 passed, 0 failed, 0 skipped** (including nine new audit tests). Each run independently checks all 292,194 civil dates; this is not 292,194 separate test cases.

## Environment and checks

- `npm ci --ignore-scripts`: passed. Runner Node **22.22.3** differs from required Node **24.x**; GitHub's Node 24 results are authoritative for the supported runtime.
- `LF_TEST_DATABASE_URL` is unset; no local database/RLS or authenticated route/PDF acceptance is claimed.
- `npm audit --audit-level=high`: passed, **2 moderate** existing advisories (`typed-rest-client` / nested `qs`); no dependency changes attempted.
- Static/build/full-suite results and PR/check URLs are appended when available. No browser code or spec changed; no local browser acceptance is claimed.
- Vercel preview is intentionally paused by the owner. Its red status is not treated as a code failure or as evidence of deployment success.

### Completed static checks and handoff

- `npm run lint:types`: passed.
- `npm run lint:eslint`: passed, **0 errors / 42 warnings**, cap unchanged; changed-test ESLint is clean.
- `npm run build`: passed.
- `git diff --check`: passed.
- Finding filed as **[#419](https://github.com/shmuelbiller1/ledgerflow/issues/419)** for AI #1. Existing issue #141 concerns the separate older statement PDF scope handoff and was not duplicated.
