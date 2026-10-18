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
| W1 | Sign up → company → chart of accounts → first invoice → first report (P2-1) | 2 | Partly | No | Partly | first-hour journey test (A-151/P2-1) |
| W2 | Invoice → posting → payment → customer statement | 2 | Yes | Partly | Partly | BUG-03 (stale save may post twice), ISS-141/BUG-04 statement period, DIM-1 payments |
| W3 | Bill → posting → payment run → vendor statement | 2 | Yes | Partly | Partly | golden bills A-147 wired to the posting, DIM-1 payments |
| W4 | Bank import / feed → reconciliation | 2 | Yes | Partly | Partly | AU-1 changed/removed lines on the Banking screen, #96 |
| W5 | Labels (property, project, location) → reports by label | 2 | Yes | Partly | No | DIM-1 payments, DIM-3 balancing roles |
| W6 | Order with deposit → part invoices → delivery (no double charge) | 2 | Yes | Yes (DEP-1) | No | browser test |
| W7 | Israel VAT month: invoices with allocation numbers → VAT report → PCN874 → close | 2 | Partly | Partly ([D-32 report goldens](verification/ai4-d32-israeli-vat-golden.md), A-146) | No | CON-3, CON-4, journey A-151 |
| W8 | US quarter: sales tax by state → summary → 1099 preview → close | 2 | Partly | Partly (A-146/147) | No | CON-1, CON-2, journey A-153 |
| W9 | Month-end close and reopen | 2 | Yes | Yes (AUD-08 race) | Partly | — |
| W10 | Backup → restore → same reports | 3 | Yes | Partly (AUD-02) | No | AUD-02 rest (ownership inside the transaction) |
| W11 | Import from QuickBooks/CSV → totals match the source (AU-4) | 3 | Partly | No | No | AU-4 |
| W12 | Several books → group report | 3 | Yes | Partly | No | consolidation export, cross-book test |
| W13 | Stock: purchase → stock → sale → valuation | 3 | Yes | Partly | Partly | ISS-130, ISS-131, DIM-2 |
| W14 | Roles and access (owner, accountant, bookkeeper, viewer) | 2 | Yes | Yes (RLS suite) | Partly | AUD-09 per write family |

**Today (18 Oct):** stage 1. Nearest to stage 2: W6, W9, W14. The critical items still open: BUG-03, AUD-02 (rest).
