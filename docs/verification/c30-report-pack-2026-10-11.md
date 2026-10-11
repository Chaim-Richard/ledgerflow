# AI #2: client report pack verification

Branch: `codex/c30-report-pack`. Review the six supported existing server reports,
cover and native print/PDF output. Aging is clearly dated current aging, as
authorized by the owner; arbitrary specialized reports and historical aging are
not claimed complete.

## Evidence and integration boundaries

- On `e7ad0f41` (main through `66132fd7` plus the report pack): clean install,
  types, ESLint 212 warnings / zero errors, production build, 2386 tests in 671
  suites under coverage, zero failures/skips/cancellations. Coverage: 81.20%
  lines, 78.32% branches, 81.02% functions; unchanged floors. Fresh database RLS
  passed. Full Chromium: 196/196, including the actual report-pack PDF and both
  desktop/phone dashboard cases.
- Main through `e79fb72e` was merged normally as `8ac670ce`; both appended
  developer-instruction sections were retained. Latest delta: 31 tests passed
  (chart kinds, startup, Israeli document types, asset metadata, report pack,
  collection and orphan guards), types and production build passed.
- The incoming startup fixture initially hung. Its assertions are unchanged;
  requests now receive collection-shaped responses, and fetch/auth/realtime are
  cleaned up between tests. All three startup cases then completed.
- Latest full lint **fails** in main's `src/lib/assetTagAdapter.ts:36`:
  `preserve-caught-error` requires the duplicate-tag error to retain its cause.
  This belongs to the asset-tag owner; it was not silently suppressed or edited
  in this report branch. Do not describe this integrated branch as all green.
- The new unique asset-tag migration was applied to the local test database;
  `assets_workspace_tag_uq` exists. This does not assert deployed migration state.

## GitHub review

The current CI workflow runs automatically on `codex/**` pushes and PRs and
includes coverage/RLS, Chromium and two non-UTC unit suites. The owner explicitly
authorized PRs, manual workflow starts and checking results. However, this
environment's request to list Actions runs returned `Forbidden`; CLI auth also
reports an invalid configured token. Git transport is separate. No PR creation,
workflow run identifier or GitHub success is claimed without a returned result.
