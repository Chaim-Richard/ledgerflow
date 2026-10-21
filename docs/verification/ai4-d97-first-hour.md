# AI #4 — D-97 first-hour guidance and dead-end audit

Date: 21 October 2026. Base revision: `1db37c666d27d5781af432a0474edbd4eddba3ae`.
Branch: `arena/fd8ecf70-ledgerflow`. **Implementation ready for review; D-97/G-02 not certified complete.**

## What changed

- Overview now has a keyboard-operated, collapsed **First-hour bookkeeping guide**. It remains available after setup and after entries exist; returning to Overview restores access without a separate wizard or progress claim.
- Empty guest books use the same eight steps: chart → customer → invoice → bill → payment → import → reconcile → P&L. Removed “Your Ledger is Ready”, “mathematical engine”, “200+” and automatic AI-learning promises.
- Buttons use the existing navigation/template controls. P&L explicitly selects `pnl`, even if the user previously opened another report. No new financial mutation or completion state is introduced.
- Guidance distinguishes draft vs posted sales, payment records vs actual bank transfers, imports vs reconciliation, and balanced reports vs verified books. It tells users how to return, retry missing data and find help.
- The walkthrough reproduced an unexplained disabled **Import statement** action in guest/viewer sessions. A visible explanation is now linked with `aria-describedby`. The same role check and disabled/handler refusal remain intact.
- Removed the existing dashboard checklist's promise of “complete algorithmic accuracy”.

No changes to monetary calculations, posted payloads, tax, account-role resolution, server code, SQL, or permission policy.

## Executed evidence

- `npm ci --ignore-scripts`: passed (installation only; hooks deliberately not run).
- `npm run lint:types`: passed after the final source/test edits.
- Targeted component tests: **13 passed, 0 failed**, covering the new guide, banking states and setup wizard; run with the migrated test database configured. Browser and component APIs are stubbed where their fixtures require it.
- Chromium **7/7 passed**: `e2e/first-hour-guide.spec.ts` (four cases: 390/1280px × light/dark), plus the existing W2 invoice/payment/statement, W3 bill/payment-run/statement and W4 bank-CSV/reconciliation specs.
  - New spec opens the actual app destinations through the guide, exercises Enter and Escape, opens the customer and chart dialogs, verifies the guest import refusal, confirms the P&L destination, then empties the demo cache and checks the empty welcome.
  - Guide controls are at least 44px tall, stay within the viewport, and cause no document horizontal overflow or uncaught browser errors.
  - The W2/W3/W4 specs are the existing **mocked-boundary browser contracts**, not actual bank/provider or authenticated DB round trips. Their financial expectations were not edited.
- Local PostgreSQL **17.9** (disposable database): all repository migrations applied; `npm run test:rules` reports **ALL RLS TESTS PASSED**.
- `npm audit --audit-level=high`: exits 0; **2 moderate** transitive `qs` / `typed-rest-client` findings remain. No dependency changes made.
- Initial whole-tree ESLint: **0 errors, 207 warnings**, cap unchanged; final rerun/build/full-suite results will be appended below.
- First local `npm test` attempt on Node 22 was stopped after slow progress, not reported as a pass. Full suite is being rerun on the required Node 24 against PostgreSQL; GitHub PR CI independently runs its full gates.

Local browser tooling: npm-distributed Chromium 153, ignored `.cache/playwright.local.config.ts`, extracted runtime libraries via `LD_LIBRARY_PATH=/tmp/al2023/lib`. No production config, package manifest or lockfile changes for this tooling. Browser checks ran separately from heavy unit/build checks.

## Screenshots

Files in [`images/d97/`](images/d97/) are original, intentionally reviewed screenshots, not refreshed visual-regression baselines:

- `before-390-light.png`, `before-1280-light.png`: original Overview; the original cookie notice is visible. Before screenshots used the default light theme (no dark-before claim).
- `guide-{390,1280}-{light,dark}.png`: Overview guide opened by keyboard, with the consent notice already handled in the fixture.
- `empty-{390,1280}-{light,dark}.png`: same guide in empty demo books.

