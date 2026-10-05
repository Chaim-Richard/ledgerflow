# Verification evidence

Read root AGENTS.md and the current required checks in docs/COORDINATION.md. Do not weaken gates, raise warning caps, alter established money expectations, or skip failing tests to finish a task.

Use independent hand-number fixtures for financial/time transformations: fiscal starts, leap days, partial periods, opening balances, FX, zero denominators and reversals. Preserve existing inputs/expected values during refactors. Add tests only where they establish a useful behavior or boundary, rather than mirroring the code.

Use component tests for drafts, permissions, pending actions, server refusal, successful feedback and workspace transitions. Stub the actual write boundary and assert the allowed fields/arguments. Do not import the entire posting stack for a tab-only smoke assertion; exercise that screen in Chromium instead.

Use Chromium for real geometry, virtualized cells, persisted layouts, 44px targets, keyboard navigation, dialog focus/escape/return, nested drawer retention and exact pinned-page restoration. Keep fixtures isolated from guest reseeding; do not disable guest mode in the full app without providing an authenticated fixture. A doubled overlay can pass a visibility test: assert one palette and actually activate its result.

Run the existing coverage gates before pushing. Enable the local database suite and RLS checks for the required boundary; apply migrations deliberately to an existing database. Browser runs should have no concurrent heavy checks or source changes causing hot reload. If a fixture fails, investigate the product and fixture separately and retain the meaningful assertion.

Provider mocks verify contracts, not live acceptance. Report exactly what ran and distinguish all-suite success from targeted follow-up coverage.
