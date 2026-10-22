# D-99 · W14 — roles and access: owner, accountant, bookkeeper, viewer

**Task:** D-99 = F-50, P0 for stage A. Browser journey: owner, accountant, bookkeeper and viewer each
sign in to the same books; check what each can and cannot do (post, approve, close a month, change
settings, see payroll), with the reason shown for each blocked action.

**Spec:** `e2e/w14-roles-access.spec.ts` (390 px and 1280 px, plus one Node-side policy check).

## The rule the test follows: the screens are checked against the server, not against itself

The allowed-role lists are **read from the server source at test time**, so they cannot drift into a
self-fulfilling stub:

| Action | Where the server's list lives |
|---|---|
| Change the books (post, edit, reconcile) | `LEDGER_WRITER_ROLES`, `src/server/middleware/requireLedgerWriter.ts` |
| Close / reopen / unlock a period | `CLOSE_ROLES`, `src/lib/periodLock.ts` (used by `closePeriod`, `src/server/services/periodCloseService.ts`) |
| Run payroll (`/pay-runs`) | `src/server/routes/workspaceRoutes.ts` |
| Restore a backup (`/restore`) | `src/server/routes/workspaceApiRoutes.ts` |
| Apply a chart-of-accounts template | `src/server/routes/workspaceRoutes.ts` |
| Manage team members (`/members`) | `src/server/routes/workspaceApiRoutes.ts` |

The journey signs each role in to the same workspace and asserts the screens allow exactly what
those lists allow — nothing more, nothing less.

## What is asserted per role (each at 390 px and 1280 px)

1. **Team settings** (`TeamSettings.tsx`) — the server lets only the `/members` roles manage people.
   - Those roles get a working invite: the *Edit Invite team member email* control is enabled, and
     clicking it opens a text field that can be typed into (the positive case, not just visibility).
   - Every other role gets the guarded control: `inert`, `aria-disabled="true"`, the tooltip
     *"Only the workspace owner can invite new members"*, and no invite field anywhere on the page.
2. **Month-end close** (`MonthEndCloseView.tsx`) — for the `CLOSE_ROLES` roles the *Soft close* and
   *Close {month}* controls are on the screen; for everyone else they are absent and the screen says,
   in words built from the same list, "*Owners and accountants* close and reopen periods. You can
   sign off the items you reviewed." (the sentence is matched with the role names taken from
   `CLOSE_ROLES`, so a role added to the server list fails here until the words are updated).
3. **Reports stay readable for every role**, including the viewer: the real `ProfitAndLossView`
   renders its statement for the viewer too (read-only access is access).
4. **The shared gate** (`RequireRole.tsx`): the owner's action runs (the click reaches its handler);
   everyone else instead sees the explanation *"This action requires OWNER privileges. Your current
   role is ACCOUNTANT/BOOKKEEPER/VIEWER."* — the blocked action is named, not silently missing.
5. **Axe** — no serious or critical violations on the final screen.

The last test in the file is a Node-side policy check: every list is non-empty, every closing role
and every payroll role may also change the books (a narrower list may never exceed a wider one),
the viewer is in none of the allow lists, and the ledger-write refusal still reads *"Forbidden:
changing the books requires the owner, accountant or bookkeeper role"*.

## Where the rest of W14 is covered (so this journey does not overclaim)

| Part of W14 | Covering test |
|---|---|
| Server middleware refuses each role on each route | `src/tests/server-write-roles.test.ts` (role resolution, every named workspace checked, owner-only members/API keys, router order) |
| Period close roles and refusals | `src/tests/` period-close suites (`Only owner or accountant can close a period`) |
| Payroll approval by owner only (U-10), accountant sends for approval | `src/tests/pay-run-ui.test.tsx` |
| Guarded control cannot be clicked, focused or pressed with Enter/Space | `e2e/role-controls.spec.ts` |
| Database-level row security per workspace and role | `npm run test:rules` (`supabase/tests/rls.test.sql`) |

## Limits, stated plainly

- The refused **HTTP** calls are not re-played through the real Express middleware here; that
  behaviour is the unit suite's, and this journey's job is that the screens agree with it.
- A real authenticated session with four real accounts against a deployed environment is not part of
  this test (G-24 owns the authenticated journey).
- Stub messages in the fixture are not the assertion; the assertion is the screens' own gating and
  the server lists read from source.

## Accessibility findings

Axe on the last screen of the journey (the profit & loss statement, viewer signed in) finds **serious**
`color-contrast` issues: **4 nodes** at both widths, on the statement's small upper-case labels and
muted figures in light mode. They are recorded in `e2e/journey-a11y-baseline.json` (may only go down)
and reported to the lead with the same finding from D-98: the contrast suite measures the Reports
tab's landing screen, so the statements' own text had never been measured in CI.
