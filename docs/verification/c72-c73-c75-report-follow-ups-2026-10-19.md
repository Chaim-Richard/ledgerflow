# Report filters and follow-ups — C-72 / C-73 / C-75

AI #2 (Codex), 19 October 2026. Branch `codex/c72-c73-c75-report-follow-ups`, initially from main `568f4788`, normally merged through `dae712e5` at `fca0e316`. This batch completes C-73/C-75 and advances C-72; it does not close C-72's original purchase-order/return-credit navigation handoff.

## User behavior

- **Vendor scorecard:** find a vendor by its original mixed-language name; CSV follows the visible vendor subset. Review source bills expands loaded, dated bills for that exact vendor/workspace/range, including bills without item quantities. Each bill opens its exact existing `RecordRef`, never a guessed row index. Reversed/invalid date ranges withhold rows and CSV. Undated bills are omitted. This list explains loaded source documents, not an exact contribution reconciliation for every metric. Original PO/credit links remain pending because `RecordRef` has neither type.
- **Delivery notes:** search document/customer text and select all sources, orders/deliveries or invoices. The filtered source controls the existing preview, print and CSV. An empty match has no document and disables both output actions, preventing an unrelated first-row fallback. User/workspace changes reset scratch filters and manual numbering. Existing numbering, builder and EN/HE print logic are retained; no issuance or sequence reservation is added.
- **Customer quotes:** filter existing acceptance-state results; CSV follows the same subset. Open/expired quotes have read-only text for manual selection/copy. Expired text requests an updated quote before acceptance and contains no acceptance link. Nothing sends, saves, changes acceptance state or records that a follow-up occurred. Existing proposal/recurring-estimate calculations are unchanged. Book/user changes reset the screen's draft state.

Reused `ReportTableScroll`, `formatCurrency`, `downloadCsv` and `useUIStore.openRecord`; no new overlay, route, provider, dependency or generic record editor. English controls coexist with original Hebrew record text. Readable phone tables remain inside their existing horizontal scroll region; new output/source controls have 44px targets. UI_GUIDE §2 Words/Layout/Phone/Dark mode/Accessibility and §4 before/after review applied. No registered new view, financial helper, server, model, schema, migration, warning cap, quality budget or visual baseline changed.

## Validation and exact scope

- Existing pinned dependencies refreshed with `npm ci` on `568f4788` before work.
- Full real-Postgres `test:cov`: **3,345/3,345 passed**, **731 suites**, **0 failures/skips**; **80.82% lines / 79.01% branches / 82.19% functions**, all thresholds unchanged. This complete run used the original base plus feature work before the final memo-only correction and main merge; it is not a complete-suite result on merged `fca0e316`.
- Initial full lint caught React Compiler's preserve-manual-memoization error. Memoizing the filtered delivery-source list with `[sources, sourceType, search]` preserves the existing document memo; no rule disabled or money expectation changed. Final full ESLint: **0 errors / 210 warnings**, unchanged cap. Final merged type check and production build pass.
- Real database RLS: **ALL RLS TESTS PASSED** with migrated `lf_codex_taxhelp`.
- Final merged component/parser/guard regression: **40/40 passed**. Additional final docs/workspace-reset regression: **12/12 passed**, including a new cross-book scratch-number/filter reset case; overlapping cases are not counted twice as a new full suite. Cases cover exact bill ID and exclusions for other vendors/workspaces/dates/undated bills, invalid dates, mixed Hebrew filtering, empty-match output refusal, quote expiry/state and unchanged estimate records.
- Final actual-component Chromium: **16/16 passed** after the main merge: these three reports plus the merged US-address editor, at 390px/1280px in light/dark. A final bounded vendor-description layout adjustment was followed by **4/4 fresh vendor browser cases**. Keyboard disclosure/link activation, exact bill hash, minimum button height and contained geometry are exercised. Existing report registry entries remain intact.
- The browser fixture uses isolated cached synthetic data in real report components inside the app. It keeps the active guest workspace to avoid demo reseeding. It does not prove authenticated historical reads, server persistence, delivery issuance, sent follow-ups or the complete W3/W6 journey. The first vendor fixture attempt changed workspace and triggered normal guest reseeding; it was corrected without changing application seed code. Before-vendor images contain seeded demo suppliers and serve as layout references, not identical-data numeric comparisons.

No full-suite rerun was needed for the final memo/layout-only correction or merged delta after the completed full coverage run; relevant component/browser, full lint/type/build and guard checks were rerun. Main's financial changes remain with their owning agents. W3/W6 keep their existing release statuses; these local controls do not upgrade workflow readiness.

## Screenshots

All **24 before/after images** were inspected, including a contact sheet and phone detail views. The files below are committed review artifacts, not visual-test baseline replacements. Temporary original-source copies used for before captures were removed.

| Screen | Before, phone dark | After, phone dark |
|---|---|---|
| Vendor | [before](images/c72-c73-c75/before-vendor-390-dark.png) | [after](images/c72-c73-c75/after-vendor-390-dark.png) |
| Delivery | [before](images/c72-c73-c75/before-delivery-390-dark.png) | [after](images/c72-c73-c75/after-delivery-390-dark.png) |
| Quotes | [before](images/c72-c73-c75/before-quote-390-dark.png) | [after](images/c72-c73-c75/after-quote-390-dark.png) |

[All phone/desktop light/dark images](images/c72-c73-c75).

## GitHub handoff

Previous C-126 (`a56891f2`) and C-116/C-119/C-123 (`fd09e1b4`) branches are confirmed ancestors of `dae712e5`; their PR work is merged. This batch uses a normal branch and normal merge, never force-pushes or writes main.

PR creation was attempted with a concrete body through `gh pr create` and failed before GitHub: HTTPS CONNECT to `api.github.com` returns proxy **403 Forbidden**. The supported elevated retry failed the same way. This is a confirmed destination-policy block, not proof of a bad GitHub credential. A configuration draft adding only `api.github.com` was saved, retaining the existing package-manager preset; it requires review/save/publish in environment settings and has not changed runtime access. GitHub API authorization remains unverified. No credentials requested, extracted or bypassed. The review link is in `docs/FOR_YOU.md`; CI and this branch's merge remain pending.
