# AI #4 — D-81 / D-82 plain report and settings controls

Base main 9383603b. One shared casing rule on the Reports/Settings shells removes forced uppercase from buttons, headings and their descendants, including lazy children. Authored acronyms, stored record names, report IDs, handlers and calculated numbers retain their original text/value. Tiny non-heading section labels may remain uppercase as UI_GUIDE permits. This controls rendering; it does not rewrite customer-supplied text or abbreviations.

Plain replacements:

| Before | After |
|---|---|
| Precision Core v2.0 | Workspace settings |
| Institutional rule bridges / enterprise-grade security protocols | Manage your workspace, appearance, backups and integrations |
| Documentation Protocol | About settings |
| Topological registries / SETTINGS_COMPONENTS implementation paragraph | Choose a tab to review or update the settings for your workspace |
| Assembling Financial Matrix… | Loading report… |
| Worlds | Projects / Account totals / Book summary, according to the existing data source |

The sidebar originally shows project budgets (or spending), otherwise sums absolute account balances by type. Its description now says that explicitly; it does not label those sums as net balances. Aggregation, selection and fallback functions are unchanged. Financial Intelligence Hub was removed in merged D-77 #173; no duplicate patch.

[Before/after](images/d81): P&L, balance sheet and settings, 390/1280 × light/dark. Four new browser cases check actual styles of nested button/heading labels across all three screens and plain settings/sidebar copy; an inserted lazy child checks that its own uppercase utility cannot defeat the policy. Existing dashboard drill-through and tax-profile keyboard-save checks are retained. The latter now selects the intended success status by its expected text, avoiding ambiguity with the separate registration status; refusal/draft preservation, exact success text, form close and focus assertions remain.

The three earlier PRs were confirmed merged. Their old PR CI failures were browser-only; newer main CI [39241788161](https://github.com/shmuelbiller1/ledgerflow/actions/runs/39241788161) is green. Do not call those old PR runs green. W1/W5 remain incomplete at whole-journey level. Focused checks and visual capture pending.

Focused verification: **7/7 Chromium cases pass (57.5s)**, types pass, focused ESLint zero errors/warnings. Existing dashboard drill-through works at both widths, and the tax-profile refusal → preserved Hebrew draft → keyboard save → restored focus journey passes. No financial test inputs or expected figures changed. Reference capture pending.
