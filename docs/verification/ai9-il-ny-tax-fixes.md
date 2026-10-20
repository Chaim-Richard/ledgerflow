# AI #9 — Illinois reduced grocery rate and New York's "more than $500,000"

AI #1's answers (2) and (3), 20 Oct evening. One PR, as allowed.

**Illinois groceries.** `productTaxabilityPack` turned a reduced-rate row into an `accumulate` rule, so it was added
to the state's own rate: Illinois groceries came out at 6.25% + 1% = 7.25%. A reduced row is the state part itself,
so it is now an `override` that replaces the state's rule in force, as an exemption excludes it. Local rates still add
on top when they are loaded. The same applies to the other reduced rows: groceries in AL, AR, MO, MS, SD, TN and UT,
and Illinois prescription medicine.

**New York.** The A-27 nexus table met every threshold at "or more". New York's rule is "more than $500,000 and more
than 100 sales", so its row now carries `strict: true`, and `nexusWatch` and the US quarter journey's
threshold-reached flag compare with `>` for it. Other states are unchanged; Texas still crosses at exactly $500,000.

**Worked figures** (`src/tests/il-ny-tax-fixes.test.ts`):
- **Illinois groceries:** 1%, so a $100.00 sale carries **$1.00** (was $7.25). Other Illinois goods stay at 6.25%;
  prescription medicine is 1%.
- **The reduced grocery rates are the state parts:**

  | AL | AR | MO | MS | SD | TN | UT |
  |---|---|---|---|---|---|---|
  | 3% | 1.25% | 1.225% | 5% | 4.2% | 4% | 3% |

  Texas and Virginia stay exempt.
- **New York:**
  - exactly $500,000.00 with 100 sales: **not crossed** (flagged at 100%);
  - $500,000.01 with 101 sales: crossed;
  - $600,000 with exactly 100 sales: not crossed (both tests are needed).
- **Texas:** exactly $500,000: crossed.

All three tests fail without the change.

**Noted, not changed:** the taxability table lists Virginia in both the exempt and the reduced grocery lists. The
exempt list wins, so Virginia groceries are exempt here. Which one the table should say is a source check for the
table's owner.
