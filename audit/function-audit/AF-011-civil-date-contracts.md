# AF-011 — a civil date is not a civil date when the workspace zone differs from the device zone

**Pinned revision:** `50ee1205d9049d7c225beb433bcb3dff75b77be9` (upstream `main`, 2026-10-25 21:01 UTC); audit branch merge `c702476dcb99fcef081c6e38ee7a1f141320b3a3`
**Reviewer:** AI #8 (independent audit, review-only) · **Date:** 2026-10-25
**Tracked as:** GitHub issue [#342](https://github.com/shmuelbiller1/ledgerflow/issues/342) (open, AI #4 D-65) — this document **re-verifies** it at the current pin with an executed probe; it is not a new issue.
**Outcome:** `verified-defect` — **P1** (silently wrong year classification on the tax screen; one day off on every date display for the same users). No stored date, posting or ledger figure is changed.

## Source blobs at the pin

| File | Git blob |
|---|---|
| `src/lib/utils.ts` (`parseLocalDate` line 239, `formatDate` line 327) | `5fdeb2f8447e` |
| `src/components/finance/TaxManager.tsx` (year filter, line 200) | `5eae3fc04e6c` |
| `src/components/ledger/ReconciliationView.tsx`, `src/components/finance/PaymentsView.tsx`, `src/components/finance/TaxReserveWidget.tsx`, `src/components/forensics/ForensicAudit.tsx`, `src/components/ledger/TimeMachine.tsx`, `src/components/ledger/useReconciliationModel.ts`, `src/components/sales/Sales.tsx`, `src/components/ui/MonthNavigator.tsx` | all import `parseLocalDate` (nine components) |

## What the code does

1. `parseLocalDate('YYYY-MM-DD')` builds `new Date(y, m-1, d)` — **midnight in the device zone** — then
   computes an offset from the same date rendered in the **workspace** zone and returns
   `localDate + offset`. The returned instant is therefore "workspace midnight expressed as a device-local
   instant", which is not any zone's real midnight: for a workspace behind the device it lands hours *after*
   local midnight (Auckland device / New York workspace would land the previous evening), for a workspace
   ahead it lands hours *before* it.
2. `formatDate(date)` calls `parseLocalDate(date)` and then reads `getFullYear()`, `getMonth()`, `getDate()` —
   **device-local** fields of that shifted instant. So the value it prints is the workspace-midnight instant
   read in the device zone: a day earlier whenever the workspace zone is ahead of the device zone.
3. `TaxManager.tsx:200` filters the year with `parseLocalDate(tx.date).getFullYear() === selectedYear`. A
   transaction stored as `2026-01-01` therefore belongs to **2025** for that user, and a `2025-12-31`
   transaction belongs to 2026 for a workspace behind the device.

## Executed evidence (this environment)

```sh
# reproduce the result recorded here: run the probe against the audited pin, not the current checkout
git worktree add /tmp/lf-50ee1205 50ee1205 && cp audit/function-audit/probes/af011-date-contracts.mjs /tmp/lf-50ee1205/
cd /tmp/lf-50ee1205 && npm ci && TZ=UTC npx tsx af011-date-contracts.mjs
```

On a later checkout the same probe shows `formatDate` already correct (it uses `civilDateParts` from
`b4a92158` on), so its output differs from the table below; that difference is the fix, not a broken probe.

```
device zone: UTC
workspace Pacific/Auckland     -> shown 2025-12-31  instant 2025-12-31T11:00:00.000Z  getFullYear 2025   <-- SHIFTED
workspace Asia/Jerusalem       -> shown 2025-12-31  instant 2025-12-31T22:00:00.000Z  getFullYear 2025   <-- SHIFTED
workspace Asia/Tokyo           -> shown 2025-12-31  instant 2025-12-31T15:00:00.000Z  getFullYear 2025   <-- SHIFTED
workspace UTC                  -> shown 2026-01-01  instant 2026-01-01T00:00:00.000Z  getFullYear 2026
workspace America/New_York     -> shown 2026-01-01  instant 2026-01-01T05:00:00.000Z  getFullYear 2026
workspace America/Los_Angeles  -> shown 2026-01-01  instant 2026-01-01T08:00:00.000Z  getFullYear 2026
```

Run again with `TZ=America/New_York` and the same table shifts: an Israeli workspace (`Asia/Jerusalem`)
then reads `2025-12-31` on a US device — the ordinary "US accountant opens an Israeli client's book" case.
Note the last two rows: the printed date is right but the **instant is still wrong** (05:00 / 08:00 instead
of local midnight), so any interval or range comparison built on `parseLocalDate` inherits the error even
when no display is visibly wrong.

## Who is affected

- Any user whose workspace time zone differs from the device time zone — travel, a US accountant on IL
  books, an Israeli owner on a laptop set to UTC (servers, CI, kiosk browsers).
- The tax screen: a January 1 document is not in the year it is filed for (and a December 31 document can
  appear in the next year), so the year's totals on `TaxManager` can omit or include a boundary document.
- Every screen that prints a stored `YYYY-MM-DD` with `formatDate` (nine components import the parser).
- **Not** affected: the stored value, the posting, the ledger, the reports' own period arithmetic (which
  use the ISO string), PDFs and CSV exports (ISO strings).

## Proposed correction (AI #1's lane — shared helper)

Split the two contracts explicitly instead of one helper doing both:

- `civilDate(iso)` → the calendar parts `{y, m, d}` by string parsing only (no `Date`, no zone), and
  `formatCivilDate(iso, pref)` → formats those parts. Every display of a stored date uses this.
- `instantAtWorkspaceMidnight(iso, zone)` → a real instant for comparisons, built through
  `Intl.DateTimeFormat`/`Temporal.ZonedDateTime` or the existing `formatTzDate` helpers, and used only
  where an instant is genuinely needed (sorting, range filters, reminders).
- `TaxManager`'s year filter moves to the civil-date path (`Number(iso.slice(0, 4))` semantics), with a
  test at both year boundaries.

**Acceptance test (must fail before the fix):** for every pair of (device zone, workspace zone) in
`{UTC, America/New_York, Asia/Jerusalem, Pacific/Auckland}` × the same set, `formatDate('2026-01-01',
'YYYY-MM-DD') === '2026-01-01'`, and a `2026-01-01` transaction is in year 2026 while a `2025-12-31`
transaction is in 2025. The suite already runs in three time zones, so this is executed, not just reasoned.

## Limits of this evidence

Executed in Node with the store set directly (no browser). It proves the helper contract and the
`TaxManager` classification; it does not measure how many live users have a device zone different from
their workspace zone, and it does not touch production data. No stored ledger amount is changed by this defect, but displayed figures can be: when server figures are
unavailable, `TaxManager` computes income, expenses and estimated tax from the year-filtered transactions,
so a transaction counted in the wrong year changes the tax figures shown before filing.
