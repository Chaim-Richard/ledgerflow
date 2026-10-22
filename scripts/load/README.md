# Load tests (BP-06, task D-12)

Three scenarios, each one a request the app really makes:

| File | What it measures | What a person waits for |
|---|---|---|
| `sign-in.js` | the auth provider's password sign-in (`/auth/v1/token`) | the app opening |
| `dashboard-read.js` | `GET /api/v1/reports/profit-and-loss` — the heaviest report read | the dashboard |
| `post-invoice.js` | `POST /api/v1/documents/invoices/:id/post` — server-built entries, one transaction | saving an invoice |

They are **k6** scripts ([k6](https://k6.io) is a single binary; `brew install k6` or download a
release). They are **not part of CI**: they need a running server, a database with a year of data and
an account, and a shared CI runner would make their numbers meaningless.

## Run them

```bash
# 1. a server with a database and a 12-month test workspace (docs/GETTING_STARTED.md)
npm run dev

# 2. the settings every script reads
export BASE_URL=http://localhost:3000
export SUPABASE_URL=…            # the same project the app uses
export SUPABASE_ANON_KEY=…
export LOAD_EMAIL=owner@test…    # a real account, owner of the workspace
export LOAD_PASSWORD=…
export WORKSPACE_ID=…

# 3. one scenario at a time
k6 run scripts/load/sign-in.js
k6 run scripts/load/dashboard-read.js
k6 run scripts/load/post-invoice.js
```

Use **test books only**. `post-invoice.js` writes real invoices into the workspace it is given.

## What the numbers mean

Each script fails its own thresholds (that is the point — a green run that ignored latency would tell
you nothing):

| Scenario | Threshold |
|---|---|
| sign-in | p95 under 1 s, fewer than 1% failed |
| dashboard read | p95 under 1 s (the owner's target for the heaviest report, A-206) |
| post invoice | p95 under 2 s, fewer than 1% failed |

Record p50, p95, p99 and the failure rate, plus: the machine, the database size (accounts, entries,
months), the number of virtual users, and whether anything else was running. A number without those
five facts cannot be compared with anything.

Results so far are in [`docs/LOAD_TESTS.md`](../../docs/LOAD_TESTS.md).

## Reading a bad result

- **Errors are 401/403** — the token or the workspace id is wrong. Fix the test, do not read the
  latency: a refused request is fast.
- **`http_req_failed` climbs as VUs rise** — look for `429` (rate limit) before calling it a bug: the
  server rate-limits writes per workspace on purpose.
- **post p95 is far worse than read p95** — expected: a post takes a database transaction and the
  closing-date/role checks. Investigate only when it grows past the threshold at the VU count you
  actually expect.
- **Everything is slow at once** — check `/status` first (database slow/down) before touching code.
