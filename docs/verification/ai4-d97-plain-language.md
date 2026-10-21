# AI #4 — D-97 batch 2: plain-language pass on the first-hour path

Date: 21 October 2026. Base revision: `3e2bce1fad6d18e5a0d9b1d84be548a8988cd1df`.
Branch: `arena/7b5d662c-ledgerflow`. Follows batch 1 ([PR #275](ai4-d97-first-hour.md)), which shipped the
first-hour guide and explicitly deferred this work:

> Reconciliation still uses jargon (e.g. "Streams", "Registry Unoccupied", "Cognitive Alignments Panel").
> Those existing screens and their contracts were not renamed in this small batch; finish that wording pass
> before claiming "every unclear word" is fixed. … the existing chart selector's "Analytical Workspace
> Selector" / "Verified Invariant Maturation" labels [also remain].

This batch removes that jargon from every screen on the G-02 first-hour path after the guide:
bank import, reconciliation (both screens), the chart template selector and the chart of accounts.
**Display wording only.** No monetary calculation, posted payload, tax logic, account-role resolution,
server route, SQL or permission policy changed. Every user-visible string was renamed in lockstep with the
test or e2e spec that asserts it.

## What changed, in bookkeeping words

### Reconciliation screen (`ReconciliationView.tsx`, `useReconciliationModel.ts`)
| Before | After |
|---|---|
| Streams (3) / Matched History (1) | To review (3) / Matched (1) |
| Ingress Channel Live • Reconciliation Integrity | Live • Reconciled |
| Bank Data Stream / General Ledger Records | Bank statement lines / Ledger entries |
| Zero Pending Streams / Registry Unoccupied | Nothing to review / No ledger entries to match |
| Review N Synapse Pairs / Cognitive Alignments Panel | Review N suggested matches / Review suggested matches |
| Auto Align All / Assert Match Verification | Auto-match all / Confirm match |
| Revert Verification / Unbind & Reopen Vector | Undo match |
| Synthesize Record | Create entry |
| Statement Node A / Ledger Node B / Alignment probability | Bank statement / Ledger entry / Match confidence |
| Date Separation / Description Likeness / Data Price Difference / Delta | Date difference / Description similarity / Amount difference / difference |
| Audit Matrix logs / Cleared Protection System Active / Locked Status | Matched history / Cleared items are locked / Cleared |
| Linked Registry Record / Legacy Synapsed Node / Registry value | Matched ledger entry / Linked entry no longer found / Ledger amount |
| Toasts: "Synapses Active… verified bonds", "No alignment nodes selected…", "reconciliation cycle", "Reversion interface… workspace container" | "N matches applied", "No matches selected", "Could not apply the matches", "Undoing matches is not available in this workspace" |

The suggested-matches modal also gained `role="dialog"`, `aria-modal` and `aria-labelledby` (it was a bare
overlay — UI_GUIDE accessibility rule; the quality ratchet's `overlaysWithoutDialog` stays 0).

### Chart template selector (`TemplateSelector.tsx`)
"Analytical Workspace Selector" → **Choose a chart of accounts**; "Verified Invariant Maturation" →
**Ready-to-use templates**; "Blueprint Studio" → **Chart of accounts**; "Adaptive Synthesis / AI Generated
Blueprint" → **Custom build / AI-built chart of accounts** with a plain description; "Standard Invariant
Templates" → **Ready-made templates**; "Engage / Engage Blueprint / Protocol Engaged" → **Use template /
Use this template / In use**; "Snapshotted Topologies / Save Current Topology" → **Saved templates /
Save current chart**; "Core Equation Invariant / Structure Protocol Accounts / Consensus Invariant Map /
Ledger Equilibrium Certified" → **Key equation / Accounts in this template / How the accounts connect /
Balanced books, enforced**. The duplicated word in one template formula ("Maintenance Maintenance OpEx")
is fixed.

### Chart of accounts (`ChartOfAccountsView.tsx`)
Headers "Node ID / Entity Identity / Topology Type / Classification / Total Aggregate" →
**Code / Account name / Type / Category / Balance**; empty state "Void Detection — Initialize the chart of
nodes…" → **No accounts yet — Choose a chart of accounts to get started, or add your first account.**

### Bank import (`StatementImporter.tsx`, `BankFeedImport.tsx`)
"Statement Intelligence" → **Import bank statement**; "Configure/Process Deterministic Mapping" →
**Map file columns / Review and continue**; "LedgerFlow protocol fields" → **LedgerFlow field it contains**;
"Analytical Intelligence extracted N nodes" → **Extracted N rows**; "Bank Feed Ingestion" → **Import bank
feed**; "NODES DETECTED / Mark All Nodes / AI Topology Hint / Import N Vectors / Abort Mission /
Deploy Ledger Source / DATA PACKET" → **N rows ready / Select all / Suggested category / Import N rows /
Cancel / Upload bank statement / N KB file**.

### Reconciliation wizard (`ReconciliationWizard.tsx`)
"Reconciliation Wizard" → **Reconcile account**; "Select Target Topology / Protocol pending selection" →
**Bank account / Select an account**; "Statement Horizon / Terminal Amount Balance" → **Statement date /
Statement ending balance**; "Orphaned Nodes / Awaiting registry alignment / Search Registry" →
**Transactions to clear / Tick the entries shown on the statement / Search transactions**;
"Aligned Quanta / Current Registry / Topology Drift" → **Cleared in this session / Book balance /
Difference**; "Initialize Matching Protocol / Rule Auto-Match / Finalize Alignment / Rollback /
TOPOLOGY PENDING: SELECT ACCOUNT" → **Continue / Auto-match / Finish reconciliation / Back /
Select a bank account to continue.**

## Evidence

### Unit / component tests
- New `src/tests/plain-language-d97.test.tsx` (5 tests): the wizard's two-step wording and its no-account
  refusal, the bank feed importer upload state, the chart table headers and empty state, the template
  selector, each with an assertion that the old jargon cannot return. The wizard's animated step-2 body is
  not mountable in jsdom (`AnimatePresence mode="wait"` waits on an exit event jsdom never fires), so its
  body wording is covered by the browser spec below; header and footer wording is covered here.
- `src/tests/reconciliation-screen.test.tsx` updated for the new control names (its 9 checks, including the
  posted reconcile payload, are unchanged in behaviour).
- Full unit suite result recorded in the PR (no database URL in this sandbox, so database-gated suites skip
  exactly as on other local runs).

### Browser tests (real Chromium, real screens)
New `e2e/plain-language.spec.ts` (3 tests, journey-fixture harness, no database):
1. reconciliation screen desktop 1280 + phone 390: plain tabs, headings, empty-state wording, the suggested
   matches modal, no horizontal overflow at 390px, zero page errors;
2. template selector at 390px (phone, 44px targets, no overflow) and 1280px (inspector pane wording);
3. reconciliation wizard step 2 body wording and empty state.
Updated specs: `reconciliation-navigation.spec.ts`, `w4-bank-csv-import-reconcile.spec.ts`,
`bank-statement-formats.spec.ts` (9 cases), plus the existing `first-hour-guide.spec.ts` (4 cases) — all pass.

Screenshots (original captures, not visual-regression baselines) in
[`images/d97b/`](images/d97b/): `reconcile-plain-1280-light.png`, `reconcile-plain-390-light.png`,
`suggested-matches-1280-light.png`, `template-plain-390-light.png`, `template-plain-1280-light.png`,
`wizard-step2-plain-1280-light.png`. The journey fixture renders its own light theme, so these are
light-mode captures; dark mode was not re-captured here (the change is text only and the D-95/D-96 dark-mode
work is already merged).

Local browser tooling: the Playwright CDN is unreachable from this sandbox, so the browser is the
npm-distributed Chromium 153 (`@sparticuz/chromium`, from registry.npmjs.org) with its bundled AL2023
runtime libraries, driven through a gitignored local config (`.cache/playwright.local.config.ts`,
`.cache/` is already git-ignored). No package manifest, lockfile or CI config changed. The visual-regression
baselines for the reconcile screen will differ only in text and must be refreshed via the
"Refresh visual baselines" workflow before that spec is quoted.

### Static checks
- `npx tsc --noEmit -p tsconfig.json`: pass.
- ESLint: 0 errors, **205 warnings — unchanged cap** (one new-spec warning found during the run was removed).
- No money, posting, tax, `src/server/`, migration or permission file is in the diff.

## Limits / what this does not certify

- G-02 itself stays **not certified**: the authenticated sign-up → saved books → refresh journey is AI #7's
  G-24 task, and this batch is display wording with stubbed boundaries, not a database round trip.
- The reconciliation screen title "Smart Matching & Bank Reconciliation" is kept because the visual
  regression spec, i18n catalogue and two existing browser contracts assert it; renaming it is a separate
  baseline/i18n change for the lead.
- Jargon on screens outside the first-hour path (forensics, intelligence center, API hub) is out of D-97's
  scope and untouched.
- Owner-paused Vercel previews are not a code failure; GitHub CI is the independent check.
