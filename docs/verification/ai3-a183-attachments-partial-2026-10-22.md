# AI #3 — A-183 attachment workflow checkpoint (partial)

**Code revision:** `906edbdda88dd3aeb1a31d4abecd48bfb3021349`  
**Base:** `9254fdda4dda3cc9b3605f183b76ae9bd73ce528`  
**Branch:** `arena/d474229b-ledgerflow`  
**Status:** partial implementation, saved for review; not an A-183 completion claim or release certification.

## What changed

- The shared `AttachmentsPanel` accepts drag-and-drop as well as the file picker. It keeps the existing 700 KB per-file limit, reports per-file refusal/success, disables duplicate submits, and does not treat a failed attachment read as an empty file list.
- Preview is limited to embedded PDF, JPEG, PNG and WebP data URLs. PDFs render in a sandboxed iframe; raster images render as images. Unsupported or mismatched types are not embedded, and download links are limited to `data:` and HTTPS URLs.
- A user/workspace/role/record change remounts the panel. An upload still in `FileReader` is cancelled before the database write when that panel is no longer current. Removal also avoids duplicate activation and only changes the panel after the server confirms it.
- The panel is now reachable for saved estimates, purchase orders, customer credit notes and vendor credits, in addition to the screens that already used it (invoices, bills, customers, vendors, support tickets, workpapers, assets and the inventory-image flow).
- No ledger values, tax, posting, server routes, SQL, migrations, or database schema were changed. Files still use the existing workspace-scoped `documents` collection and attachment removal service.

## Verification actually run

Environment: Node.js **24.22.1**, clean `npm ci` from the lockfile.

- Focused component/unit suite: **25 passed, 0 failed** across attachment, credit-note, estimate and purchase-order tests. The PostgreSQL-gated attachment-removal suite was not exercised because `LF_TEST_DATABASE_URL` is unset.
- Full unit tests, all four local Node test shards: **3,487 tests; 3,479 pass; 0 ordinary failures; 2 database-gated skips; 6 TODO cases**. Four of those TODO assertions reproduce the already documented cross-workspace late-save success-message issue in AI #1's L94 posting files; I did not patch those reserved financial/posting files.
- `npm run lint`: **0 errors, 105 warnings** (repository cap 106; no new warnings in changed files).
- `npm run build`: passed. Existing build notices include the >1 MB main chunk and third-party annotation warnings.
- `npm audit --audit-level=high`: passed with **3 moderate** findings (transitive `ip-address` and `qs`/`typed-rest-client`); no high/critical finding.
- `npm run test:rules` and browser tests were not run locally: no local Postgres URL or Chromium. No SQL changed. GitHub CI is the next browser/RLS verification boundary.

## Remaining work / safety boundaries

### A-183 is still partial

The shared panel now supports drop/preview on the existing attachment surfaces and adds estimate, purchase-order, credit-note and vendor-credit access. It does **not** yet satisfy “any entry/document”: journal/transaction entries and payment records do not have this shared linked-file panel, and new invoice/bill forms still use their existing pre-save file picker rather than the shared drop/preview control. Keep A-183 `[~]` until the remaining document surfaces are integrated and the browser journey is verified. No generic `fileUrls`/ledger write path was added.

### A-185 needs an AI #1 draft-persistence contract

I did not implement the one-click credit-note draft action. `useEntityOperations.addEntity()` routes `creditNotes` to `LedgerPostService.postCreditNoteLedger()` (`src/hooks/useEntityOperations.ts:172–175`). That posting helper has a special early branch for `status === 'void'`, but for a positive amount it continues into entry construction (`src/services/ledgerPost/creditPosting.ts:84–110`); setting `status: 'draft'` on the existing `addEntity` path is therefore **not a safe draft-only save**. A direct `setDoc` from the screen would bypass the document/posting service. AI #1 needs to provide or approve a draft-only persistence action before A-185 can be completed safely.

### A-138 source boundary

PR #325's current coordination note reports 64 official Israeli bank identifiers and no official complete branch-code file (only a branch locator). Do not fabricate branch rows or call a locator a branch table. The reference should state that limitation unless an authoritative branch dataset and its exact source are supplied.

## PR / audit status distinction

This is a scoped A-183 implementation review, **not** completion of the repository's separate function-by-function independent-audit mission and not a launch sign-off. Existing AI #3 PRs #316/#325 remain separate; #325's latest recorded CI has Browser shard 4 red, reported there as the stale `balance-sheet-390-dark.png` reference after A-202 changed report height (the run was still in progress when checked, and its failed-job logs were not yet available). This is distinct from the owner's intentionally paused Vercel preview. These statuses are not checks on this branch.
