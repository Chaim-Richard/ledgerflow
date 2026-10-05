# Pure helpers and algorithms

Read root AGENTS.md and docs/DEVELOPER_WORKFLOWS.md; check coordination ownership before touching shared financial helpers.

Pure algorithms receive context and parameters. They never fetch, read stores, call providers or post entries from compute(). Register through algorithms/index.ts, with typed inputs/results and documented insufficient-data behavior. Retain existing function order, seeds and shared random-generator state during refactors.

Money is integer minor units where the model declares it. Use the existing shared currency/line/report helpers; do not silently fix legacy totals while adding display features. Percentages with zero denominators are undefined; preserve the established display contract. Period statements and closing snapshots have different time semantics. CSV uses the shared writer and its current currency contract; changes to that contract need separate acceptance.

For every tool, explain actual data sources/scope, units, parameter ranges/defaults, implementation assumptions, an example, interpretation and limitations. Read the formula before describing it. A similarity score is not identity, a fraud score is not proof, and a Monte Carlo scenario is not a guaranteed cash balance. New algorithm inputs should use the sandbox's validated typed controls.

Hebrew and mixed-script comparison uses textNormalization helpers. Keep original display/stored text. Do not normalize stable IDs or bank import fingerprints. Quoted directives, exclusions and nested dimensions need explicit parsing and resolution. Trace persistence keys as well as pure matching; ASCII replacement can collapse distinct Hebrew names.

Preferences and record references are untrusted on reload. Validate allowed kinds, internal paths, lengths and numeric bounds; handle corrupt/blocked storage. Scope personal records by both user and workspace. Avoid storing financial rows or credentials in navigation preferences.

The pure-compute rule applies to calculations, not every file in lib. Existing lib/db and named metadata adapters such as inlineRecordAdapter are explicit I/O boundaries. Keep the allowlist/validation helpers pure and test adapters at the database request boundary.
