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

## `rule-pack-snapshots/<date>.json` and `rule-pack-diff-<date>.md` (A-60)

`npm run diff:rule-packs -- --snapshot` writes a dated snapshot of every pack rule (the fields a review
reads: dates, rate, condition facts, combine, source). `npm run diff:rule-packs` compares the packs now
against the newest snapshot and writes `rule-pack-diff-<date>.md`: added rules, rules that ended, and
changed rules with the field, what it was and what it is now.

The report is what the packs **now say** — not a reviewed tax answer. A person checks each row against
its source before a filing position. The diff's pure core is covered by
`src/tests/rule-pack-diff.test.ts`; the script only reads the packs and the snapshot directory.

The 2026-10-12 snapshot (389 rules, every pack including the new A-40/A-41 content) is the first one;
the same-day diff is empty by construction, which is what it should report.
