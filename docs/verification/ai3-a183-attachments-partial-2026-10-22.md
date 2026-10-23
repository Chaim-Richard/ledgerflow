# AI #3 — A-183 attachment workflow checkpoint (partial)

**Code revision:** `906edbdda88dd3aeb1a31d4abecd48bfb3021349`
**Initial base:** `9254fdda4dda3cc9b3605f183b76ae9bd73ce528`

**Latest main integrated before final validation:** `c01983da3169ce98f356ab26e69cf051ebcd04ae` (includes #325/#316 and #334).

**Branch:** `arena/d474229b-ledgerflow`

**Status:** partial implementation, saved for review; not an A-183 completion claim or release certification.

## What changed

- The shared `AttachmentsPanel` accepts drag-and-drop as well as the file picker. It keeps the existing 700 KB per-file limit, reports per-file refusal/success, disables duplicate submits, and does not treat a failed attachment read as an empty file list.
- Preview is limited to embedded PDF, JPEG, PNG and WebP data URLs. PDFs render in a sandboxed iframe; raster images render as images. Unsupported or mismatched types are not embedded, and download links are limited to `data:` and HTTPS URLs.
- A user/workspace/role/record change remounts the panel. An upload still in `FileReader` is cancelled before the database write when that panel is no longer current. Removal also avoids duplicate activation and only changes the panel after the server confirms it.
- The panel is now reachable for saved estimates, purchase orders, customer credit notes and vendor credits, in addition to the screens that already used it (invoices, bills, customers, vendors, support tickets, workpapers, assets and the inventory-image flow).
- No ledger values, tax, posting, server routes, SQL, migrations, or database schema were changed. Files still use the existing workspace-scoped `documents` collection and attachment removal service.

## Verification actually run

Environment: Node.js **24.22.1**, clean `npm ci` from the lockfile; integrated base `c01983da3169ce98f356ab26e69cf051ebcd04ae`.

- Focused component/unit suite after the main merge: **25 passed, 0 failed** across attachment, credit-note, estimate and purchase-order tests. The PostgreSQL-gated attachment-removal suite was not exercised because `LF_TEST_DATABASE_URL` is unset.
- First local four-shard unit run after the main merge: **3,552 total; 3,549 pass; 1 fail; 2 DB-gated skips**. Shards 1, 2 and 4 passed; shard 3's sole failure was a timing-budget assertion under four simultaneous local shards: `expiring-lots` rendered in **1,167.26 ms** against a 1,000 ms threshold (that first shard 3 run had 917 tests: 916 pass, 1 fail). I investigated instead of hiding it: a solo rerun of the 12-month speed suite passed **2/2**, and the complete isolated shard 3 rerun passed **909 tests, 0 failed, 1 DB-gated skip**. The first saturated run is retained in this report; GitHub CI must confirm the final performance gate.
- `npm run lint`: **0 errors, 105 warnings** (repository cap 106; no new warnings in changed files).
- `npm run build`: passed. Existing build notices include the >1 MB main chunk and third-party annotation warnings.
- `npm audit --audit-level=high`: passed with **3 moderate** findings (transitive `ip-address` and `qs`/`typed-rest-client`); no high/critical finding.
- `npm run test:rules` and browser tests were not run locally: no local Postgres URL or Chromium. No SQL changed. GitHub CI is the next browser/RLS verification boundary.

## Remaining work / safety boundaries

### A-183 is still partial

The shared panel now supports drop/preview on the existing attachment surfaces and adds estimate, purchase-order, credit-note and vendor-credit access. It does **not** yet satisfy “any entry/document”: journal/transaction entries and payment records do not have this shared linked-file panel, and new invoice/bill forms still use their existing pre-save file picker rather than the shared drop/preview control. Keep A-183 `[~]` until the remaining document surfaces are integrated and the browser journey is verified. No generic `fileUrls`/ledger write path was added.

### A-185 needs an AI #1 draft-persistence contract

I did not implement the one-click credit-note draft action. I rechecked the **merged main** source at `c01983da3169ce98f356ab26e69cf051ebcd04ae`: `CreditNotesView` still saves the customer credit as `status: 'open'` with a **Save & Post** action, and its optional invoice picker is not a draft-only path. `useEntityOperations.addEntity()` routes `creditNotes` to `LedgerPostService.postCreditNoteLedger()`; that posting helper has a special early branch for `status === 'void'`, but for a positive amount it continues into entry construction. Setting `status: 'draft'` on the existing `addEntity` path is therefore **not a safe draft-only save**. A direct `setDoc` from the screen would bypass the document/posting service. AI #1 needs to provide or approve a draft-only persistence action before A-185 can be completed safely. This source recheck corrects the earlier AI #3 coordination note that said a draft path already existed.

### A-138 source boundary

The merged #325 coordination note reports 64 official Israeli bank identifiers and no official complete branch-code file (only a branch locator). Do not fabricate branch rows or call a locator a branch table. The reference should state that limitation unless an authoritative branch dataset and its exact source are supplied.

## PR / audit status distinction

This is a scoped A-183 implementation review, **not** completion of the repository's separate function-by-function independent-audit mission and not a launch sign-off. PR #325 is merged at `46937f09a6970859764bde4914c075f8e24d8a08` and #316 is closed. The final recorded #325 run has its unit/time-zone, lint/database, build, coverage, CodeQL and SBOM checks green, but Browser shard 4 and the required smoke check failed. The PR's handoff attributes the browser failure to the stale `balance-sheet-390-dark.png` reference after A-202 changed report height; the GitHub failure-log download returned EOF here, so I could not independently inspect that assertion. This is distinct from the owner's intentionally paused Vercel preview. These statuses are not checks on this branch. This work is saved in draft PR #341; its GitHub checks are pending after the latest-main merge.
