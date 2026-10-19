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
| W2 | Invoice → posting → payment → customer statement | 2 | Yes | Partly | Partly | ISS-141 emailed-statement period, DIM-1 payments |
| W3 | Bill → posting → payment run → vendor statement | 2 | Yes | Partly ([D-33 withholding goldens](verification/ai4-d33-withholding-golden.md)) | Partly | golden bills A-147 wired to the posting, DIM-1 payments, #156 inherited withholding rate after expiry |
| W4 | Bank import / feed → reconciliation | 2 | Yes | Partly | Partly | AU-1 changed/removed lines on the Banking screen, #96 |
| W5 | Labels (property, project, location) → reports by label | 2 | Yes | Partly ([D-93 failure-state checks](verification/ai4-d93-report-harness.md)) | No ([D-45 header checks only](verification/ai4-d45-report-controls.md)) | DIM-1 payments, DIM-3 balancing roles |
| W6 | Order with deposit → part invoices → delivery (no double charge) | 2 | Yes | Yes (DEP-1) | No | browser test |
| W7 | Israel VAT month: invoices with allocation numbers → VAT report → PCN874 → close | 2 | Partly | Partly ([D-32 report goldens](verification/ai4-d32-israeli-vat-golden.md), A-146, [A-152 Israel month journey](verification/ai3-a152-israeli-month.md)) | No | CON-3, CON-4, #160 persisted equipment/report adapter; the PCN874 screen builds the historical draft only and is not filing-ready |
| W8 | US quarter: sales tax by state → summary → 1099 preview → close | 2 | Partly | Partly (A-146/147, [A-153 US quarter journey](verification/ai3-a153-us-quarter-journey.md)) | No | CON-1, CON-2 |
| W9 | Month-end close and reopen | 2 | Yes | Yes (AUD-08 race, [A-151 close journey](verification/ai3-a151-close-journey.md)) | Partly | — |
| W10 | Backup → restore → same reports | 3 | Yes | Partly (AUD-02) | No ([D-46 reminder only](verification/ai4-d46-mobile-notices.md)) | AUD-02 rest (ownership inside the transaction) |
| W11 | Import from QuickBooks/CSV → totals match the source (AU-4) | 3 | Partly | No | No | AU-4 |
| W12 | Several books → group report | 3 | Yes | Partly | No | consolidation export, cross-book test |
| W13 | Stock: purchase → stock → sale → valuation | 3 | Yes | Partly | Partly | ISS-130, ISS-131, DIM-2 |
| W14 | Roles and access (owner, accountant, bookkeeper, viewer) | 2 | Yes | Yes (RLS suite) | Partly | AUD-09 per write family |

**Today (19 Oct):** stage 1. Nearest to stage 2: W6, W9, W14. The critical items still open: AUD-02 (rest). Fixed 18 Oct: BUG-03/INT-2 invoices, INT-1 authority at commit, INT-3, INT-4, INT-5. Added 19 Oct: the Israeli month journey (A-152, W7 evidence) and the close journey on Month-End Close (A-151, W9 evidence) — both read-only; W7's PCN874 step remains a historical draft and CON-3/CON-4 stay open.
