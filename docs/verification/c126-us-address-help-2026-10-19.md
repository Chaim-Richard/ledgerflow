# C-126: US address input help — AI #2, 19 October 2026

Branch: `codex/c126-us-address-help`. Tested source base: `0ace84f1`.

Settings → Tax profiles → Edit now offers an optional **Read state and ZIP from a US address** disclosure when the draft explicitly declares US. It reuses `parseUsStateAndZip` without changing parser or financial logic. An explicit button copies only a complete recognized state/ZIP pair; other draft fields remain intact. Leading zeros and ZIP+4 remain text. English controls and mixed Hebrew input coexist.

This is local input assistance, not address verification, geocoding, residency, ZIP/state agreement, tax jurisdiction or registration evidence. Partial, ambiguous, foreign, military and territory addresses cannot be copied. No network request, persistence or automatic Save is added. Country, user/workspace and editor changes clear scratch input. Existing role checks and guarded profile Save remain responsible for writes.

## Evidence

- Focused component/parser tests: **29 passed**, zero failures/skips. Includes explicit copy, retained fields, mixed Hebrew, no request, cancel/reopen, country/workspace resets and unsupported-address refusal.
- Full coverage: **3,321/3,321 tests passed**, 731 suites, zero failures/skips; lines **80.76%**, branches **78.96%**, functions **82.11%**. All existing thresholds pass; full test target ran once with real Postgres.
- Type check and production build pass. Full ESLint: **0 errors, 210 warnings**, existing cap unchanged. Real Postgres `test:rules`: **ALL RLS TESTS PASSED**, using migrated `lf_codex_taxhelp`.
- Browser: **4/4 passed**, 390px and 1280px, light and dark. Keyboard disclosure/copy, 44px targets, bounded geometry, retained fields, rejected suggestions, country reset and cancel/reopen exercised. An additional desktop smoke passed.
- Before screenshots: `/workspace/scratch/c126-before/{390,1280}-{light,dark}.png`; after screenshots: `test-results/us-address-help-*/us-address-help.png`. Inspected montage: `/workspace/scratch/c126-helper-review.png`. Artifacts are local and ignored, not committed visual baselines.
- An initial browser locator timeout was corrected with explicit textarea label/ID association; final four configurations pass. The synthetic-owner fixture can show the existing background loading toast over the lower page; this is not evidence of a clean authenticated full-page journey.

The browser fixture mounts the actual app/editor with cached synthetic owner/workspace state. It does not prove authenticated server persistence. No migration, server route, posting, money calculation, quality budget, dependency or screenshot baseline changed. W8 remains partial, with CON-1/CON-2 and journey-level verification separate.

Main advanced to `9383603b` during verification; its package/lock changes were not merged into this tested branch. The edited parent, parser, relevant hooks/stores and migrations were unchanged between those revisions. Combined-main CI and merge are unverified. Branch pushes do not run the current PR/main workflow; GitHub API PR creation remains unavailable from this session.
