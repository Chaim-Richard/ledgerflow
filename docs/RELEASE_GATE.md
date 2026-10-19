# Release gate (owner's rule, 18 Oct 2026)

The decision to invite testers or customers follows **this table**, not the number of open issues.
Zero bugs is not the bar; the supported workflows working correctly is. The lead keeps it current
(LEAD_RUNBOOK step 8) and every AI updates its row when it finishes work on that workflow.

## Bug categories

| Category | Examples | Rule |
|---|---|---|
| **Critical integrity** | durable double posting, lost records, wrong workspace access, unsafe restore | fixed before any real financial use |
| **Major functional** | wrong statement dates, report scope, wrong totals | fixed before that workflow is offered as dependable |
| **Ordinary** | broken secondary button, layout, minor navigation | fixed in batches; does not hold back testing |
| **Incomplete feature** | server work without a screen, preview without the final action | keeps being built; not a blocker unless its workflow is in the table |

Label issues with `critical`, `major` or nothing (ordinary); a stage cannot start while a **critical** issue
touches one of its workflows.

## Stages

1. **AI completion (now):** finish known gaps in the workflows below; fix critical and major findings.
2. **Selected bookkeepers on synthetic books:** when every "stage 2" row is Yes/Yes/Yes. They judge usability,
   wording, missing practical steps — what the AIs cannot.
3. **A few paying customers:** when every row is Yes and data recovery, permissions, migration and billing are proven.

## Workflows

Columns: **Connected** = every step reachable on a screen and saved by the server · **Verified** = a test with
independently worked figures passes · **Browser** = an end-to-end browser test passes on CI.

| # | Workflow | Stage | Connected | Verified | Browser | Remaining blockers |
|---|---|---|---|---|---|---|
| W1 | Sign up → company → chart of accounts → first invoice → first report (P2-1) | 2 | Partly | No | Partly ([D-46 notices only](verification/ai4-d46-mobile-notices.md)) | first-hour journey test (A-151/P2-1); C-127 navigation/disabled-control batch verified locally, complete journey/CI still pending |
| W2 | Invoice → posting → payment → customer statement | 2 | Yes | Partly | **Yes** ([F-41 W2 journey: invoice $1,000 → $600 paid → $400 statement](verification/ai7-f41-w2-invoice-statement.md)) | DIM-1 payments — labels on the payment entry still open |
| W3 | Bill → posting → payment run → vendor statement | 2 | Yes | Partly ([D-33 withholding goldens](verification/ai4-d33-withholding-golden.md)) | **Yes** ([F-42 W3 vendor statement](verification/ai7-f42-w3-bill-statement.md)) | golden bills A-147 wired to the posting, DIM-1 payments, #156 inherited withholding rate after expiry |
| W4 | Bank import / feed → reconciliation | 2 | Yes | Partly | **Yes** ([F-43 bank reconciliation](verification/ai7-f43-bank-reconciliation.md)) | AU-1 changed/removed lines on the Banking screen, #96 — reconciliation path now browser-tested |
| W5 | Labels (property, project, location) → reports by label | 2 | Yes | Partly ([D-93 failure-state checks](verification/ai4-d93-report-harness.md)) | No ([D-45 filter checks](verification/ai4-d45-report-controls.md); [D-77 heading](verification/ai4-d77-report-heading.md); [D-78 navigation](verification/ai4-d78-report-tabs.md); [D-80 contrast](verification/ai4-d80-highlighted-ledger-row.md)) | DIM-1 payments, DIM-3 balancing roles |
| W6 | Order with deposit → part invoices → delivery (no double charge) | 2 | Yes | Yes (DEP-1) | **Yes** ([F-44 W6 order-deposit journey: $1,100 total, delivery once](verification/ai7-f44-w6-order-deposit.md)) | — |
| W7 | Israel VAT month: invoices with allocation numbers → VAT report → PCN874 → close | 2 | Partly | Partly ([D-32 report goldens](verification/ai4-d32-israeli-vat-golden.md), A-146, [A-152 Israel month journey](verification/ai3-a152-israeli-month.md)) | Partly ([browser journey, CI pending](verification/ai3-w7-w8-w9-browser.md)) | CON-3, CON-4, #160 persisted equipment/report adapter; the PCN874 screen builds the historical draft only and is not filing-ready |
| W8 | US quarter: sales tax by state → summary → 1099 preview → close | 2 | Partly | Partly (A-146/147, [A-153 US quarter journey](verification/ai3-a153-us-quarter-journey.md)) | Partly ([browser journey, CI pending](verification/ai3-w7-w8-w9-browser.md)) | CON-1, CON-2 |
| W9 | Month-end close and reopen | 2 | Yes | Yes (AUD-08 race, [A-151 close journey](verification/ai3-a151-close-journey.md)) | **Yes** ([F-45 close → posting refused → reopen](verification/ai7-f45-w9-close-reopen.md)) | — |
| W10 | Backup → restore → same reports | 3 | Yes | Partly (AUD-02) | No ([D-46 reminder only](verification/ai4-d46-mobile-notices.md)) | AUD-02 rest (ownership inside the transaction) |
| W11 | Import from QuickBooks/CSV → totals match the source (AU-4) | 3 | Partly | No | No | AU-4 |
| W12 | Several books → group report | 3 | Yes | Partly | No | consolidation export, cross-book test |
| W13 | Stock: purchase → stock → sale → valuation | 3 | Yes | Partly | Partly | ISS-130, ISS-131, DIM-2; C-128 item configuration verified locally, full stock journey/CI still pending |
| W14 | Roles and access (owner, accountant, bookkeeper, viewer) | 2 | Yes | Yes (RLS suite; AI #6 adds cross-workspace write assertions for invoice, bill, payment, credit, reconciliation, customer and vendor records; pass on test Postgres 19 Oct) | Partly | AUD-09 for the remaining write families |

**Today (19 Oct, AI #7):** stage 1 moving to stage 2 on five workflows. W2, W3, W4, W6, W9 now have browser journeys (F-41…F-45) with worked figures verified locally; CI will confirm on the PR. Nearest to stage 2: W2, W3, W4, W6, W9, W14 — W7/W8 stay Partly on Connected until CON-1…CON-4. Critical still open: AUD-02 (rest). Fixed 18 Oct: BUG-03/INT-2 invoices, INT-1/3/4/5. Added 19 Oct morning: Israeli month journey (A-152) + close journey (A-151); evening: F-41…F-45 journeys ([evidence](verification/ai7-journeys-w2-w9.md)); also F-38…F-40 grade-up foundations (perf budgets, scorecard, layer guard).