Reviewed phone/light and desktop/dark captures for readable labels, stacking and bounded controls; geometry is also asserted in all four cases. The app uses an internal scrolling content area, so captures show the visible area, not every card simultaneously. No current screenshot-baseline screen was intentionally restyled; broad visual approval remains with the lead.

## Deliberate limits / next proof

**D-97 remains in progress; G-02 and W1 remain Partly/Unverified.** This is useful first-hour navigation and wording evidence, not an authenticated end-to-end launch sign-off:

1. AI #7's G-24/W1 journey still needs sign-up → saved company → chart → first posted invoice → worked report, including refresh and actual PostgreSQL persistence. Existing setup component contracts do not replace it.
2. The guest path cannot import bank records by design. A signed-in authorized journey must exercise the actual import/save/reconcile boundary on phone as well as desktop. W4's existing mocked browser case does not establish that boundary.
3. Reconciliation still uses jargon (e.g. “Streams”, “Registry Unoccupied”, “Cognitive Alignments Panel”). Those existing screens and their contracts were not renamed in this small batch; finish that wording pass before claiming “every unclear word” is fixed.
4. No live email delivery, bank-provider acceptance, actual transfer, tax filing, production configuration or deployment claim is made.
5. AI #1 reviews/merges; this branch must not merge itself. Owner-paused Vercel previews are not treated as code test failures.

## FINAL LOCAL HAND-OFF — 21 October 2026

Implementation commit: `78653d3`. PR: [#275](https://github.com/shmuelbiller1/ledgerflow/pull/275).

| Check | Final observed result |
|---|---|
| Whole unit suite, Node 24 + migrated PostgreSQL | **3,658 passed; 765 suites; 0 failures, skips or cancellations**; exit 0, 710.1s |
| Types and whole-tree ESLint | pass; **0 errors / 207 warnings**, unchanged cap |
| Clean lockfile install | `npm ci --ignore-scripts` on Node 24 passed; manifest/lockfile unchanged |
| Production build after clean install | pass; Vite client + PWA service worker + bundled server generated; existing large-chunk warnings only |
| Component checks repeated after clean install | **13/13**, no skips |
| Browser checks | **7/7**, as detailed above |
| RLS | **ALL RLS TESTS PASSED** |
| Dependency audit high gate | pass; 2 moderate findings remain |
| Independent GitHub CI | **not run**: no PR checks appeared, and manual dispatch returned HTTP 403 “Resource not accessible by integration” |
| Coverage / all-browser suite / timezone matrix | not run locally; not substituted by targeted browser checks or unit pass counts |

Full-suite command uses the repository's exact file globs, deterministic salt and test database, with Node 24 and explicit resource-bounded concurrency:

```sh
NODE_ENV=test SYSTEM_SALT=test-ledgerflow-salt-32b-deterministic \
LF_TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lf_test \
npx tsx --test --test-concurrency=4 \
  src/tests/*.test.ts src/tests/*.test.tsx src/lib/*.test.ts src/server/utils/*.test.ts
```

**Tooling incident (resolved, not a product change):** installing temporary Chromium with `npm install --no-save` re-hoisted Babel 8 above Workbox's Babel 7 plugins. The first build failed while generating the service worker. Restoring the exact lockfile tree with `npm ci --ignore-scripts` restored root Babel 7.29.7 and the complete production build passed. No dependency “fix”, manifest change, override or relaxed build gate was committed. The full suite ran before this clean reinstall; targeted components were rerun afterwards. Browser binaries/runtime libraries remain outside the dependency tree for future local runs.

Final for **this bounded implementation/audit hand-off**, not final certification of D-97, G-02, W1 or the release. Remaining wording audit also includes the existing chart selector's “Analytical Workspace Selector” / “Verified Invariant Maturation” labels, in addition to reconciliation jargon. Those are explicitly not claimed fixed by this batch. AI #1 can review this small batch independently; AI #7's authenticated first-hour proof and the remaining wording pass are still required.
