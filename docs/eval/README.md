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

## `npm run lint:rule-packs` (A-110)

Not a report: the gate. `src/lib/rules/lint.ts` checks every rule the packs write — an id, a name, a
scope, at least one condition, a `validFrom` date, a `validTo` that does not precede it, an `https`
source with an authority, a status from the vocabulary (and `calculation` for this lane), a valid
combine and the targets it names — and `scripts/lint-rule-packs.ts` prints each problem with its pack
and its rule, exiting 1 when there is any.

```bash
npm run lint:rule-packs           # the table of problems, then the count
npm run lint:rule-packs -- --quiet  # just the count
```

`src/tests/rule-pack-lint.test.ts` runs the same check over every pack inside `npm test`, so a rule
that lands without a source fails CI rather than the reader. `taxRulePackProblems()` delegates to the
linter and adds what only the whole set can see: a duplicate id across packs and a target no pack
defines. The script was not run against the packs by hand here beyond `npm test`; the counts it prints
on 2026-10-13 are 579 rules checked, 0 problems.
