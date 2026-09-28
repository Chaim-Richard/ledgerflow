# Coordination between the AIs working on LedgerFlow

Two AIs may work on this repository at the same time: **Claude** and **a second AI**
(named here when it starts). Both push straight to `main`. This file keeps them out of each
other's way. Read it **before starting any work** and update it **before and after** each item.

## Rules for both

1. `git pull origin main` before starting, and again right before pushing. Never force-push.
2. Read `AGENTS.md` (money rules) and `CLAUDE.md` first.
3. Work only on items in **your lane** (below). Before starting an item, add a row under
   **Now working on** with the files you will change, commit and push that. Remove the row
   when you have pushed the item.
4. Never edit a file listed under the other AI's **Now working on** row.
5. Before every push, all of these must pass (see `docs/TRACKER.md`, "machine setup"):
   `npx tsc --noEmit -p tsconfig.json` · `npm test` · `npm run lint:eslint` · `npm run build`.
   Never raise `quality-baseline.json` or `--max-warnings`; lower them when your change allows
   (`npm run ratchet:update`).
6. Never change a test's inputs or expected numbers to make it pass. If a test fails, the
   code is wrong until shown otherwise.
7. **Database changes:** write the migration file in `supabase/migrations/`, run it on a local
   copy, but do **not** apply it to Supabase. Add it under **Messages** for Claude, who applies
   migrations.
8. Tick finished items in `docs/TRACKER.md` with the commit id.
9. Short commit messages that say what the user gets, e.g. `fix(sales): "+" on a customer opened
   an empty invoice`.

## Lanes

| Who | Lane | Why |
|---|---|---|
| **Claude** | The LAUNCH list in order (now: #6d payment links / recurring pause / PO → bill, then #7 tax, #8 data-health checks, #9 speed, #10 forms, #11 trust & compliance), database migrations, anything touching money posting (`LedgerPostService`, server services, `supabase/`) | needs the database connection and the money rules |
| **Second AI** | The QUALITY list in `docs/TRACKER.md`: section G (array-index keys), E-02…E-07 (labels on inputs, selects, icon buttons, table captions), H (component tests for screens), D (`any` removal) — **only in files not listed under Claude's "Now working on"** | mechanical, low risk, many small files |

If the second AI finishes its lane, it asks here (under Messages) for the next one.

## Now working on

| Who | Item(s) | Files | Since |
|---|---|---|---|
| Claude | Launch #6d: K-11 payment links (Stripe webhook → payment record), BE-03 recurring pause/resume, BE-11 PO → bill | `server.ts` (Stripe webhook part), `src/server/routes/publicInvoiceRoutes.ts`, `src/server/services/paymentService.ts`, `src/server/services/recurringService.ts`, `src/components/sales/*`, `src/components/purchases/*` | 2026-09-28 |

## Messages (newest at the bottom; date + who)

- 2026-09-28 Claude: file created. Second AI: add your name to the tables above when you start.
