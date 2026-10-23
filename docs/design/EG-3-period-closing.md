# EG-3: a period-closing document per set of books

## Decision

The year-end rule stays: **no closing entry is posted** (CA-07; L-123, "the year-end rule (no closing entry)").
`/close-year` locks the year and records its profit. The balance sheet carries past profit as the sum of every
income and expense entry. An entry that moves revenue and expenses to retained earnings would make the closed year's
P&L show zero, so the rule forbids one. The closing **document** is a record, not an entry: it is immutable, written
by the server and holds figures only.

## The record: `periodClosings`

Migration `supabase/migrations/20261024000000_period_closings.sql`. It is server-only and has the same RLS as
`periodBalances`: members read it, and the browser cannot insert, update or delete it (the `lf_guard` trigger, no
write policies). There is one document per workspace, year end and version, with id `<workspaceId>_<yearEnd>_v<n>`.
The code is in `src/server/services/periodClosingService.ts`.

| Field | Content |
|---|---|
| `profitAndLoss` | income, cost of goods and expenses: the total and the lines per account (non-zero only), gross profit, net profit. These are the figures of `computeProfitAndLoss` for the fiscal year. |
| `retainedEarnings` | `before` (the cumulative profit up to the year start), `transfer` (the year's net profit), `after` (= the balance sheet's retained earnings) and `entryPosted: false` |
| `balanceSheet` | total assets, total liabilities, equity accounts, retained earnings, total claims and `isBalanced`, all from `computeBalanceSheet` at the year end |
| `snapshot` | the id, checksum and entry count of the L-123 `periodBalances` snapshot built in the same transaction |
| `lockDate`, `closedByUid`, `closedBy`, `closedAt` | the lock, and who closed the year and when |
| `links` | the close checklist and the close package (`Close_Package_<YYYY-MM>.xlsx`) of the year's last month, on Month-End Close |
| `status`, `version`, `superseded*` | the status is `current` or `superseded`; a superseded document also records when, by whom and why |

## Behaviour

- **Writing:** `/close-year` with `lockPeriod: true` writes the document in the same serializable transaction that
  moves the lock date and writes the L-123 snapshot. All three come from the same entries. The existing documents
  are read before any write, and everything is rebuilt on each retry.
- **Reopening:** `reopenPeriod` can move the lock back before a year end, for example when December is reopened. When
  it does, the current document of that year end is marked `superseded` in the reopen's own transaction. Its figures
  are never changed.
- **Closing again:** the next close writes version n+1. If a version is somehow still current, it is superseded
  ("Closed again"). All versions are kept.
- **Reading:** `GET /api/v1/transactions/period-closings?workspaceId=…` returns every version, newest first. Any
  member can read it, a viewer included. It returns 400 without a workspace and 403 for a non-member.
- **The screen:** `PeriodClosingPanel` appears on Month-End Close, under the close journey. It is read-only, has a
  version picker and a print button, and links to the month's checklist and package.
- **A database without the migration** closes the year as before, without the document (`periodClosingsReady`).

## Defaults used (open questions)

1. **Unlocked closes** (`lockPeriod: false`, the year-end button on Month-End Close) write no document. Nothing is
   locked and no snapshot is taken, so there is nothing to agree with. *Alternative:* a draft document.
2. **Partial unlocks** (`lockException`) do not supersede the document. The year stays closed, and an edit in the
   range only marks the snapshot stale. Closing the range again rebuilds the snapshot, so its checksum can then differ
   from the one in the document. The document keeps the checksum it was closed with.
3. **Other ways of moving the lock date** (workspace settings, admin) do not supersede the document. Only
   `reopenPeriod` does.
4. **Backups:** the document is not in a workspace backup and is not restored, as with `periodBalances`. A workspace
   purge deletes it (`WORKSPACE_PURGE_EXTRA`).
5. **Fiscal year:** the twelve months ending on the closing date (`fiscalYearStart`), as for the profit that
   `/close-year` reports.
