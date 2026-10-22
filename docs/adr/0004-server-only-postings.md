# 4. Postings are built and written on the server, never in the browser

## Status
Accepted. Being completed by L-94 (server-side document postings).

## Context
An accounting system's entries are its truth. If the browser composes the journal entry that a sale
or a bill produces, three things follow: the entry depends on whatever the browser had loaded (which
can be a partial cache), two tabs can post the same document twice, and nothing stops a modified page
from writing lines that do not balance. Every one of those is a wrong set of books.

## Decision
- **The browser sends documents, not entries.** An invoice or bill save posts the document; the
  server builds the entries from the document and what the database holds — the chart, the
  workspace mappings and closing date, the document's earlier entries to reverse, the stock it
  sells — with the builders in `src/services/ledgerPost/` (`documentPostService.ts`, L-94 step 2).
- **One door for ledger writes.** Every server write of a `transactions` record goes through
  `ledgerWrite` / `ledgerCreate` (`src/server/services/ledgerDoor.ts`), which checks the workspace,
  whole cents, lines that balance and a total that matches the lines. Remaining writers outside the
  door are counted by the bug-pattern scanner, and `src/tests/bug-patterns.test.ts` refuses a new
  one, so the count only goes down.
- **One commit for a document save.** `commitLedgerBulk` (`ledgerBulkCommit.ts`) runs the role and
  closing-date checks, the idempotency key, "one live posting per document" (INT-2), the stock
  moves, the schema and the approval in a single database transaction. A save built from entries
  that changed meanwhile is refused with 409 rather than posted twice.
- **Row level security is the second lock,** not the first: server routes log in with a role that
  bypasses RLS, so each route does its own role check (see `requireLedgerWriter`).

## Consequences
- Amounts and lines never change in place; a correction reverses and reposts (a header can change —
  see `ledgerDoor.ts`).
- A screen that shows a figure from the browser's cache is a view of the ledger, not the ledger: the
  reports fall back to local calculation only when the server cannot answer, and say so.
- Server work is slower to iterate than a client-only change; every money change needs a
  worked-figures test, and money files belong to the lead (AI #1).
