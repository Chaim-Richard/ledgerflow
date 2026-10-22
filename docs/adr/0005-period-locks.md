# 5. Period locks: a soft close, a hard close, and a partial unlock

## Status
Accepted.

## Context
Books that can be edited forever cannot be handed to an accountant, filed, or compared. But a real
business still needs to enter a late supplier bill, and it needs the person who closes the books to be
distinguishable from the person who posts them.

## Decision
The workspace document carries the lock dates (`src/lib/periodLock.ts`):

| Field | Meaning |
|---|---|
| `lockDate` | **hard close** — nobody posts on or before it |
| `softLockDate` | **soft close** — owners and accountants may still post adjusting entries; bookkeepers may not |
| `lockException` | a **partial unlock** — a date range inside the closed period that is open again, with a reason, until it is closed again |

- `effectiveLockDate(ws, uid)` gives the date that applies *to this person*, and it is what the
  posting context uses (`postingContextLoader.ts`, `assertPostingOpen`).
- Closing, reopening, unlocking and relocking are done by `CLOSE_ROLES` = owner, accountant
  (`periodCloseService.ts`); everyone else is refused with *"Only owner or accountant can close a
  period"*. Only the owner may unlock hard-closed dates.
- A close refuses while drafts are dated inside the month, and lists them: a draft would be stuck in
  a closed period. Closing records every account's balance at the closing date (CA-06), so later
  drift is visible.
- The database enforces the same rule for browser writes: `lf_period_open(ws, date)` in
  `supabase/migrations/20260924190000_init.sql` runs from the `lf_guard` trigger. The two must stay
  in step — `periodLock.ts` says so at the top.

## Consequences
- A lock is not a suggestion: the API refuses the posting and the database refuses the write.
- The screens answer "why can't I post here?" from the same function the server uses
  (`effectiveLockDate`), so the reason shown and the refusal are one rule.
- Reopening is auditable (`PERIOD_REOPENED` audit entry with the reason and the previous dates).
