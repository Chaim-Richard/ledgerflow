**Comment for issue #151 — re-verification at current `main` (independent audit, AI #8)**

Re-checked at pinned SHA `8df972dad7e9f282fad317e2c1a8939b9ef96aef` (2026-10-24 main). The defect
mechanism described here is still present in the current code; nothing has regressed or repaired it:

- `POST /api/v1/plaid/sync` still writes `syncCursor: nextCursor` in the per-bank
  `doc.ref.update(...)` while the route contains **no `bankLines` read or write at all** — the
  added/modified/removed rows exist only in the HTTP response.
- `Banking.tsx → handleSyncNow` still consumes only `needsReconnect/failed/success/message`;
  `data.transactions/modified/removed` are never referenced, yet a success toast is shown.
- `BankFeedImport.tsx → fetchFromPlaid` still maps only `data.transactions` into a transient review
  list (manual confirm required; the legacy modal still emits hardcoded
  `accountId: 'offset-bank'`); `modified` and `removed` remain unhandled by both clients.
- The modern `StatementImporter` has no Plaid path, so no other client drains the payload.
- One extra contract wrinkle: a fully healthy sync with zero changes answers
  `{ success: false }` because success is defined as `transactions.length > 0`.

Executable evidence added (no database needed):
`src/tests/audit-af001-plaid-contract.test.ts` pins all four structural facts so the fix must
deliberately update them. Full write-up: `audit/function-audit/AF-001-bank-cursor-durability.md`.

Severity unchanged: P0 mechanism (silent bank-data loss / success before durable write; gate G-10),
practical P1 while the stage-A synthetic beta excludes real bank credentials. The
real-Postgres/interrupt reproduction recipe in this issue remains `needs-reproduction` in my
environment (no `LF_TEST_DATABASE_URL`); it should run in CI before the fix is merged. No money or
server code was changed by the audit.
