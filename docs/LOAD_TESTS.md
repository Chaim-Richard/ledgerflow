# Load tests — what was measured, and what is still to measure

Task D-12 (tracker BP-06). The scripts are in [`scripts/load/`](../scripts/load/README.md); this page
is the record of the numbers.

## The three scenarios

| Scenario | Request | Threshold the run must meet |
|---|---|---|
| Sign in | `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` | p95 < 1 s, failures < 1 % |
| Dashboard read | `GET /api/v1/reports/profit-and-loss?workspaceId=…` | p95 < 1 s, failures < 1 % |
| Post an invoice | `POST /api/v1/documents/invoices/:id/post` | p95 < 2 s, failures < 1 % |

## Measured — server lane, no database (22 Oct 2026)

This sandbox has no Postgres and no Supabase project, so only the server's own HTTP path could be
measured here. It is a real number and it is the floor for the two database scenarios: everything
above it is the database and the report maths.

| Setting | Value |
|---|---|
| Machine | Arena sandbox container (shared CPU), Node 24, `npx tsx server.ts` |
| Endpoint | `GET /api/health` (answers without the database) |
| Load | 900 requests, 10 concurrent, one connection each |
| **Throughput** | **437 requests/second** |
| **p50 / p95 / p99** | **12.2 ms / 53.0 ms / 211.0 ms** |
| Failures | 0 |

Interpretation: the process, routing and middleware add a median of ~12 ms. Nothing here is close to
the 1 s report budget, so the report's latency will be the database's (and the report maths), not the
framework's.

## Measured — the request ceiling (found while taking the number above)

A first run of **2,000** requests at 20 concurrency had **1,000 successes and 1,000 refusals**, all of
them:

```
{"status":"error","message":"Maximum rate limit reached. Please hold for calibration."}
```

That is the app-wide limiter in `src/server/middleware/rateLimiters.ts`: **1,000 requests per 15
minutes per IP** for every route. Two consequences:

1. **A load test must respect it.** The k6 scripts therefore keep their request counts inside a
   window (or run against a deployment whose limiter is raised), and a climbing `http_req_failed`
   together with a 429 is the limiter, not a slow server.
2. **It is worth the owner's attention for real users.** An office (or a school, or a family) behind
   one public IP shares that bucket: a few people with the dashboard open and reports refreshing can
   reach 1,000 requests in 15 minutes. This is reported to the lead as a finding — the limiter is
   money/infrastructure (`src/server/`), so it is not changed here.

## Still to measure (needs a database and a test account)

Run these on a machine with the test database and a 12-month workspace (see
`scripts/load/README.md`), then fill the table:

| Scenario | VUs × duration | p50 | p95 | p99 | Failures | Machine / data size |
|---|---|---|---|---|---|---|
| Sign in | 5 × 30 s | — | — | — | — | — |
| Dashboard read | 20 × 60 s | — | — | — | — | — |
| Post invoice | 5 × 60 s | — | — | — | — | — |

Record with every row: machine (CPU, memory), database (rows, months, indexes added), virtual users,
and anything else running. A latency without those cannot be compared with a later run.

## Why it is not in CI

The three scenarios need a server, a database with a year of data and an account with a real password.
CI runs on a shared runner with an empty database: the numbers would measure the runner, not the
product. The rule from `docs/adr/0007-ci-local-first-then-github.md` applies — a load number is
evidence taken by a person with a stated setup, never a green check.
