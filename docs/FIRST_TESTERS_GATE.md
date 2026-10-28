# First testers — proof-based release gate

**Status: NOT CERTIFIED.** This is a verification checklist for a small, invited pilot, not a statement that the deployment satisfies it. Use it with `docs/INDEPENDENT_AUDIT_AGENT.md`, `docs/PLAN.md` §15, `docs/CAPABILITIES.md`, `docs/TODO_2.md`, and `docs/TRACKER.md`. Current beta scope: **US and Israel where specifically tested**, all other tax packs calculation-only/not validated.

## Two distinct invitation stages

**A. Invited synthetic-data testers (first):** isolated demo/sandbox books, obvious “Test environment; do not rely on results for actual filings or payment obligations”; no real banking credentials, actual filings, unreviewed payment runs or commercial financial records. Obtain written beta permission consistent with the repository's restrictive source-available license. Test onboarding, navigation, drafts, reports, export, feedback and recovery.

**B. Invited real-bookkeeping pilot (later):** only after *all* P0 money/data/security gates below are verified against a production-like isolated database and deployment. Narrowly define supported jurisdictions/features; disable unverified automation; have competent financial reviewers check the independently calculated reports. This stage is **not** implied by green CI or by stage A.

### Release gate status vocabulary

`Blocked` = known release-stopping defect; `Unverified` = not yet demonstrated with real execution; `Passed` = test + evidence URL/commit + observed outcome; `Not offered` = disabled/hidden with clear text; `Deferred` = explicitly outside the pilot.

**All rows begin Unverified** until linked evidence is produced on an exact commit/deployment. A passed static unit test cannot substitute for a user-flow or production-config check.

| ID | User-visible promise / necessary property | Evidence that must be produced | Stage |
|---|---|---|---|
| G-01 | New user enters setup once; returning user sees the same saved books after refresh | Authenticated browser sign-up and return, slow network, expired session, two books and account switching; no “Loading your books” screen bounce | A |
| G-02 | One supported simple book is usable without jargon or dead ends | One first-hour journey: chart, contact, invoice, bill, payment, import, reconcile, report; no unsupported screen masquerades as active | A |
| G-03 | Every change either persists or is visibly refused | Force failed, delayed, repeated and reordered saves; no success on refusal; drafts retained; no stale workspace result | A |
| G-04 | Access boundaries hold between two unrelated workspaces | Real Postgres RLS + authorized server route test: owner/accountant/viewer, forbidden read/write/export, invite expiry, cached report after role revocation | A |
| G-05 | Test records and real customer records cannot be confused | Clear sandbox banner, isolated data, visible supported/unsupported status, no real-payment or filing actions in the synthetic beta | A |
| G-06 | Tester can report a problem and recover | Helpful error and retry, Data Status, export/copy reproducible reference without secrets, documented support channel, refresh/logout recovery | A |
| G-07 | Primary screens work in their actual form | Chrome desktop and 390px phone; keyboard/Escape; Hebrew and English, dates/currency in mixed text; intentional screenshots approved by reviewer | A |
| G-08 | Invited usage complies with repository license | Explicit written permission for invited pilot; clarify business evaluation rights and no public resale/hosting rights; confirm third-party asset licenses | A |
| G-09 | Financial entries cannot be unbalanced or posted twice | Real-DB posting, retries, concurrent requests, lock race, reversal dates, precision and workspace separation; no ledger bypass path | B |
| G-10 | Bank sync never loses a page/modified/deleted row | Two runs, cursor-only-after-durable-import, crash after provider response, webhooks, replay and another user's bank; same bank-line totals | B |
| G-11 | Invoice/order/deposit/delivery is billed once | Order partial invoices, 25% deposit, one delivery charge, full/partial payments, refunds and duplicate clicks; authoritative server checks | B |
| G-12 | Ledger totals agree across labels/entities | Each labeled subset and overall journal balances after discount/tax/fees/FX/reversal; dimension roles and entity ownership are not confused | B |
| G-13 | Cash, receivables, payables, stock and reports agree | Independently worked chart + opening balances + periods; journal → trial balance → P&L/BS/AR/AP; inventory as-of history from posted moves | B |
| G-14 | Screen, PDF and CSV agree on period and parties | Same customer statement across selected period, currency, allocations, credits and labels, including authoritative full-history reads | B |
| G-15 | A backup can actually be restored safely | Consistent snapshot, checksum AND schema/ownership validation, locked-period protection, concurrent writes, dry-run, fresh disposable restore and balance reconciliation | B |
| G-16 | Supported tax results can be explained and reproduced | US/Israel **specific tested** place/entity/period cases; dated official source, explicit fact ownership, correct posting, liability, return review and unknown/refusal states | B |
| G-17 | Production service has trusted configuration | Confirm applied migrations in live/intended environment, verified remote DB TLS, secrets, email deliverability, role restrictions, backups, scheduler and incident rollback | B |
| G-18 | Real-bookkeeping testers can exit without lock-in | Export original documents, accounts, journal and reports with correct units/period, documented deletion/access-revocation and recovery procedure | B |
| G-19 | App survives realistic load for pilot users | 10k+ transactions, long-running report/import, pagination and server limits, two users same book, reconnect from background browser tab; no silent partial views | B |

