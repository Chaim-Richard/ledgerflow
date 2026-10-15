# E-27 — United States bank CSV import templates (read-only staging)

**Engineering scope, 15 October 2026.** In **Bank Connections → Import statement**, choose **US bank CSV layout** before uploading an actual CSV. Choosing **Other CSV: review column mapping** retains the prior generic mapper; all selected templates feed the same existing statement review and duplicate-selection workflow. No source document, book entry, bank connection, reconciliation, posting, database table or source fingerprint contract is changed by parsing.

## Supported, explicitly selected *example layouts*

- **Chase checking/savings:** `Details, Posting Date, Description, Amount, Type, Balance, Check or Slip #`. Use *Posting Date*, signed amount, reference; reject a contradicting DEBIT/CREDIT marker.
- **Chase credit card:** `Transaction Date, Post Date, Description, Category, Type, Amount[, Memo]`. Use **Post Date**, never the earlier purchase date or merchant category as the posting date.
- **Bank of America checking/savings:** summary rows may precede `Date, Description, Amount, Running Bal.`; reject unknown preambles, exclude only recognized introductory summaries and the informational *Beginning balance* row with a blank amount. Never treat balance as movement.
- **Bank of America credit card:** `Posted Date, Reference Number, Payee, Address, Amount`. Do not treat address as amount; reference retained where supplied.
- **Wells Fargo checking/savings:** *headerless*, five columns (MM/DD/YYYY date, signed amount, an asterisk, empty/check field, description). The first row is a transaction. This layout is **not guessed** from shape: user must select it.

These are strict template adapters for known export shapes, **not** assertions that every account type, old edition or bank-export setting produces the same file. Format changes are rejected. Each bank's own export is the source of truth for account, date range, currency and completeness.

## Financial/integrity guardrails

1. Exact cents from validated two-place ASCII decimal input, computed with `BigInt` and refused if zero, malformed or outside safe integer range. Never parse money with floats.
2. Calendar dates are `MM/DD/YYYY` with a four-digit year and validated Gregorian dates independent of local timezone. Use the *post date* when both a transaction date and a post date exist.
3. Reject unknown columns, partial rows, unknown preambles, missing descriptions, inconsistent sign markers and empty exports — error names source row. No partial results from a failed file.
4. Preserves Hebrew/unicode descriptions and references. CSV uses existing RFC 4180 parser for quoted commas, escaped quotes and CRLF.
5. A selected US bank template needs a two-decimal workspace currency. Users must check the bank account's actual currency; the parser cannot prove it from a currencyless CSV or infer exchange rates.
6. Parsed lines go only into the **existing** preview; human confirmation and the ordinary authorized import/deduplication path remain mandatory. Imported statement activity is not automatically a balanced posted entry.
7. Source totals/balances are not independently reconciled by E-27. Statement balance and row count should be checked before approving an import.

## Fixture evidence / source caveats

The five files in `src/tests/fixtures/bank-statements/us-*.csv` are **synthetic, anonymized, representative** examples, not real customer files or official golden files. They include both signs, quoted amounts and Hebrew text. Tests cover all five layouts, leap days, malformed dates, contradictory signs, unsafe amounts, headerless first-row preservation, blank opening balances and wrong-layout refusal. The E2E tests open the app's actual import dialog, select a bank format, upload a fixture, and confirm review with exactly two transaction candidates.

**Public reference material (layout examples, not a vendor guarantee):**
- Chase example formats: https://bankxlsx.com/blog/can-i-export-chase-transactions-to-csv-or-excel
- Bank of America preamble example (community-provided): https://www.reddit.com/r/BankOfAmerica/comments/1fu3pzq/
- Wells Fargo confirms CSV download is available, without guaranteeing specific headers: https://www.wellsfargo.com/help/online-banking/activity-faqs/
- Wells Fargo sample headerless layout: https://fynnap.com/guides/wells-fargo-csv-export

## Still needed before calling universal coverage

Obtain consented, anonymized real exports for each bank/account type (including variants), exercise customer-provided files in a test workspace and verify balances/counts against a statement. Many bank exports can change format without notice; do not silently generalize the headerless interpretation to other banks.
