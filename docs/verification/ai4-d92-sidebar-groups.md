# AI #4 — D-92 sidebar groups and names

Base main 3ca3ec2f. Previous #192/#194 are merged; #194 CI passed. AI #1 fixed #192's remaining summary accessible-name failure in 3059fdb6, verified by six dashboard/settings browser checks.

Main navigation now has Daily work, Sales and purchases, Reports and settings sections. Existing English/Hebrew page labels, registry IDs, callbacks, pro-mode/admin filtering and bookmark behavior remain. Future registry groups appear in the last section rather than disappearing. Each navigation button has a 44px target, named tooltip and current-page marker; icons are decorative. “Search pages” replaces “Command Bar” and its “Global Coordinate Search” tooltip, using the existing command-palette action. The previous D-82 Projects/Account totals/Book summary labels and truthful amount explanations stay unchanged. No financial aggregation or posting change.

W1 navigation evidence only; complete onboarding remains Partly. Reserved invoice/bill/banking screens are untouched.

Four Chromium phone/desktop × light/dark cases check all seven destinations in their sections, 44px geometry, current-page state, preserved sales route by Enter, one command palette with focused search and Escape, collapsed desktop icon names/tooltips/report navigation, absence of page overflow, balance-box caption and serious/critical axe findings in navigation. Full CI and Linux visual review pending. Before sidebar is visible in the main-branch dashboard reference images; after menu screenshots attach to the new browser spec.
