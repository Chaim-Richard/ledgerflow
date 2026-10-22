# Auditor data-export pack — what goes in (A-145)

The list (AI #3's part of A-145). **AI #1 builds the export** — this pack must be generated on the
server, because an auditor's evidence cannot depend on what one browser happened to load (the
E-58 accountant pack's own guards refuse on capped/partial lists; the auditor pack must not have
a "partial" state at all). Nothing here exists yet except where it says "reuse".

## Where this differs from the accountant pack (E-58, shipped)

Reports → Accountant export pack already exports, for one period, trial balance, general ledger,
A/R, A/P and tax liability by period with a README and cross-checks
(`docs/ACCOUNTANT_EXPORT_PACK.md`). An external **auditor** needs more: the complete journal with
its audit trail, the source documents behind the numbers, bank evidence, opening balances, and
proof the pack is complete and unaltered. Reuse E-58's five files and format rules (UTF-8 BOM,
`sanitizeCsvCell`, plain-decimal money, stored ZIP) — do not write a second formula anywhere:
every figure comes from the same function the matching screen uses.

## Scope questions the screen asks first

Workspace; period (financial year by default, custom range allowed); optional label/entity filter
(named on the cover, never silent); base currency. Everything below is for that scope, and the
cover says so.

## The files

| File | Contents | Source of the figures |
|---|---|---|
| `README.txt` | Workspace name + id, period, label filter if any, base currency, generated-at (UTC + local), generated-by (user + role), app version/commit, the file list with row counts, the control totals below, definitions an outsider needs (amounts in whole cents→decimal; `totalAmountCents` is absolute, direction comes from the lines; only postable entries included — drafts/voids listed separately, see `journal-excluded.csv`), and the limitations paragraph | — |
| `manifest.json` | Machine-readable twin of the README: every file with byte size, row count and SHA-256, plus the control totals | — |
| `chart-of-accounts.csv` | Code, name, type, category, active/inactive, currency if any | the Accounts screen's data |
| `trial-balance.csv` | As E-58, plus opening balance at period start and closing at period end per account | `computeTrialBalance` (reuse) |
| `general-ledger.csv` | As E-58, full period, no row cap (the 500-row print cap is a print rule, not a CSV rule) | `computeGeneralLedger` (reuse) |
| `journal.csv` | One row per entry **line**: entry id, date, posted-at, account code, debit, credit, currency + amount in currency + rate where foreign, description, reference, document type + document id/number it came from, labels (entity etc.), created-by, reversed/reversal link | `transactions` + `lines[]`, postable filter (`isPostable`) |
| `journal-excluded.csv` | Drafts, voided/cancelled and otherwise non-postable entries in the period, with status and reason — an auditor must be able to see what was kept out and why | the complement of the same filter |
| `audit-trail.csv` | Who created/changed/deleted what and when, for the period (documents, entries, settings that affect money: numbering, tax rates, period locks) | the audit-trail records |
| `customers.csv`, `vendors.csv` | Name, tax ID (masked exactly as the app masks it — full tax IDs are an owner decision, see open questions), email, phone, address, status, currency, opening/closing balance for the period | party records + period summary |
| `accounts-receivable.csv`, `accounts-payable.csv` | As E-58 (aging at period end), plus an open-items file: `open-invoices.csv`, `open-bills.csv` — document, date, due date, party, currency, total, paid, balance | `computePartyAging` (reuse) + document registers |
| `sales-documents.csv` | Every invoice, credit note, estimate converted, receipt: number, series, date, party, currency, net, tax by rate, total, status, allocation number where applicable (Israel) | document collections |
| `purchase-documents.csv` | Bills, vendor credits, purchase orders, goods receipts — same shape | document collections |
| `payments.csv` | Every payment in/out: date, party, method, account, currency + amount, what it settled (document ids), status | `payments` collection |
| `bank-statements.csv` | Imported statement lines per bank account with import batch, plus `bank-reconciliations.csv`: statement balance vs book balance at period end and the unreconciled difference in words | bank import + reconciliation data |
| `inventory-items.csv`, `stock-moves.csv`, `inventory-valuation.csv` | Catalogue (sku, unit, cost, price, category), every stock move in the period (kind, qty, unit cost, document link, lot/serial where recorded), valuation at period end by the Inventory Valuation screen's function | inventory + stock-moves ledger (reuse valuations) |
| `fixed-assets.csv` | The asset register: cost, in-service date, method, life, depreciation posted in the period, book value at period end, disposals/transfers in the period | Fixed Asset Register's functions |
| `tax-returns.csv` | Per filing period in range: the figures each return screen computed (VAT/GST/sales tax boxes as applicable), marked "calculation status — as computed by LedgerFlow, not proof of filing" | `buildTaxReturn` and friends (reuse) |
| `attachments-index.csv` | Every attachment: file name, type, size, SHA-256, the record it hangs on — the files themselves under `attachments/` (optional toggle; off by default when huge, and the cover says which) | documents/attachment metadata |
| `period-locks.csv` | Locked periods overlapping the range, who locked/unlocked and when | fiscal-period records |

## Control totals (printed in README + manifest, computed server-side)

Trial-balance debits = credits at period end; journal line debits = credits for the period;
A/R open total per aging vs the Receivables control account balance (difference named, never
forced to zero); same for A/P; bank book balances vs GL bank accounts; document counts per file;
row count + SHA-256 per file. A failed control does not block the export — it is printed as a
failed control, because hiding it would be worse — but a pack whose data could not be read
completely must refuse, not truncate.

## Never in the pack

Passwords, tokens, API keys, portal tokens, session data, other workspaces' anything, full card
numbers (the app masks them everywhere; keep it that way), and personal data beyond what the
books themselves hold. Tax IDs masked as on screen unless the owner decides otherwise (below).

## Open questions for AI #1 / the owner

1. Server endpoint + job model: a big year will not build inside one request — generate async,
   store the ZIP as a workspace document, expire it, log the generation in the audit trail.
2. Who may generate: owner + accountant (suggested); every generation audit-logged.
3. Full vs masked tax IDs, and whether attachment binaries ride along by default (privacy/size) —
   owner decision; default above is masked + index-only.
4. Signing: is a SHA-256 manifest enough, or does the owner want the pack hash anchored somewhere
   (e.g. recorded in the audit trail at generation time — cheap and worth it)?
5. Format beyond CSV/ZIP: some auditors ask for SAF-T (OECD) or the Israeli uniform-file
   (קובץ אחיד / BKMVDATA) structure — separate tasks if the owner wants them; this list is the
   CSV evidence pack only.
