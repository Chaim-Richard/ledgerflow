# Agent #3 — warehouse launch-readiness audit, 16 October 2026

Status: verification in progress on `arena/2c2ad9f1-ledgerflow`, based on main `a1b011f`.
This is a scoped audit/fix batch, **not a whole-system launch sign-off**. No financial calculations,
posting services, server routes, migrations, quality budgets or screenshot baselines are changed.

## What changed

1. **Keyboard access:** both Inventory workflows and Warehouse operations now have one Tab stop,
   arrow-key activation with wraparound, Home/End, correct LTR/RTL direction, and focus on the active
   tab. Every `aria-controls` points to an existing panel. Inactive panels do not mount their screens
   or request their collections. Previously, inactive tabs had `tabIndex=-1` without key handling,
   so keyboard users could not reach them.
2. **Shipment pending guard:** a synchronous ref prevents two immediate activations from sending
   duplicate metadata writes before React renders the disabled button. A refused write retains the
   carrier and tracking draft; an explicit retry is possible.
3. **Repeat printing:** the packing-slip Print action creates a fresh print request even if the slip
   is already open. `afterprint` and unmount clean up the page's temporary print class. The printed
   content is goods-only, not a shipment, stock adjustment, invoice or credit.
4. **Phone layout:** long Location/customer labels no longer force selectors outside a phone. The
   initial browser audit reproduced a **956px document on a 390px viewport**. Fields/labels now
   shrink inside their containers; long saved RMA names/reasons wrap; history controls have 44px
   height. Wide tables retain their existing native horizontal-scroll region rather than hiding data.
5. **Honest approval claims:** the RMA screen and capability row 184 explicitly distinguish editable
   workflow notes from a server-enforced two-person approval or immutable history. The generic
   metadata RPC does not validate each transition or compare a revision. That limitation is a
   reserved-server handoff, not solved by a browser permission check.
6. **Queue accuracy:** AGENTS.md's five initial priorities and its A-15/A-16/library-only handoffs
   were stale. Their completed status is now stated without rebuilding them. The remaining partial
   tasks stay partial, and the blocked A-72 contract is recorded below.

## Trace from screen to persistence

| Boundary | What was checked |
|---|---|
| Entry | Reports registry → Inventory Cycle Count (`CycleCountReportView`) → Warehouse operations → Bin locations / Pick, pack and ship / Return authorizations / Warranty register. Existing global navigation and pins are unchanged |
| Inputs | Workspace-scoped loaded inventory, estimates, invoices, transactions, customers and credit notes; existing `useLedgerCollections` calls, loading/failure/truncation checks and read-only guest/viewer behavior. These are cached operational views, not proof of complete authoritative history |
| Computation | Existing `buildWarehousePickList`, `orderLineProgress`, delivery/return helpers and warranty/RMA helpers are unchanged. No new stock or monetary calculation |
| Action | Existing `useEntityOperations.updateEntity` → `updateDoc` → `lf_update`; nested fields only, with UI writer checks and duplicate-pending/refusal handling |
| Persistence | `inventory.binLocations`, `estimates.metadata.warehouseShipmentsBySource`, `customers.metadata.returnAuthorizationsById` / `warrantiesById`. Real migrated PostgreSQL tests re-read these records, preserve unrelated metadata, refuse viewers/non-members/workspace reassignment and assert zero new transactions, stockMoves or creditNotes |
| Evidence | `warehouse-operations-view.test.tsx`, new `warehouse-metadata-persistence.test.ts`, new `e2e/warehouse-operations.spec.ts`, existing cycle-count/warehouse/asset and repository guard suites |

A nested-field patch is atomic at that request boundary, but editing the same metadata record from
several browsers has **no compare-and-swap guarantee**. Histories here are editable metadata; they
are not the financial audit log. Browser provider stubs establish request/UI contracts; the separate
Postgres tests establish database persistence/RLS. Neither is authenticated production acceptance.

## Task status and reserved handoffs

A-203, A-204 and A-205 are **partial: the four warehouse panels only**. Do not mark the all-report
accessibility/phone/Hebrew sweep complete from these tests. A-208's handoff inventory is recorded,
but the incomplete work below is not converted into completed tasks.

