# Evaluation reports

Dated, run-by-hand reports. Nothing here is produced by the unit suite or by CI.

## `rule-pack-sources-<date>.md` / `.json` (A-59)

Produced by `npm run check:rule-sources`, which lists every **unique** source URL of the tax rule
packs once and asks each one for a page. It records: `answered` (HTTP 200), `http-error` (any other
status), `unreachable` (a timeout or a network failure) and `skipped` (dry run).

What it proves: the authority's page answered on that day, and which rules depend on that URL. What it
does **not** prove: that the page still contains the rate, threshold or form the rule was written from.
The status of a page is never a tax position, and the unit tests (`src/tests/rule-source-check.test.ts`)
use a stub fetcher so they never touch the network.

```bash
npm run check:rule-sources            # live check; run from a machine with internet access
npm run check:rule-sources -- --dry   # no requests: the URL list and the report shape
```

The 2026-10-12 `-dry-run` file was produced in a sandbox without general internet access, so it
records the URL list and the report shape only. Re-run the live command there and commit its dated
report (do not overwrite the dry run; the two say different things).
