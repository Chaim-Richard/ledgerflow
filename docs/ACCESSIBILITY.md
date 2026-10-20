# Accessibility Statement · הצהרת נגישות

*Last reviewed: October 20, 2026*

## Target Conformance Standard
LedgerFlow targets **Web Content Accessibility Guidelines (WCAG) 2.1 Level AA** across both light and dark themes, desktop (`1280px`) and mobile (`390px` / `320px`) viewports, and English (`LTR`) as well as mixed English/Hebrew (`RTL`) content.

## Implemented & Automatically Tested Measures
1. **Automated WCAG Scanning (`@axe-core/playwright` 4.14):** Core navigation routes, report views, dialogs, settings tabs, warehouse operations, and end-to-end workflows (`W1`–`W12`) run automated `axe` checks with zero unbaselined serious or critical violations.
2. **Contrast & Typography (`>= 4.5:1`):** Theme tokens in `src/index.css` (`--text`, `--muted`, `--pos`, `--neg`, `--brass`) maintain at least `4.5:1` contrast against surfaces in both light and dark themes, with `tabular-nums` alignment on financial figures and signed text indicators (`+` / `−`, not colour alone).
3. **Keyboard-Complete Operation & Focus Management:**
   - All dialogs and drawers use `useDialog` (`role="dialog"`, `aria-modal="true"`, Escape-to-close, focus trapping, and focus restoration to the invoking trigger).
   - `InlineEdit` exposes accessible names containing the visible displayed value (`axe` `label-in-name`), commits with `Enter`, and cancels cleanly with `Escape`.
   - Global navigation supports `Cmd/Ctrl+K` (Command Palette), `?` (Keyboard Shortcuts sheet), `Alt+P` (Pin current screen), and `Alt+1..9` (Speed dials).
4. **Touch Targets & Reflow:** Interactive controls use `min-h-11` (`44px`) touch targets and responsive layouts checked against horizontal page overflow at `390px` and `320px`.
5. **Semantic Tables & Accessible Chart Fallbacks:** All data tables carry `<caption>` and header `scope="col"` / `scope="row"`, enforced by `src/tests/table-a11y-guard.test.ts`. Financial charts include keyboard legend toggles and accessible data-table switches.
6. **Motion & Print Readability:** Motion respects the operating system's `prefers-reduced-motion` preference (`MotionConfig reducedMotion="user"`), and `@media print` forces high-contrast dark ink on white paper even when dark mode is enabled on screen.
7. **Bidirectional Hebrew & English Isolation:** Mixed Hebrew/English party names, account names, and amounts use `<bdi>` isolation and `dir`-aware alignment so minus signs, brackets, and currency symbols stay attached to their numbers.

## Known Limitations & Workarounds
- **Complex graphical visualisations:** Multi-series SVG/canvas plots cannot convey every point solely through pointer hover; select the built-in **Table** view toggle beside charts for complete screen-reader access.
- **Third-party embedded frames:** External bank-connection widgets (such as Plaid Link) use their provider's own accessibility implementation; CSV, OFX, and QFX statement uploads are always available as a native keyboard-accessible alternative in **Banking → Import Statement**.
- **Tracked baseline exceptions:** Any legacy screen exceptions remaining during ongoing cleanup are explicitly bounded in `e2e/a11y-baseline.json` and `e2e/contrast-baseline.json` and may only ratchet downward.

## Reporting Accessibility Issues
Use **Help & Guide → Send feedback** or open **Support** in the sidebar and tag the ticket **UX** to report any keyboard, screen-reader, contrast, or mobile zoom barrier.
