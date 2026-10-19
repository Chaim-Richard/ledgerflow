# AI #4 — D-85 / D-90 dashboard and Settings

Base: main dae712e5 (PR #189 merged). This batch changes presentation and navigation only.

Dashboard: compact header, four fixed summary links and the real Tasks page before setup, saved views and detailed widgets. Cash/profit use the existing dashboardComparison output; unpaid balances use existing partyStats with the same document cutoff as dashboardAging. No financial helper or posting change. The summary refuses to show figures for invalid dates, failed/capped collections or pending required collections. Loaded/demo scope, selected dates and current-unpaid versus historical-payment limitations remain visible. Custom widget layouts, refreshes, role presets and drill-through remain.

Settings: five named groups, all 31 registered tabs exactly once, search over English/Hebrew labels, group names and IDs. Search and clearing search never change activeSettingsTab or key the active content, preserving its mounted draft. Existing component registry, routes and persistence handlers remain. No reserved child settings/forms changed.

Release gate: W1 navigation evidence only; W1 and W5 remain incomplete. This is not evidence for a complete onboarding or labels workflow. D-86/D-87 are skipped because their forms are reserved to AI #1.

Validation: type check and focused ESLint passed (zero errors/warnings in changed files). Browser checks cover 390/1280 × light/dark, first-screen geometry with the setup checklist still present, all five 44px links within 850px height, seed cash/profit $3,000, unpaid invoice $500 − $150 = $350, bill $240 − $40 = $200, excluding future/draft invoices, incomplete-cache refusal, invalid dates, real Tasks navigation, all 31 settings buttons, keyboard activation, search/no matches/clear and mounted-content identity. Existing dashboard layout/date/drill-through checks also run. Final results and CI evidence will be appended after completion.

Before/after captures: images/d85/{before,after}-{dashboard,settings}-{390,1280}-{light,dark}.png. Linux references must be inspected before accepting; full 40-image verification and full PR CI pending.
