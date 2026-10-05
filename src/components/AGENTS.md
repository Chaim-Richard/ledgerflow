# Screens and interaction contracts

Read root AGENTS.md, docs/COORDINATION.md and docs/DEVELOPER_WORKFLOWS.md. Respect reserved screens; use sibling components and existing APIs for assigned work.

- Request lazy collections before rendering their data through useLedgerCollections. Capped lists are not complete history. Detail editing must load the selected record if its list is absent or truncated.
- Related-record fields need an Edit details action using RelatedRecordEditButton and the record-details drawer. Keep the parent form mounted, preserve the draft/selected line, and return focus on close. Existing labeled customer/vendor/item/project controls also support Ctrl/Command + Alt + E. Prefer explicit data-record-kind/data-record-id or an explicit typed target for new/custom selectors.
- Expand drawer support through typed field allowlists and existing financial services. Never use a generic JSON editor for amounts, balances, rates, posting status or inventory quantity. Do not announce success from a void-return helper that catches errors.
- Pending actions refuse duplicate activation and retain their draft on errors. Clear sensitive selection/drafts immediately when the user/workspace changes; obsolete asynchronous responses must not populate the new workspace.
- New overlays use useDialog: named title, initial focus, trapped Tab, top-dialog Escape and restored focus. Nested drawers must not close the underlying invoice/bill dialog. Native buttons and labels must remain keyboard accessible. Role-disabled actions must refuse keyboard and pointer activation.
- Keep phone targets at least 44px and avoid document-level horizontal overflow. Virtualized row height must accommodate its targets; header/row order and widths must match. Preserve narrow-screen layout when remembering desktop preferences.
- Use existing registered navigation/record helpers. Use the existing global Header pin control and PinnedPagesBar and Alt+P/Alt+1–9 navigation. Main currently persists device-local page/subview references; date/filter capture and workspace isolation need the owning lane. Document new shortcuts in screenShortcuts.ts; navigation keys must not interrupt typing or an open dialog.
- Analytical screens need readable method/input/units/assumption/result help. Number inputs allow typing as well as sliders, with validation on Enter/blur and no keystroke clamping. Incomplete-data and model limitations must be visible.

Verify behavior at its meaningful boundary: pure transformations with hand-number tests, forms with component tests, geometry/focus/nested dialogs/navigation with Chromium. Mocked success does not prove an operational provider integration.
