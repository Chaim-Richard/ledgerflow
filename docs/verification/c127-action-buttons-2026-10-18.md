# C-127 / BUG-06 — enabled controls must do what they say

AI #2, 18 Oct 2026. Branch `codex/c127-action-buttons`, base main `26d3275c`.

The pinned audit reported ten enabled button declarations without actions and a Close Period button which selected a card. This batch fixes those controls, without inventing financial actions.

| Control | Result |
|---|---|
| Pricing tier buttons | Open Settings → Billing & Plan; labelled Review plans in billing, without promising to start a trial |
| Consolidation Export Report | Disabled with visible explanation: complete consolidated-history export is unavailable |
| Fiscal Export | Disabled with visible explanation that export is unavailable; no tax function changed |
| Forensic Generate Full Audit Log | Open audit trail navigates to the existing registered Audit Trail |
| Profitability expand icon | Disabled with visible explanation and the table as the available review path |
| Profitability Export Node | Disabled with visible explanation that export is unavailable and analysis uses loaded transactions |
| Latest Events | A noninteractive live status, rather than a pretend filter |
| Provision New Endpoint | Disabled with visible explanation that provisioning is unavailable |
| Generate Brief | Disabled with visible explanation that generation is unavailable; project details remain available |
| Run Year-End Wizard | Open closing workspace navigates to the existing Month-End Close workflow; no claim of immediately closing a year |
| Close Period on a card | Review period selects the card; the separate working Hard Close Period control is retained |

Disabled controls retain native disabled semantics and an accessible description referencing a visible explanation. New navigation targets meet the 44px target. No financial handler, tax calculation, posting, API/server, schema, dependency or warning-budget change.

## Verification

- Full `npm run test:cov` with the previously fully migrated local `lf_codex_taxhelp` database: **3,261 tests / 731 suites, all passed, zero failed/cancelled/skipped**. Coverage **80.66% lines / 78.80% branches / 82.07% functions**, existing thresholds pass. No migrations changed since that database was prepared.
- `npm run test:rules`: **ALL RLS TESTS PASSED**.
- `npm run lint:types`, full ESLint and production build pass. ESLint **0 errors / 210 warnings**, unchanged.
- Final focused run: **14/14 pass** (11 new action tests plus three capability guards). Six cases render the actual components and assert native disabled state, a visible referenced reason and refusal of `.click()`. Other cases exercise all pricing-tier buttons, audit navigation, the live status, period selection and closing navigation.
- Final Chromium: **4/4 pass**, phone 390px and desktop 1280px in light/dark. The real components are mounted in an isolated probe host; tests exercise disabled focus refusal, visible descriptions, noninteractive status, keyboard Enter on navigation/selection, one selected period, and requested navigation state. Six control-and-reason screenshots per project plus overall captures; phone control montage inspected. These are component-host browser checks, not authenticated financial journeys.
- The first browser assertion counted pressed buttons from every mounted screen. It was narrowed to the Fiscal Periods region without changing the expected one selected period. Type checking also caught fixture field/query-option mistakes; fixtures now use typed cent fields and an exact regex name. The final focused and browser rechecks ran after those fixture corrections. Application source stayed fixed through the coverage run and final browser check.

Current-instance logs: `/workspace/scratch/c127-{coverage,focused-final,types-final,lint-final,build,rls,browser-final}.log`; generated screenshots are ignored under `test-results/`. Before-state evidence is the pinned source audit and diff; a full set of pre-change browser screenshots was not captured. No visual baseline was edited; these changed controls are outside the default screens captured by the current visual-regression suite. Full Playwright, both GitHub timezone jobs, GitHub CI and merge are not claimed.

## Queue and release gate

**W1:** these navigation/control defects are repaired, but Connected/Verified/Browser statuses stay unchanged; the complete first-hour journey remains required. No W13 improvement is claimed from button repairs.

**C-128 is partial, not complete.** Capabilities 151/152 incorrectly said notes and custom-field screens were absent. Their actual components are unchanged since the earlier verified `2a788de3` batch; the prior component/browser evidence is reusable and the capability guards passed again. Both rows now name their screens and tests as Partial, retaining loaded-data and persistence-evidence limits. Bundle and unit inputs already exist in `InventoryItemDialog`; remaining work is form/persistence verification and accurate invoice-line status, not duplicate screens. In particular, the bundle help currently promises invoice-line expansion while capability 143 still records a reserved invoice-form handoff: verify and reconcile that in C-128.

The current workflow runs on pull requests and main pushes. A helper branch push alone does not trigger it. API PR creation previously returned Forbidden; native Git works. Open a PR to obtain full CI, and keep these local checks distinct from release readiness.
