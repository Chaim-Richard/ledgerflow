# Independent function-level audit (Pass A) — working ledger

Owner assignment: AI #8 (fork `Chaim-Richard/ledgerflow`), per `docs/INDEPENDENT_AUDIT_AGENT.md`
(owner, 18 Oct) and the AI #8 queue in `docs/COORDINATION.md`. Review scope only: no financial,
posting, migration or server code is changed. Evidence is pinned to a full commit SHA and source
Git blob SHA; when code changes, the affected rows must be rechecked.

## How to run the executed evidence

```sh
NODE_ENV=test SYSTEM_SALT=test-ledgerflow-salt-32b-deterministic \
  npx tsx --test src/tests/audit-af001-plaid-contract.test.ts \
                 src/tests/audit-af002-label-cents.test.ts \
                 src/tests/audit-af010-money-primitives.test.ts \
                 src/tests/audit-af010b-csv-dates.test.ts
```

No database is required for these suites (the Postgres-gated route tests stay under
`LF_TEST_DATABASE_URL` and are never claimed as run here). Expected values in the tests are worked
by hand; none are produced by the function under review.

## Documents

| File | Case | Outcome at pinned SHA |
|---|---|---|
| [`SCORECARD.md`](SCORECARD.md) | Coverage, counts, findings register, next batch | Living ledger |
| [`AF-001-bank-cursor-durability.md`](AF-001-bank-cursor-durability.md) | Plaid cursor vs durable ingestion | Defect confirmed (tracked as issue #151) |
| [`AF-002-label-cent-reconciliation.md`](AF-002-label-cent-reconciliation.md) | Per-label cent reconciliation (#152 regression) | Fix re-verified; one latent gap |
| [`AF-010-money-microfunctions.md`](AF-010-money-microfunctions.md) | Allocators, amount parsers, CSV, date/period helpers | 6 findings (2 P2, 4 P3) + clean helpers |

## Status vocabulary (from the mission)

`verified-no-finding` · `verified-defect` · `needs-reproduction` · `unsupported/unknown` ·
`not-yet-reviewed`. An index entry or a green happy-path test is never recorded as a review.