## Practical test packs

**Pack 1 — tiny new business:** no history, one bank, one contact, one invoice, one bill, part payment; verify cash, P&L, balance sheet, A/R, A/P and visible save/retry behavior. Repeat on a returned session.

**Pack 2 — existing books migrated:** sample source with opening balances, posted transactions, three bank accounts, credits and unpaid bills. Compare source **totals by account, A/R, A/P, cash and tax payable**, with reasoned differences; no “import complete” success solely from row count (AU-4).

**Pack 3 — multi-location/multi-entity:** separate US and Israeli books, two locations in one book, shared expense allocation, tax/discount/fees, multiple currencies and intercompany activity. Exact by-label and by-entity reconciliation; no inherited unrelated registration.

**Pack 4 — failure and concurrency:** 2 users click the same command; server times out after commit; close date changes mid-save; bank feed removed+modified+added; browser changes books; background tab resumes; restore overlaps posting. Verify no duplicate, lost or silent partial data.

**Pack 5 — statutory boundaries:** only the explicit verified US/Israeli rules: rates effective on the invoice date, exemption proof, unknown jurisdiction refusal, separate registration and return-period attribution, credit/reversal effect. Any unverified form or filing is blocked and labeled as non-filing.

## Non-negotiable acceptance process

1. Pin code SHA, lockfile, migrations, environment class and test dataset.
2. Calculate expected financial figures **independently** of production calculation modules. Never create expected results by calling the function under review.
3. Test browser → authenticated API → *actual Postgres fixture* → report/export with a complete round trip. Keep screenshots/logs scrubbed of account details.
4. Replay after an uncertain response and exercise denial/retry. Include slow and out-of-order requests.
5. Attach verified results (commands and logs/PR/test path), name the reviewer and date.
6. Mark each gate explicitly. A red/unknown P0 means **no real-record beta**; demo-only testers can proceed only when stage A gates pass.
7. Re-evaluate affected gates when a changed blob, migration or dependency invalidates the earlier evidence.

## Current source-backed audit starters (not certified fixes)

- **AF-001**: Plaid cursor advanced in `src/server/routes/plaidRoutes.ts` while UI `src/components/banking/Banking.tsx` only reports the request result. Verify durable ingestion before cursor advancement.
- **AF-002**: `src/kernel/templates/TransactionTemplates.ts` uses independent cent allocation for tax, discount, A/R. Reconcile a two-label invoice with an odd-cent discount; add ledger and report-level tests.
- **AF-003**: statement scopes diverge between user-selected screen ranges and server PDF generation (AUD-01/#141).
- **AF-004**: invoice tax hints use the old `resolveSellerProfile` while the intended multi-dimensional `composeFacts/evaluateRules` graph is not yet a single authoritative path.
- **AF-005**: stock valuation issues #130/#131, server RMA issue #143; source and tests must enforce historical truth and atomic transitions.
- **AF-006**: AUD-20 remote TLS verification, AUD-02 restore races, report-cache authorization/freshness.

These are leads for the dedicated reviewer to reproduce, not an assertion that they are all equally severe or independently confirmed in production.

## Readiness decision

| Decision | Rule |
|---|---|
| **Synthetic invited preview** | G-01..G-08 Passed; any gap clearly marked and the affected feature disabled before invitation |
| **Real financial data pilot** | G-01..G-19 Passed where offered, verified professional review for tax scope, and zero unresolved P0; remaining P1 documented with a controlled workaround only if the risk can be bounded |
| **Public launch** | Separate release decision after the real-data pilot, incident runbook, scale and recovery evidence, billing/support/legal review |

**Launch metric:** completed end-to-end journeys with verified figures and recovery, not raw module count, tracked item count or passing type checks.

## Evidence so far (AI #1, 27 Oct). Code is done; each row still needs its check on the deployed site.

- **G-05 (test environment):** the built app shows a banner on every screen: "Test environment. Use made-up books only:
  no real customers, payments or tax filings." (`src/components/support/TestEnvironmentBanner.tsx`, shown by
  `src/lib/testEnvironment.ts`). It is in the production bundle, not on the development server, so browser screenshots are
  unchanged. Set `VITE_TEST_ENVIRONMENT=off` in Vercel to remove it once real books are allowed. Test:
  `src/tests/test-environment-banner.test.tsx`. *Still to check on the live site:* the banner appears; no real-payment or
  filing action is offered.
- **G-06 (report a problem):** "Report a problem" in the banner, and "Send feedback" on every screen, open the existing
  feedback form. It saves a support ticket with the screen and app version, plus an optional screenshot, and now shows
  the tester a reference (`feedbackReference`: the ticket's first 8 characters). Reports appear on Settings → Support:
  for a platform admin, every workspace's tickets; for a tester, their own. *Still to check on the live site:* send one
  and find it there.
