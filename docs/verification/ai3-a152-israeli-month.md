# A-152 — Israel month journey (AI #3, 19 October 2026)

**Task:** [A-152 in `docs/COORDINATION.md`](../COORDINATION.md) — "Journey: Israeli month — one path
from invoice with allocation number to VAT report to PCN874 file to month close, with a checklist
screen (P2-3)". It is one of the three items the 18 Oct plan puts first in my lane, and it moves the
**W7** row of [`docs/RELEASE_GATE.md`](../RELEASE_GATE.md) ("Israel VAT month: invoices with
allocation numbers → VAT report → PCN874 → close").

**Branch:** `arena/f4208ff9-ledgerflow`, from `main` `f145735` (which already carries A-153).

## 1. What was built

One read-only screen, **Reports → Israel Month Journey**
(`src/components/reporting/IsraelMonthJourneyReportView.tsx`), over the pure library
`src/lib/israelMonthJourney.ts`. Each step says what the recorded data shows and opens the screen
that does the work:

| # | Step | Screen it opens | Figure source (reused, unchanged) |
|---|---|---|---|
| 1 | Israeli VAT registration for the month | Settings → Tax profiles | `registrationsOn` / `registrationKey` (`src/lib/tax/profile.ts`) |
| 2 | Allocation numbers on business invoices | Sales → Invoices | `needsAllocationNumber`, `allocationNumberProblem`, `allocationThresholdCents` (`src/lib/tax/ilAllocation.ts`), with the buyer's VAT number from the customer record and the number from `invoice.metadata.ilAllocationNumber` (the field `AllocationNumberField` writes) |
| 3 | Periodic VAT report (form 836 figures) | Reports → Tax return | `israelVatReturn` (`src/lib/tax/ilVatReturn.ts`) → `buildTaxReturn` → `computeTaxReturn` (`src/lib/taxCodes.ts`) |
| 4 | PCN874 draft for the month | this screen (the draft is below) | `buildPcn874FixtureDraft` (`src/lib/tax/pcn874Draft.ts`) over rows this file maps from the documents |
| 5 | Close the month | Month-End Close | `monthCloseState` (`src/lib/periodLock.ts`) and `GET /api/v1/workspaces/{id}/tax-returns` (the returns the return screen itself keeps) |

No second tax rule is invented. The VAT figures are the ones the Tax return screen computes; the
allocation threshold is the dated table the invoice field uses; "recorded as filed" is read from the
server, not assumed (a failed read leaves it as not recorded). Nothing posts, files, pays or closes.

## 2. Worked figures (hand-checked, September 2026)

`src/tests/israel-month-journey.test.ts` (15 cases). The business holds VAT registration 514000000
and reports monthly. Documents are `taxVersion: 2`, so `amountCents` is the total owed and
`taxAmountCents` the VAT:

| document | date | net | VAT | treatment |
|---|---|---|---|---|
| invoice 1001 | 10 Sep 2026 | 10,000.00 | 1,800.00 (18%) | taxable, business buyer 512345678 |
| invoice 1002 | 15 Sep 2026 | 1,000.00 | 180.00 (18%) | taxable, private buyer |
| invoice 1003 | 18 Sep 2026 | 5,000.00 | 0 | zero-rated export |
| credit note 7001 | 25 Sep 2026 | −500.00 | −90.00 | reduces sales |
| bill 9001 | 20 Sep 2026 | 2,000.00 | 360.00 | input VAT, other |
| bill 9002 | 22 Sep 2026 | 1,000.00 | 180.00 | input VAT, fixed asset |

The test asserts, and the screen shows:

- taxable sales **1,050,000 agorot** (1,000,000 + 100,000 − 50,000);
- output VAT **189,000** (180,000 + 18,000 − 9,000);
- zero-rated sales **500,000**; exempt sales **0**;
- input VAT other **36,000**, fixed-asset input VAT **18,000**;
- to pay **135,000** (189,000 − 54,000), document count **6**;
- the planning due date **2026-10-15** (the 15th after the month) for a monthly registration.

Allocation numbers: only invoice 1001 needs one — net 10,000 is above the **5,000** threshold in
force from 1 June 2026, and the buyer is a business. A private buyer, and a zero-rated invoice with
no VAT, do not need one. A missing number, or one that is not 9 digits, is reported as needing
attention with the invoice number, never filled in.

PCN874 rows: invoice 1001 (S, +10,000 / +1,800), invoice 1003 (L, +5,000 / 0), credit note 7001
(S, −500 / −90), bill 9001 (T, input other 360), bill 9002 (R, equipment 180). Invoice 1002 cannot
be written because the private buyer has no VAT/dealer number, and it is listed with that reason.
Totals: taxable 9,500 NIS, VAT 1,710, zero-rated 5,000, other input 360, equipment 180 — so the
comparison with the report shows the unrepresented 1,000.00 as a difference instead of hiding it.

## 3. The PCN874 part: a historical draft, not a filing

`src/lib/tax/pcn874Draft.ts` was already in the repository and is explicit that the Appendix A
layout dates to 2010 and must not be used for live filing. This task puts it on a screen without
changing that fact:

- the draft text is built only when a **9-digit dealer number** is given and **every** document of
  the month can be written (a loaded customer/vendor with a VAT/dealer number, a 1–9 digit numeric
  document number, shekels — no rate is invented for another currency);
- every document that cannot be written is listed by number with the reason, and the download stays
  disabled;
- exempt, reverse-charge and out-of-scope documents are counted as not represented by this layout;
- the draft's whole-shekel totals are shown beside the VAT report's, difference included;
- the screen says on every draft that it is not filing-ready, and `filingReady` stays `false`;
- downloading saves a `.txt` file in the browser; nothing is submitted.

**Limits stated on the screen and in the row:** the Tax Authority assigns the reporting frequency
and the deadline (the registration's recorded frequency is only what the workspace states); a
bimonthly dealer's month is part of a two-month period; the allocation threshold table and the
historical layout must be verified against the authority's current publications before a real
filing; exempt sales have no row in this historical layout.

## 4. Files

- `src/lib/israelMonthJourney.ts` (new) — month, registration, allocation cases, PCN874 mapping and
  preview, journey and CSV rows.
- `src/components/reporting/IsraelMonthJourneyReportView.tsx` (new) — the screen and its exported
  panel.
- `src/config/registry.tsx` — Reports tab entry `il-month-journey` and the lazy component.
- `src/config/screenHelp.ts` — the 2–4 sentence help for the screen.
- `src/tests/israel-month-journey.test.ts` (15), `src/tests/israel-month-journey-view.test.tsx` (6).
- `docs/CAPABILITIES.md` row 192, `docs/RELEASE_GATE.md` W7, this document, `docs/COORDINATION.md`.

No money calculation, posting, server, migration, screenshot baseline or quality budget was changed.

## 5. Checks (this branch)

- `npm ci` — clean (node v22.22.3; the repo asks for 24.x, only the engine warning).
- `npx tsc --noEmit -p tsconfig.json` — clean.
- New tests: `israel-month-journey.test.ts` 15/15, `israel-month-journey-view.test.tsx` 6/6.
- Guard tests: screen help, capabilities, orphan modules, reachability, tables, money format,
  collections, index and test discovery — all pass.
- Full `npm test` — **2,906 passed / 0 failed** (731 suites; database suites skipped without
  `LF_TEST_DATABASE_URL`, as on every branch here).
- `npm run lint:eslint` — 0 errors / **210 warnings** (the cap is unchanged at 210; the new files
  add none). `npm run build` — passes (client bundle + `build/server.cjs`).
