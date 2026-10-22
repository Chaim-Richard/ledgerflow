# Israeli bank statement CSV import (E-26 / E-43)

Banking → **Import statement** → *Israeli bank CSV* reads an Israeli bank's account-activity CSV
into the existing bank-import **review** step. Nothing is posted, matched or converted: the rows go
through the same review, duplicate check and "Import N entries" action as every other statement.

Owner tasks: COORDINATION **E-26** (Israeli bank file formats: Leumi, Hapoalim, Discount) and
**E-43** (Israeli bank CSV formats: Hapoalim, Leumi, Discount, Mizrahi).

| File | What it does |
|---|---|
| `src/lib/israeliBankCsv.ts` | Pure reader: finds columns by header name, validates dates and shekel amounts, returns `ParsedBankLine[]` |
| `src/components/ledger/StatementImporter.tsx` | The two controls (*Israeli bank CSV*, *Statement date order*) and the guard rails |
| `src/tests/israeli-bank-csv.test.ts` | The reader's worked figures and refusals (7 tests) |
| `src/tests/bank-statement-import-ui.test.tsx` | The screen: date order required, rows reviewed, a closing balance never imported, refusals |

## Honest scope: column names, not bank names

Israeli banks do not publish one shared layout, and their exports differ by product, account type and
year. This reader therefore **does not claim "Hapoalim format"** or any other bank's file. It reads
the columns **by their header names**, in Hebrew or English, whichever order they appear in:

| Field | Header names recognised (normalised) |
|---|---|
| Date | תאריך · תאריך ערך · תאריך תנועה · תאריך פעולה · תאריך חיוב · date · value date · transaction date · posting date |
| Description | תיאור · תיאור התנועה · תיאור הפעולה · פירוט · פירוט התנועה · תוכן · description · details · narrative · memo · payee |
| Reference | אסמכתא · מספר אסמכתא · מס אסמכתא · אסמכתה · reference · ref · check number |
| Debit | חובה · חיוב · debit · withdrawal(s) |
| Credit | זכות · זיכוי · credit · deposit(s) |
| Amount (single column) | סכום · סכום התנועה · סכום הפעולה · amount |
| Balance (optional) | יתרה · יתרת סגירה · יתרה לאחר תנועה · balance · running balance |

Two shapes are supported:

- **debit and credit columns** — each cell is a positive shekel figure; debit is money out (`-`), credit money in (`+`);
- **one signed amount column** — `-500.00`, `(500.00)`, `500.00-`, `₪1,000.00`.

A file whose headers are different must use the manual column mapping. There is no guessing, and no
bank is named as "supported" on the strength of a fixture.

**Headers are matched after normalisation**: trimmed, lower-cased, and with quotes, Hebrew
gershayim/niqqud, colons, dots and parentheses removed — so `מספר אסמכתא:` matches אסמכתא.

## What it refuses, and why

| Refusal | Reason |
|---|---|
| No date order chosen | `01/02/2024` is 1 February or 2 January. The user chooses; the parser never infers. |
| Date impossible in the chosen order (`13/02/2024` under month/day) | Silent reinterpretation would move money to the wrong period. |
| Two-digit year (`01/02/24`) | Three readings; a full year is required. |
| Real calendar validation (`31/02/2024`, `29/02/2026`) | Uses `bankStatementDate` — no clock, no time zone. |
| Both debit **and** credit filled on one row | The direction is ambiguous. |
| Neither debit nor credit filled | A zero amount is not a transaction. |
| A signed value in the debit/credit column | Never silently reversed. |
| Zero amount, three decimals, exponent, huge values | Integer cents only, ≤ 2 decimals, safe range. |
| A total / opening / closing balance line | Would be imported as a transaction. A dated one is refused; an undated summary is skipped. |
| A row with content but no date, not a summary | Refused with its row number. |
| Both a debit/credit pair **and** a separate amount column | Ambiguous layout; use manual mapping. |
| A workspace currency that is not two-decimal (JPY, KWD) | No silent rescaling of money. |
| More than 12 MB or 50,000 rows | Preview limit; the message says which. |

Every message names the CSV row number, so the user can fix the file or choose manual mapping.

## Worked figures (the fixtures, computed by hand)

`il-debit-credit.csv` (Hebrew headers, debit and credit columns):

| Date | Description | Debit | Credit | → cents |
|---|---|---|---|---|
| 01/02/2024 | העברה לספק שכירות | 1,250.50 | | −125050 |
| 05/02/2024 | תקבול מלקוח בע"מ | | 2,000.10 | +200010 |
| 29/02/2024 | עמלת בנק | 12.00 | | −1200 |
| (undated) | יתרת סגירה | | | skipped, not a transaction |

`il-signed-amount.csv` (value date, one signed amount): `(500.00)` → −50000; `₪1,000.00` → +100000.

`il-english-headers.csv` read as day/month gives 2024-01-02 and 2024-02-02; read as month/day gives
2024-02-01 and 2024-02-02 — the test asserts both, and that `13/02/2024` under month/day is refused.

## Checks run (22 Oct 2026)

- `npx tsc --noEmit -p tsconfig.json` — clean.
- `npx tsx --test src/tests/israeli-bank-csv.test.ts` — 7/7.
- `npx tsx --test src/tests/bank-statement-import-ui.test.tsx` — 14/14 (12 existing + 2 new).
- `npm run lint:eslint` — 0 errors; warnings at the baseline (the new files add none).
- Quality ratchet — no metric regressed; no new screen, so `untestedViews` is unchanged.
- No posting, no server change, no migration, no money calculation.

## Not in this change

- A per-bank "certified format" claim, automatic layout detection, or silent date inference.
- Xero/Wave/Zoho/Sage imports (E-44…E-47) and the QuickBooks Desktop IIF reader (E-29).
- OFX/QFX, CAMT.053, BAI2, QIF and the US bank layouts already have their own readers (E-27, E-30,
  E-31, E-41, E-42) and are unchanged.
