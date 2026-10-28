# AF-012 — an override chain's answer depends on the order of the rule array

**Pinned revision:** `50ee1205d9049d7c225beb433bcb3dff75b77be9` (upstream `main`, 2026-10-25)
**Reviewer:** AI #8 (independent audit, review-only) · **Date:** 2026-10-25
**Tracked as:** GitHub issue [#161](https://github.com/shmuelbiller1/ledgerflow/issues/161) (open, AI #4 D-34 preflight) — re-verified at this pin with an executed probe.
**Outcome:** `verified-defect` — **P2 latent**. The mechanism is real and order-dependent; no shipped pack
currently contains an override that targets another override, and nothing in the linter refuses one.

## Source blobs at the pin

| File | Git blob |
|---|---|
| `src/lib/rules/rules.ts` (the override pass, lines 72–76) | `0cde94c4ff9e` |
| `src/lib/rules/packs/ilVatPack.ts` (area override → every standard rule) | `753f5fd3a9b1` |
| `src/lib/rules/packs/usLocalRatePack.ts` (combined local rate → state rate rules and components) | `5e01893cc1a6` |
| `src/lib/rules/lint.ts` (checks `targets` is non-empty; no cycle/chain check) | — |

## What the code does

```
// exclusions first, then overrides: a switched-off rule cannot replace another
const off = new Map<string, string>();
for (const { rule } of candidates) if (rule.combine === 'exclude') for (const t of rule.targets || []) off.set(t, rule.id);
for (const { rule } of candidates) if (rule.combine === 'override' && !off.has(rule.id)) for (const t of rule.targets || []) if (!off.has(t)) off.set(t, rule.id);
```

The guard is `!off.has(rule.id)` **at the moment the rule is visited**. A rule that is displaced *after* it
has already displaced its own targets leaves those targets displaced (and not applied). Because `Rule` has
no priority field, the input order — which for packs is construction order, i.e. source order — decides the
answer.

## Executed evidence

```sh
npx tsx audit/function-audit/probes/af012-rule-chain-order.mjs
```

```
order A,B,C -> applied A,C | displaced B by A
order B,A,C -> applied A | displaced B by A, C by B
order C,B,A -> applied A | displaced C by B, B by A
```

Rules: A overrides B, B overrides C, C accumulates, all active on the same facts. In the second order C is
switched off by a rule that is itself switched off — which the documented sentence ("a switched-off rule
cannot replace another") says should not happen, and which the first order does not produce.

## Reachability at this pin (measured, not assumed)

```sh
npx tsx audit/function-audit/probes/af012-shipped-pack-chains.mjs
packs: 18, rules: 584, overrides: 67
override targets that are themselves overrides: 0
dangling targets: 0
```

Shipped packs use overrides heavily (`il-vat-area-*`, `us-local-*` combined rows, UK schemes, Canada HST,
product taxability) but every current target is an **accumulate** rule or a component of the same place —
so the two orderings that differ are not reachable from today's packs. Reason: the pack builders derive
targets from the rate tables, and none of those tables nests an override under an override.
- `lintRules` refuses a rule that overrides with no targets and a target that does not exist, but not a
  chain, a cycle or two overrides targeting each other. A future pack can produce one without any test failing.
  (`usLocalRatePack` cannot today: it targets state rules and component rows and keeps combined rows out of
  `samePlace`, so overlapping combined rows do not chain.)

## Proposed correction (AI #9 / AI #1 lane — rules engine)

Pick one deterministic semantics and enforce it instead of relying on order:

1. **Reject unsupported graphs.** In `lintRules`, refuse an override whose target is itself an override, and
   any cycle among overrides/exclusions. That keeps today's packs valid and turns the next one into a loud
   failure with the rule ids named.
2. Or **resolve to a fixed point**, so a chain has one answer whatever the array order. Re-running the current
   pass is not enough: its `off` map never removes an entry, so in the `B,A,C` example `C` stays displaced by
   `B` even after `A` displaces `B`. Each round must recompute displacements only from overrides that are still
   applied (dropping effects of displaced overrides), stop when the applied set stops changing, and refuse a
   cycle (an applied set that repeats) with the rule ids named. Report the final `by` for each displaced rule.

**Acceptance test:** the same three rules in all six permutations produce one identical outcome, plus a lint
case that refuses `A overrides B` where `B` overrides `C`, and a property test over random small graphs
asserting permutation-invariance. Worked tax figures in the existing packs must not move.

## Limits

Executed against `evaluateRules` directly (no HTTP, no workspace). The probe demonstrates the engine, not a
wrong tax figure in a live book: with the current packs the applied and displaced sets are order-stable because no chain exists. The
`displaced[].by` attribution is not: exclusions are kept in a Map keyed by target, so when two exclusions name
the same target (e.g. the Texas grocery and prescription-medicine exemptions) the later one in input order wins,
and reversing them changes `by`.
