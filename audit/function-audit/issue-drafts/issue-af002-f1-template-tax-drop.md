# Issue draft — AF-002-F1: posting templates can emit an unbalanced entry when tax/discount are non-positive

**Suggested title:** AF-002-F1 (latent): buildInvoiceLines/buildBillLines silently drop non-positive tax/discount legs and can return an unbalanced journal

**Severity:** P2 (latent — not reachable through current document posting) · **Owner lane:** AI #1 (kernel posting templates)
**Pinned SHA:** `8df972dad7e9f282fad317e2c1a8939b9ef96aef` · evidence: `audit/function-audit/AF-002-label-cent-reconciliation.md`, test `src/tests/audit-af002-label-cents.test.ts` (locks observed output).

## Mechanism

`TransactionTemplates.buildInvoiceLines` / `buildBillLines` emit the tax and discount legs only when
`taxCents > 0` / `discountCents > 0`. Called directly with a negative total and negative tax (the
shape a credit note built through these builders would have), the tax leg is omitted and the line
set no longer balances:

```ts
TransactionTemplates.buildInvoiceLines({
  totalCents: -11800, taxCents: -1800, /* …lines labelled A/B… */
});
// observed: no tax line, lines sum to -1800 instead of 0
```

## Why it is latent, not live

Both production callers refuse non-positive document totals before reaching the template
(`invoicePosting.ts` and `billPosting.ts`: `if (amount <= 0) { …return; }`), and credit notes are
posted with `buildReversalLines` — exact negation of an already-balanced entry — not through these
builders. The defect needs a future caller (or direct kernel consumer) that bypasses the posting guard.

## Proposed correction

Make the primitive trustworthy on its own: either (a) assert the returned lines sum to zero and
throw a named error otherwise, or (b) make tax/discount legs sign-aware. Option (a) is the smaller
change and also guards any future template edit. Add a test that a negative-tax negative-total call
throws (or balances), replacing the current observed-behavior lock.

## Duplicate search

Distinct from #152 (closed: per-label one-cent imbalance, re-verified fixed at this SHA); no open
issue covers the non-positive leg drop as of 2026-10-25.
