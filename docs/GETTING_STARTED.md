# Getting started

For a developer with nothing but this repository. Each step says what you should see; if you
don't, the last section says why. Tried on a fresh clone on 11 Oct 2026: install 22 s, tests
without a database 1,886 pass, with one 2,254 pass.

## 1. What you need

- **Node 24** (`.nvmrc`; `nvm use` picks it). Node 20 or 22 will not do: `package.json` requires 24.
- **Git.**
- For the database tests: **PostgreSQL 15 or newer** on your machine, or Docker.
- For using the app with your own data: a free **Supabase** project (step 5). Not needed for steps 2–4.

## 2. Install

```bash
git clone <this repository> ledgerflow && cd ledgerflow
nvm use            # Node 24
npm ci             # about 20 s; "added 11xx packages"
```

## 3. Run the tests (no database, no settings)

```bash
npm run lint       # type check and ESLint: 0 errors (some warnings are allowed, at most the number in package.json)
npm test           # about 1,900 tests, all pass; the database tests are skipped
```

## 4. Run the database tests (a plain local Postgres)

The database tests use an empty local Postgres, never a Supabase project (the setup refuses one).

```bash
# a Postgres to test against, if you have none (Docker):
docker run -d --name lf-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16

# create the empty test database (the setup does not create it)
createdb -h localhost -U postgres lf_test          # or: docker exec lf-pg createdb -U postgres lf_test

export LF_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lf_test
npm run db:test-setup    # a small stand-in for Supabase's auth schema, then every migration in order
npm run test:rules       # "ALL RLS TESTS PASSED": the row level security rules
npm test                 # now about 2,250 tests, all pass
```

To start again from empty: `dropdb lf_test && createdb lf_test && npm run db:test-setup`.

Browser tests (Playwright, about 15 minutes; they start the app themselves):

```bash
npx playwright install chromium    # once
npm run test:e2e
```

Everything at once, as a contributor should before pushing: `npm run verify` (install check, lint,
tests, database rules, dependency audit, browser tests). (`playwright.local.config.ts` is for the
maintainers' sandbox, whose Chromium lives at a fixed path; you don't need it.)

## 5. Use the app

### a) Straight away, no setup: guest mode

```bash
npm run dev        # http://localhost:3000 (PORT=xxxx to change it)
```

Choose **Continue as Guest**. Everything works in the browser with sample books and nothing is saved
to a server, so it is safe to try anything. The server prints "No database configured" for its
background jobs; that is expected here.

> **Safe default:** without your own Supabase variables, local development uses an inert project
> address, **not** the live LedgerFlow project. Sign-in cannot work until you configure your own
> `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and matching server `SUPABASE_URL`.
> Production builds still use the published project defaults unless overridden.

### b) With your own data: your own Supabase project

1. Create a project at supabase.com.
2. Apply the database: in the dashboard **SQL editor**, run each file of `supabase/migrations/` in
   name order, or from a terminal with the project's connection string:
   ```bash
   for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || break; done
   ```
   Run them once, in order. Some files cannot be run twice (they create tables), so a second run
   reports "already exists": that only means it is already applied.
3. `cp .env.example .env` and fill in the Supabase lines (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `DATABASE_URL`). Everything else has a working
   default in development; each optional service (email, Stripe, Plaid, AI) says "not set up" until
   its keys are added.
4. In Supabase → Authentication, allow email sign-up (and set the site URL to `http://localhost:3000`).
5. `npm run dev`, sign up, and the setup wizard makes your first workspace.

## 6. A complete bookkeeping round, to check everything works

In guest mode or your own project, in this order:

1. **Settings → Chart of accounts**: the template accounts are there (Cash, Accounts receivable, Sales…).
2. **Money In → Sales → Add invoice**: a customer, one line, save as sent. Sales shows it unpaid.
3. **Money In → Payments → Receive payment**: pay that invoice in full. It shows paid.
4. **Money Out → Purchases → New bill**, then pay it the same way.
5. **Transactions**: the four entries are there, each balanced (debits equal credits).
6. **Reconcile**: import a bank statement and match the lines. A three-line CSV is enough:
   ```
   Date,Description,Amount
   2026-10-05,Payment from customer,1000.00
   2026-10-06,Supplier,-250.00
   ```
7. **Reports → Profit & Loss** and **Balance Sheet**: the sale and the bill are in them; click a
   figure to see the entries behind it. Balance sheet: assets equal liabilities plus equity.
8. **Month-End Close**: close the month; editing an entry in it is now refused.
9. **Settings → Backup & Export**: download a backup.

The browser tests `e2e/accounting-lifecycle.spec.ts` and `e2e/smoke.spec.ts` walk much of this path automatically.

## 7. Where things are

- `README.md`: what LedgerFlow is and its architecture. `docs/CAPABILITIES.md`: what works today, its
  limits and the test behind each feature.
- `src/lib/`: the bookkeeping rules (pure functions, tested). `src/server/`: the API and the
  server-only writes. `src/components/`: the screens. `supabase/migrations/`: the database and its
  access rules. `src/tests/` and `e2e/`: the tests.
- `AGENTS.md` and `src/lib/AGENTS.md`: the conventions (amounts in whole cents, no hard-coded
  accounts, every financial sum through `isPostable`).
- Limits checked by the tests: no file over 799 lines; no new ESLint warnings (the number in
  `package.json` only goes down); `quality-baseline.json`.

## Visual regression screenshots (AI #4, D-10)

`npx playwright test e2e/visual-regression.spec.ts` compares ten guest screens at
1280px and 390px widths, in light and dark themes (40 images). The fixed date is
30 September 2026; report dates and guest financial records are deterministic.
Images live in `e2e/__screenshots__/`. Financial values and controls are not masked.
Capture height expands to include the application's internally scrolling content;
the responsive width stays fixed, so the report body is compared as well as its header.
The allowance is 100 pixels with a 0.1 color threshold, independent of page height.

For an intentional UI change, use Node 24, `npm ci`, and
`npx playwright install --with-deps chromium` on the same Linux environment as CI.
Run `npx playwright test e2e/visual-regression.spec.ts --update-snapshots`, inspect
every changed image (including phone wrapping and dark contrast), then commit only
the approved PNGs. Rerun without `--update-snapshots` before pushing. Do not update
images just to silence a failed comparison or increase the tolerance. Different
browser versions or operating-system fonts can produce different images; use the
CI browser version rather than accepting those changes as product changes.

## When something goes wrong

| You see | Why | Do |
|---|---|---|
| `database "lf_test" does not exist` | the setup does not create the database | `createdb lf_test`, then `npm run db:test-setup` again |
| `ECONNREFUSED 127.0.0.1:5432` | Postgres is not running | start it (`docker start lf-pg`) |
| `Refusing to install the test stub into a Supabase database` | `LF_TEST_DATABASE_URL` points at Supabase | use a local Postgres |
| `engine "node" is incompatible` | not Node 24 | `nvm install 24 && nvm use` |
| `No database configured` in the server log | no `DATABASE_URL` | fine in guest mode; set it for your own project |
| a migration says `already exists` | it was applied before | nothing to do |
| a browser test times out on a click | an overlay (the cookie banner) is in the way | dismiss it first, as the existing tests do |
