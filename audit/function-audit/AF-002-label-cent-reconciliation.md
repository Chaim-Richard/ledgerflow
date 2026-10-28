# AF-002 — per-label cent reconciliation (`spreadLabels`)

**Pinned revision:** `8df972dad7e9f282fad317e2c1a8939b9ef96aef`
**Reviewer:** AI #8, independent audit Pass A · **Date:** 2026-10-25
**Predecessor:** GitHub issue [#152](https://github.com/shmuelbiller1/ledgerflow/issues/152) (closed — one-cent per-label imbalance), fixed by the “balancer line” logic (`#152` comments in `TransactionTemplates.ts`).
**Outcome:** original hypothesis **not reproduced** at this SHA — `verified-no-finding` for reachable document posting, with property tests; **one latent defensive-contract gap (AF-002-F1, P2)**.

## Source blobs

| File | Git blob SHA at pin |
|---|---|
| `src/kernel/templates/TransactionTemplates.ts` | `0d286d8053c6ffdc2af16d2d72fd0fd3f63702c3` |
| `src/server/services/paymentService.ts` | (working tree at pin; `payeeLabels`, `documentLabelWeights`) |

## Independently worked example (the mission's own figures)

Two labelled revenue parts of $100.00 each; tax $36.00; discount $1.01; total $234.99.
Through `TransactionTemplates.buildInvoiceLines` (observed, then re-derived by hand):

| Leg | Label A | Label B | Hand check |
|---|---|---|---|
| Revenue (credit) | −10,000 | −10,000 | gross revenue = 23,499 + 101 − 3,600 = 20,000 |
| Discount (debit) | 51 | 50 | largest remainder of 101 over equal weights |
| Tax (credit) | −1,800 | −1,800 | 3,600 split evenly |
| A/R balancer (debit) | 11,749 | 11,750 | makes each label sum to zero |
| **Label trial balance** | **0** | **0** | entry total also 0 |

The largest non-revenue line (A/R) is reserved as the *balancer*: every other leg is split by
largest remainder and the balancer receives, per label, exactly the amount that closes that
label to zero. Because the entry balanced before the split, the balancer parts always sum to its
original amount when every other line belongs to a label group.

## Executed evidence

`src/tests/audit-af002-label-cents.test.ts` (6/6 passing):

1. The exact mission example with hand-worked per-account, per-label figures (above).
2. Three labels with a 1-cent discount and non-divisible tax (100 over three): all three labels
   close to zero; revenue 10,034/10,033/10,033, tax 33/33/34, A/R 10,066/10,066/10,067.
3. Labelled customer receipt (70/30 weights): cash and A/R split in the same proportions, both
   labels close.
4. Labelled bill with tax + discount (mirror signs): both labels close.
5. **Property test, 2,000 random invoice shapes** (1–4 labels, totals to 500,000 cents, optional
   tax and discount): entry sum = 0 and every label sum = 0 in every case.
6. The latent gap below, locked as observed behaviour.

A separate 5,000-case property run on the kernel `allocateCents` (totals from −1,000,000 to
+1,000,000 cents, 1–6 weights including zeros) found zero sum violations: the parts always add up
exactly to the total, including negative totals.

## AF-002-F1 — non-positive tax/discount lines are silently dropped (latent, P2)

`buildInvoiceLines`/`buildBillLines` emit the tax and discount legs only when `taxCents > 0` /
`discountCents > 0`. Called directly with a negative total **and** negative tax (the shape a
credit note built through this template would have), the tax leg is omitted and the entry no
longer balances — observed: total −11,800, tax −1,800 produces lines summing to **−1,800**, with
no tax line.

Why it is not a live defect today: both production callers refuse non-positive document totals
before reaching the template — `invoicePosting.ts` and `billPosting.ts` each have
`if (amount <= 0) { …return; }`, and credit notes are posted with `buildReversalLines` (exact
negation of an already-balanced entry), not through these builders.

Proposed correction (AI #1's lane): have the builders assert the resulting line set sums to zero
and throw otherwise (or use sign-aware tax/discount legs), so a future caller cannot manufacture
an unbalanced journal. The test `AF-002-F1` locks current output and must be updated with the fix.

## Fallback path (also reviewed)

When a line carries a label outside the document's label groups, the balancer identity cannot
hold; the code detects `balancingParts.reduce(…) !== balancer.amountCents` and falls back to a
plain proportional split (documented in code). Probe with an extra zero-amount foreign-labelled
line: entry still balances and the foreign label keeps its own zero — acceptable, and the screen
contract for “not labelled” reporting is unchanged.
