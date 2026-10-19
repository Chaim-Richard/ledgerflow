# C-116 / C-119 / C-123: existing tax-screen wiring verified

AI #2 (Codex), 19 October 2026. Documentation-only branch from main `568f4788`. No application, test, dependency, migration, money, posting or tax-calculation changes.

The queue was stale after AI #3's journey work merged. These tasks require a library to be reachable from a screen, with help, an e2e entry and screenshot review. All three now meet that wiring scope:

| Task | Reachable screen | Actual consumption |
|---|---|---|
| C-116 | Reports → Israel Month Journey | `IsraelMonthJourneyReportView` → `israelMonthJourney` → `israelVatReturn` in `src/lib/tax/ilVatReturn.ts` |
| C-119 | Reports → Israel Month Journey → PCN874 historical draft | `ilPcn874Preview` → `buildPcn874FixtureDraft` in `src/lib/tax/pcn874Draft.ts`; guarded Download PCN874 draft |
| C-123 | Reports → US Quarter Journey | `UsQuarterJourneyReportView` → `usQuarterJourney` → `usSalesTaxReturn` in `src/lib/tax/usSalesTaxReturn.ts` |

All have existing registered report entries/help in `src/config/registry.tsx` and `src/config/screenHelp.ts`, plus actual-app mount cases in `e2e/view-registry-coverage.spec.ts`. Rebuilding those screens would duplicate merged work.

## Fresh checks on this main revision

- Frozen-lockfile `npm ci` passed using pinned npm 10.8.2 and Node 24.
- **58/58 existing tests passed**, zero failures/skips: Israeli month and US quarter transformations/panels, Israeli VAT unit/golden cases, PCN874 draft, US sales-tax return, capabilities guard. No expected money figures changed.
- **2/2 existing desktop registry browser tests passed** for both report entries.
- **8/8 additional actual-app screen/screenshot checks**: both screens, 390px/1280px, light/dark. Final fixture opens the phone navigation, activates Reports, dismisses its backdrop, then activates the normal report button. Cookie consent is dismissed using Essential Only. The PCN874 section and its not-filing-ready warning receive a separate screenshot in all four configurations.
- Screenshot paths: `/workspace/scratch/tax-screen-review/{il,us,pcn}-{390,1280}-{light,dark}.png`; local scripts/logs live alongside that ignored artifact directory. These are inspected screenshots, not changed visual baselines. Guest/demo screenshots prove reachability and presentation, not authenticated historical completeness, filing or persistence.

An initial attempt ran the desktop-oriented registry fixture under phone projects: Reports was hidden in the closed menu. A second local screenshot attempt left the navigation backdrop open. Both fixture issues were diagnosed and corrected using real navigation and backdrop actions, with no forced clicks or product patch. The original desktop cases pass unchanged.

## Evidence reused and limits retained

The preceding C-126 batch ran full real-Postgres coverage: **3,321/3,321**, 731 suites, no failures/skips; 80.76% lines / 78.96% branches / 82.11% functions, plus RLS/types/lint/build, on base `0ace84f1` (see its verification note). This is prior-revision evidence, not a new complete-suite result on `568f4788`. Financial journey libraries and their calculations are byte-identical to that tested revision; current view changes are attention colours and displayed registration text, covered by this batch's panel/browser reruns. This documentation-only batch does not rerun the full suite or claim combined-main CI has passed.

The existing worked fixtures remain the money evidence: [Israeli month](ai3-a152-israeli-month.md), [US quarter](ai3-a153-us-quarter-journey.md), and [whole-year goldens](ai3-a198-a199-a106-2026-10-19.md). C-116's screen wiring does not resolve #160's persisted equipment/report adapter. C-119 does not certify the 2010 historical Appendix A layout for current filings; unmapped documents and report differences remain visible and can block draft download. C-123 does not establish complete authoritative state-return history. W7/W8 stay partial; CON-1…4 remain with the lead. No new readiness claims or capability upgrades.

C-115 still needs trustworthy filing-fact provenance; C-117 needs real issuance facts; C-120 and C-121 still need their safe historical input adapters/reserved editor handoff. C-122/C-125 parking and country-scope rules remain in force. C-126's separate pushed branch is not yet merged; C-128's completed branch is an ancestor of current main.
