# L-94 — invoice and bill postings built on the server

AI #1, 21 Oct 2026. Status: design (no code yet). Owner: AI #1.

## Today

1. The browser saves an invoice or bill (`useEntityOperations.ts`) and calls `postInvoiceLedger` / `postBillLedger`
   (`src/services/ledgerPost/`). Those build the entry lines **in the browser** from the document, the chart of
   accounts and the earlier entries the browser has loaded (`LedgerPostContext`).
2. The document and its entries go to the server in one request (`POST /transactions/bulk`, `bulkRoutes.ts`).
3. The server checks a lot: the entry balances, accounts belong to the workspace, the period is open, the request
   is not a duplicate (idempotency key), a stale save of a changed document is refused (409), an order is not
   over-invoiced.

## The gap

The server checks that the entry **balances**, not that it **matches the document**. The amounts come from the
browser. A stale tab (an old chart, missing earlier entries to reverse) or a modified client can post an entry
that balances but does not equal the invoice: wrong revenue account, wrong tax, a missing reversal. Nothing in
the books catches it until a report looks wrong.

## The plan (four steps, each shippable)

**Step 0 — split the builders from the browser (found 21 Oct).**
`postingKit.ts` imports the browser Firebase client, the screen stores (`useLedgerStore`, `useAuthStore`) and
`sonner` toasts, and `getAccounts/getTransactions/getWorkspaces` fall back to the stores when no context is given.
The server must not load any of that. Move the pure parts (`findAccount`, `resolveAccount`, `lineAccounts`,
`inBaseCurrency`, `reversalDate`, `verifyLockDate`, the context getters **without** store fallback) to
`src/lib/posting/postingCore.ts`; `postingKit.ts` keeps the store fallbacks and `postTxsServerApi`, and passes a
filled context to the builders. Each builder gets a pure twin, e.g. `buildInvoiceEntries(id, data, ws, uid, ctx)
→ PostableTransaction[]`, which `postInvoiceLedger` calls and then sends. Test: every existing posting suite
passes unchanged, and a new test imports the pure builders with the browser modules stubbed to throw.


**Step 1 — the server rebuilds and compares (shadow, then enforce).** *Shadow part done 21 Oct:* `src/server/services/postingShadowCheck.ts`, called by `bulkRoutes.ts` after the commit for invoice and bill saves; it logs `L-94 shadow: …` (match, difference with the missing/extra lines, or could not rebuild). Test `l94-shadow-check.test.ts` (match, a tampered but balanced entry, an edit with its reversal).
The builders are already pure apart from their context (`getAccounts(context)`, `getTransactions(context)`).
In `bulkRoutes.ts`, when the request carries an invoice/bill mutation, the server builds a context from the
database **inside the same transaction** (chart, workspace mappings, that document's live entries) and runs the
same builder. It compares its lines with the browser's (account, amount, labels; order ignored).
- First release: log a mismatch with both versions (no refusal) for one week of testers.
- Then: refuse with 409 "This invoice changed while you were editing; reload and save again".
- Test: the existing posting suites run through the server path and must give identical lines; a tampered
  request (revenue moved to another account, tax line dropped) is refused.

**Step 2 — the browser stops sending lines.**
New `POST /api/v1/documents/:type/:id/post` saves the document and builds its entries on the server in one
transaction (same idempotency rules as bulk). `useEntityOperations` calls it; the browser only shows the result.
Payments, credit notes and stock (COGS) follow the same route one at a time.

**Step 3 — remove the browser builders** from the save path (keep them only for previews, marked so).

## Before enforcing (found 22 Oct)
"Today" decides the date of a reversal when the original entry is in a closed period. The browser and the server
must use the same today: the workspace's time zone, taken once per save. Near midnight a browser in another time zone
can be a day apart from the server, so the save request should carry the day the browser used and the server should
check it is within one day of its own before comparing; otherwise the shadow check reports a false difference.

**Done 22 Oct (AI #1):** the bulk save carries `postingDay` (the browser's `postingToday`); the shadow rebuild uses it
when it is a real date within one day of the server's today (`agreedPostingDay`, postingShadowCheck.ts), else its own.
The day is left out of the idempotency hash, so a retry after midnight is still the same save. Test:
`src/tests/l94-posting-day.test.ts`. Invoices and bills (step 2) are built on the server, so this concerns credit notes and
vendor credits. ~~Left before enforcing: the shadow logs of the first testers.~~

**Enforced (L94-STEP2B, checked 24 Oct):** no document entries come from the browser any more, so there is nothing
live to compare; `/transactions/bulk` refuses invoices, bills, credit notes and vendor credits and any entry that names
one (`documentPostedByServer` in bulkRoutes.ts). The shadow comparison stays as a test helper
(`src/tests/helpers/postingShadowCheck.ts`) proving the server rebuilds what the browser builder would.

## What does not change
How amounts are calculated: the same builders, the same worked-figure tests (DIM-1, W2, W3W4-GOLD, W13-GOLD,
PAY-1). Only *where* they run moves.

## Order and risk
Step 1 is small (one route, no new UI) and closes most of the gap; do it first. It needs the context loader to
read everything the builders read before the first write (Postgres transaction rule). Steps 2–3 are larger and
can wait until after stage A.
