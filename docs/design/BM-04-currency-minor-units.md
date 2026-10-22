# BM-04 + BH-02 — how money is stored in currencies with 0 or 3 decimals

AI #9, 22 Oct 2026. Status: decided and built (this PR). Code: `src/lib/currencyMinorUnits.ts`.

## The decision (BH-02)

Every amount is a **whole number of the minor units of its own currency**, with the ISO 4217 decimals:

| Currency | Decimals | Stored for one unit | ¥1,000 / KWD 12.345 / $12.30 is stored as |
|---|---|---|---|
| JPY, KRW, ISK… (Intl's ISO data) | 0 | 1 | 1,000 |
| BHD, IQD, JOD, KWD, LYD, OMR, TND | 3 | 1,000 | 12,345 |
| everything else | 2 | 100 | 1,230 |

The fields keep their names (`amountCents`, `rateCents`…). For yen they hold yen, and for dinars they hold fils. This
is what the screens already assumed when showing amounts (`formatCurrency` divides by the currency's own divisor).
What was missing:

- **Typing:** amounts were always read as ×100. ¥1,000 typed became 100,000, which then showed as ¥100,000.
- **Converting:** a document's amounts were multiplied by its exchange rate as if both currencies had two decimals.
  ¥10,000 at 0.0067 became 67,000 "cents" ($670.00) instead of 6,700 ($67.00).

## The rule

- `currencyDigits(code)` gives the decimals. The screens use the same function (`utils.getCurrencyFractionDigits`),
  so storing and showing can never disagree.
- An **exchange rate** stays what the person sees: major units of the books' currency per major unit of the document's
  currency (0.0067 USD per yen). It is stored unchanged on the document and in the entry's
  `metadata.documentExchangeRate`.
- **Converting** minor units uses `minorUnitRate(rate, from, to)` = rate × 10^(decimals(to) − decimals(from)). The
  posting builders take it from `documentMinorRate` (postingCore), and the server's payment, bad-debt and prepaid
  services use it too.
  - With the same currency, or two currencies with the same decimals, it is the rate itself. Every existing USD, EUR,
    ILS and GBP figure is unchanged.
- **Typing** an amount on the invoice, bill and payment forms reads it in the document's currency
  (`TruthEngine.parseAmountToCents(text, currency)`), with a field step of 1, 0.01 or 0.001.

## Not in this step (listed for follow-up)

- The other forms that take amounts still read cents: credit notes, vendor credits, journals, expense claims, bank
  rules and imports, about 90 call sites of `parseAmountToCents` without a currency. They are correct for every
  2-decimal currency. A 0- or 3-decimal document entered there must still be checked.
- FX revaluation and the realized gain on a payment compare amounts that are already in the books' currency, so
  they need no change. Its entry is in base minor units.
- Reports show base-currency amounts and are unchanged.

## Worked figures (src/tests/bm04-currency-minor-units.test.ts)

- ¥10,000 at 0.0067 → 6,700 cents ($67.00).
- KWD 1.250 at 3.25 → 406.25 → 406 cents ($4.06).
- $12.34 at 150 → 1,851 yen.
- BHD 2.000 at 0.82 KWD → 1,640 fils.
- $67.00 back at 1/0.0067 → 10,000 yen.
- An invoice of ¥100,000 at 0.0067 in USD books: A/R +$670.00 and Sales −$670.00; the entry keeps the rate 0.0067.
- A bill of KWD 1.250 at 3.25: A/P −$4.06.