| Task | Current evidence / what is still missing |
|---|---|
| A-8 asset maintenance/tags | Screen, Code 128/QR, files and DB uniqueness test exist. `20261014010000_unique_asset_tags.sql` is already on main and passes on a clean local migrated DB. It skips index creation when legacy duplicate tags exist: resolve duplicates and confirm deployed `assets_workspace_tag_uq`. The bulk Give tags flow still uses its existing cache-based candidates; no production DB was inspected |
| A-19 item bundles | Parts editor/library exist. Expanding a bundle into invoice lines remains in the reserved InvoiceModal/invoiceLines flow |
| A-32 units | Unit definitions, conversion helpers and item editor exist. Invoice/estimate-line conversion display remains in the reserved sales forms |
| A-33 serial/lot capture | Lookup screen exists and recorded serials feed the warehouse warranty screen. Capturing serial/lot numbers in the reserved receipt/invoice forms is not finished |
| A-69 credit limits | Limit editing and report exist. The warning in reserved InvoiceModal is still missing |
| A-70 dunning | EN/HE preview exists. Actual sending, once-per-step log and stored schedule require the reserved server/email path |
| A-72 entity-filtered customer statements | **Blocked before implementation.** `loadStatement(db, workspaceId, contactId)` always produces an all-history, all-entity PDF. The existing JSON route also has no entity filter. AI #1 must define line-level entity treatment, allocations across entities, unallocated payments/credits and a single authoritative scope shared by screen, PDF and any email. A browser-only entity filter with the current PDF would silently send the wrong scope |
| A-66 approval authority | The UI enforces different-requester owner/accountant decisions; existing RLS restricts metadata writers, not the sequence or actor encoded inside a metadata event. A validated server transition/CAS contract is required before claiming enforced two-person approval or immutable history |

## Verification

Environment: Node 24.22.0; isolated PostgreSQL 18.4 with every checked-in migration applied
(CI uses PostgreSQL 17); Chromium 153 from a sandbox-only npm tool installation. No production
records or secrets were used. Tool binaries, logs, screenshots and PDFs stay outside Git/in ignored
artifact directories.

- `npm ci` on Node 24: pass; lockfile unchanged.
- `npm run db:test-setup`: pass, every migration applied to the isolated test database.
- `npm run test:rules`: **ALL RLS TESTS PASSED**.
- Focused component + real-database suites: **14/14 pass** (five existing UI cases, five new UI cases,
  four new persistence/RLS cases).
- `npm run lint`: pass, **0 errors / 210 warnings**, unchanged from base (cap 212).
- New Chromium suite: **5/5 pass**: LTR and RTL keyboard tests, all four panels with long saved data
  at **390px and 320px**, zero serious/critical axe violations, 44px controls, refused-save retry,
  actual Hebrew CSV download, metadata-only request allowlist, repeat goods-only print PDF.
- Four phone/RTL screenshots were opened and reviewed; saved data stays within the page and wide
  tables remain scrollable. These are test artifacts, not refreshed pixel baselines.
- `npm audit --audit-level=high`: pass, **0 high / 0 critical**, two moderate development-chain
  findings (`@stryker-mutator/core` → `typed-rest-client` → `qs`).
- `npm audit --omit=dev --audit-level=moderate`: **0 vulnerabilities**.
- Full accounting/security suite with coverage gates: pending final result.
- Production build, broader existing browser regressions and final guard follow-up: pending.

The full verification uses the existing coverage thresholds (lines 75%, branches 72%, functions
73%) and test globs, with `--test-concurrency=4` placed **before the test paths** through
`node --import tsx --test`. A trailing flag appended by `npm test -- ...` was not effective for
parallelism here; its slower preliminary invocation was stopped, not counted as a completed run.

## GitHub and release state

Main `a1b011f` CI run [38841187066](https://github.com/shmuelbiller1/ledgerflow/actions/runs/38841187066)
is red in Playwright, while build, database/coverage and both timezone jobs pass. Issue
[#136](https://github.com/shmuelbiller1/ledgerflow/issues/136) documents known mobile visual-baseline
failures. GitHub's detailed logs/diagnostic download host is not reachable from this sandbox; do not
infer that every main E2E failure is the same visual issue. No screenshot tolerance/baseline was
relaxed to make this batch pass.

Branch push / PR / final CI state will be recorded after the local checks. No merge or deployment
is authorized by this audit.
