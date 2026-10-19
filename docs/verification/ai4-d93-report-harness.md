# D-93 report harness and BUG-02 screen coverage — AI #4

The P&L and trial-balance regression cases mount the real screens with an owner
fixture and a non-null workspace ID. A successful server period displays literal
98765 cents ($987.65); the next period/date receives 503. Each screen must remove
the old amount and server-authoritative badge. Exactly two correctly scoped
requests are required, so a fetch/render loop cannot silently pass.

The P&L fixture has a matching sales row, no COGS/expense and gross/net profit 98765. Trial balance has cash debit 98765 and capital credit 98765, equal debit and
credit totals. The browser cache is empty, making the old server figure distinct
from the local fallback. No production helper generates expected money.

## Hang investigation and fix boundary

On pinned main `26d3275c`, a simple non-null-workspace P&L probe exited naturally
in 1.35s. The expanded two-screen owner fixture reproduced a concrete teardown
hang: both assertions passed, but cleanup that called the lazy `getSupabase()`
accessor solely to disconnect/dispose a client caused a 12s outer deadline to
expire (exit 124). The runner had not completed even though both cases printed
success. Removing that unnecessary SDK startup, with the same screens/responses,
allowed ordinary completion (exit 0, about 2.0s for two cases).

This controlled experiment identifies SDK creation during teardown as the trigger
in this fixture. It does not claim every historical hang has the same cause or
identify an internal SDK timer with certainty. No SDK or application lifecycle
code is patched to guess at the cause.

The new test-only harness owns finite report replies, stable cache arrays, mounted
React trees, stores and the replaced fetch function. It unmounts and restores
those resources in `finally`; it does not create an unused auth/realtime client
while cleaning up a mocked GET-only screen test. Existing tests and financial
expectations are unchanged.

A separate liveness contract spawns both real screen cases in a fresh Node runner
and requires natural exit, two passes, zero cancellations and no signal. A 15s
failure deadline catches future hangs quickly; there is no force-exit flag or
success on timeout. The normal focused set has three cases (two screens plus the
liveness guard), with the child independently running the two screens again.

## Evidence and limits

- Auckland: 3/3 pass, no failures/skips/cancellations, natural exit in ~4.5s.
- Los Angeles: final three-case fixture passes with natural exit in ~4.2s.
  Exact-head full GitHub results are recorded in the PR.
- Full types and targeted ESLint pass. No dependencies, scripts, quality caps,
  source financial maths or existing test inputs/expectations changed.
- Stable API fixtures prove screen fallback contracts, not a live server, correct
  financial postings, complete history or a whole W5 journey. W5 stays partial.

```sh
NODE_ENV=test SYSTEM_SALT=test-ledgerflow-salt-32b-deterministic TZ=Pacific/Auckland \
  node_modules/.bin/tsx --test src/tests/report-failure-ui.test.tsx src/tests/report-harness-exit.test.ts
```

Repeat in America/Los_Angeles. No screenshot changed because this PR changes only
test infrastructure and assertions. Full accounting/RLS/coverage/timezone/build/
browser/security gates run on GitHub. Vercel remains intentionally blocked by the
owner to avoid limits.
