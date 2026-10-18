# D-32 Israeli VAT report golden periods — AI #4

These are independent report fixtures in `src/tests/il-vat-return-golden.test.ts`, alongside the unchanged existing `il-vat-return.test.ts`. All figures below are literal integer **agorot**. Expected totals do not call a production arithmetic, tax, FX or registration helper.

| Period / scenario                                            | Taxable sales | Output VAT | Zero-rated sales | Exempt sales | Equipment inputs | Other inputs | To pay / refund | Count |
| ------------------------------------------------------------ | ------------: | ---------: | ---------------: | -----------: | ---------------: | -----------: | --------------: | ----: |
| January 2026 mixed month                                     |         90000 |      16200 |            50000 |         5000 |            32400 |         7200 |          -23400 |     9 |
| Equipment credit received in a later period                  |             0 |          0 |                0 |            0 |            -3600 |            0 |            3600 |     1 |
| Export / qualifying Eilat / exempt credits                   |             0 |          0 |            75000 |        25000 |                0 |            0 |               0 |     6 |
| January boundaries, status and registration exclusions       |         20000 |       3600 |                0 |            0 |                0 |            0 |            3600 |     2 |
| Registration active January 16–31, report through February 1 |         20000 |       3600 |                0 |            0 |                0 |            0 |            3600 |     2 |
| Saved FX rate 3.7 with sale, credit and equipment bill       |         33300 |       5994 |                0 |            0 |             3330 |            0 |            2664 |     3 |
| December 2024 / January 2025 saved 17% / 18% VAT             |         20000 |       3500 |                0 |            0 |                0 |            0 |            3500 |     2 |
| Half-agorot FX rounding and equipment-credit cancellation    |            18 |          4 |                0 |            0 |                0 |            2 |               2 |     5 |
| Empty / unregistered / different registration                |             0 |          0 |                0 |            0 |                0 |            0 |               0 |     0 |

For the mixed month, sales net is 100000 − 10000, output is 18000 − 1800, equipment inputs are 36000 − 3600, and other inputs are 9000 − 1800. The refund is 16200 − 32400 − 7200 = -23400. Export 30000 and qualifying Eilat 20000 remain separate from exempt 5000. A deep comparison also verifies that reporting leaves the documents and profiles intact.

The FX rounding case deliberately puts 1.5 agorot of VAT on each source document: each rounds to 2 before aggregation. Two sales therefore contribute 4, not an aggregate-rounded 3. Equipment input and its credit cancel, while the other input leaves 2 to pay.

The fixtures exercise the **pure report-input contract**, not a persistence-to-report adapter. Credit fixtures use real `open` lifecycle states; an additional case covers `open`, `applied`, `partially_applied`, and excludes `draft`/`void` for both credit kinds. Each counted credit-only period has taxable sales -10000, output -1800, other inputs -900, to pay -900 and count 2. Existing expected monetary totals are unchanged.

**Connection gap [#160](https://github.com/shmuelbiller1/ledgerflow/issues/160):** equipment fixtures explicitly provide synthetic `fixedAsset` classification required by `IlVatDocument`. Persisted Bill/VendorCredit models do not supply this flag, and no production caller derives it from saved lines/accounts. The helper is exported but only tests directly call it. These fixtures therefore do not verify equipment classification from saved books or a reachable VAT-return screen. Lead-owned adapter/screen work and a real persistence-to-report test remain required. They do not decide whether any real Eilat transaction qualifies for relief, prove allocation-number acceptance, validate a posted ledger, file a return, or close a period. VAT registration dates and entity ownership are exercised by the actual report helper. The historic-rate case preserves the two saved VAT amounts; it does not recompute historical documents at today's rate. Existing statutory rate references remain in `src/lib/tax/ilVatRates.ts` ([Israel Tax Authority](https://www.gov.il/he/departments/israel_tax_authority)). These are hand-worked fixtures, not claimed authority-published examples.

Run the focused cases with the repository's installed dependencies:

```sh
NODE_ENV=test SYSTEM_SALT=test-ledgerflow-salt-32b-deterministic TZ=Pacific/Auckland npx tsx --test src/tests/il-vat-return.test.ts src/tests/il-vat-return-golden.test.ts
```

Repeat with `TZ=America/Los_Angeles`. The normal unit and coverage commands discover the new file automatically. Full install, database/RLS, coverage, build, security and browser verification runs through the owner-authorized GitHub gates. Local focused evidence and final CI results are recorded in the PR description; no whole-workflow release sign-off is implied. W7 remains Partly/Partly/No until its connected and browser journeys are verified.
