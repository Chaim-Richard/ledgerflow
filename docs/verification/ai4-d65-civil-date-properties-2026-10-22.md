# D-65 — civil-date property sweep (partial)

## New passing coverage

`src/tests/civil-date-properties.test.ts` uses fast-check seeds **650022 / 650023**. Each of six device zones (UTC, New York, Los Angeles, Jerusalem, Auckland, Kiritimati) runs 400 civil arithmetic/picker properties and 200 fiscal containment properties, with an intentionally different workspace zone. Total **3,600 generated cases**, plus explicit leap-century and US/IL/NZ DST calendar dates. Generated civil dates span 2000–2100.

Properties:
- Device-constructed date-picker day survives `calendarDateISO` unchanged.
- Day shifts agree with independent UTC Gregorian enumeration and invert exactly.
- Month bounds contain the day, begin on day 1 and end immediately before next month.
- Fiscal year and quarter bounds contain the date for each generated fiscal start month; quarter stays inside year and uses the same fiscal-year label.
- Leap year 2000 and non-leap century 2100 have independently pinned expected transitions.

Tests restore both process TZ (including originally unset) and complete auth-store state in finally. Existing expected amounts/dates and product code are unchanged. This does not assert invalid dates, skipped historical civil days, or arbitrary fiscal start days.

## Finding: shared parser/display contracts disagree

**Issue #342:** https://github.com/shmuelbiller1/ledgerflow/issues/342

UTC device + Auckland workspace:

| Stored date | Call | Actual | Required civil display |
|---|---|---|---|
| 2026-01-01 | `formatDate(day, 'YYYY-MM-DD')` | **2025-12-31** | **2026-01-01** |

The initial wider property checked `calendarDateISO(parseLocalDate(day))`; it failed for four device zones, shrinking to 2000-01-01 with zero shift. Inspection shows why: parser returns workspace midnight, formatter then reads device fields. This is not the same contract as the device-built picker date. Rather than claim a known failure passes, the passing suite explicitly covers device-built dates only, and the parser/display failure is retained as the issue's exact reproduction.

`TaxManager.tsx` also selects report-year membership from `parseLocalDate(tx.date).getFullYear()`, so the boundary may affect reporting, not just labels. No production data incident or durable mutation demonstrated. Lead owns the shared financial/date contract fix; no product code changed here.

## Checks and status

- New six property tests + existing calendar date tests: **9 tests passed, 0 failed**.
- Typecheck passed; changed-test ESLint clean.
- No browser change in this test-only task; existing #340 browser verification remains pending.
- No new dependency, SQL/server change, baseline increase or original expected-value change.
- **D-65 remains partial**, pending lead resolution of #342. No release-gate promotion.
