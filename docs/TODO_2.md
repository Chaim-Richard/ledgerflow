# List 2: from "it works" to a finished product

Started 13 Oct 2026 (owner: "a second list, UI fixes and so on, so the AIs never run out; first the
bigger things, then the smaller"). List 1 is `docs/TRACKER.md` (features). This list is about making
what exists complete, consistent and pleasant. The lead moves items from here into the AIs' queues
(`docs/COORDINATION.md`), biggest tier first. Triaged public ideas land here too.

IDs: `P2-<n>`. Tier 1 before tier 2 before tier 3, unless an item blocks real users.

## Tier 1 — big: whole journeys that must work end to end

- [ ] P2-1 First hour: sign up → company details → chart of accounts → connect or import a bank → first invoice → first report, with no dead ends; an e2e test that walks it.
- [ ] P2-2 Month-end close journey in one place: reconcile every bank, review uncategorised, accruals, close the month, the pack of reports — a checklist screen that links each step.
- [ ] P2-3 Israeli business month: invoice with allocation number → VAT report → PCN874 file → close (screens exist piecemeal; make it one path).
- [ ] P2-4 US business quarter: sales tax per state → return screen → 1099 year-end → close.
- [ ] P2-5 Payroll journey: employee → pay run → payslips → posting → tax forms, with "not for filing" until the accountant check.
- [ ] P2-6 Migration journey: QuickBooks/Xero/CSV import → the source-vs-LedgerFlow totals proof (AU-4) → "you are ready".
- [ ] P2-7 Accountant journey: invite an accountant → they see a queue of what needs them (questions, approvals, adjustments) → they sign off a period.
- [ ] P2-8 Report picker (D-44) and one consistent report frame: header (entity, period, basis), filters, export, drill-down — the same on every report.
- [ ] P2-9 Navigation map: group ~160 screens into clear sections; nothing reachable only by search; dead screens removed.
- [ ] P2-10 Remove every demo/fake screen or label it clearly (API Hub demo, "Precision Core", telemetry simulators) — FOR_YOU item 11.
- [ ] P2-11 Plain words everywhere: one pass over every screen for invented jargon ("synthesis", "protocol", "topology", "velocity"), with a glossary and a lint rule listing banned words.
- [ ] P2-12 Hebrew right-to-left: every screen checked in Hebrew documents mode; numbers and dates never reversed.
- [ ] P2-13 Phone: the ten main screens fully usable at 390px (invoice, bill, bank, reports, dashboard).
- [ ] P2-14 Access and plans screen for the owner (ACC-1) and an honest billing page (ACC-2).
- [ ] P2-15 Error and empty states: every screen says what to do when there is nothing yet or something failed.

## Tier 2 — medium: consistency across screens

- [ ] P2-20 One button style (primary/secondary/danger) everywhere; remove one-off colours.
- [ ] P2-21 One table component for lists (sort, filter, column chooser, sticky header, CSV) used by every list.
- [ ] P2-22 One date-range control on every report (the September 2026 control), no free-text dates.
- [ ] P2-23 One money input (cents-safe, currency-aware, paste-friendly) on every form.
- [ ] P2-24 Forms: the same layout, labels above fields, errors under the field, Save at the same place.
- [ ] P2-25 Dark mode: every input readable (D-45), every chart colour checked.
- [ ] P2-26 Loading: skeletons on lists and reports instead of spinners.
- [ ] P2-27 Toasts: one style; errors stay until dismissed; success disappears.
- [ ] P2-28 Confirm dialogs only for destructive actions; undo for the rest.
- [ ] P2-29 Keyboard: every screen usable without a mouse; visible focus.
- [ ] P2-30 Settings: 30 tabs grouped into five sections with search.
- [ ] P2-31 Dashboard: fewer, useful widgets by default (cash, owed to you, you owe, profit this month, tasks).
- [ ] P2-32 Printed documents: one template system for invoice, bill, statement, delivery note, payslip.
- [ ] P2-33 Emails: one template style for every email the app sends, EN/HE.
- [ ] P2-34 Banners: at most one at a time on phones (D-46).
- [ ] P2-36 Product journey from purchase to final use (issue #132): where an item came from, its full cost, where it was stored and which project/customer received its cost — on the existing stock moves, no second ledger.
- [ ] P2-35 Screen help: every screen has a "?" with three lines of plain help.

## Tier 3 — small polish (good first tasks; batch them 10 at a time)

- [ ] P2-50 Page titles in the browser tab match the screen.
- [ ] P2-51 Every icon-only button has a tooltip and an accessible name.
- [ ] P2-52 Numbers right-aligned in every table column of money.
- [ ] P2-53 Negative money shown the same way everywhere (user setting: minus or brackets).
- [ ] P2-54 Long names truncate with a tooltip instead of breaking the layout.
- [ ] P2-55 Remember the last filter per report per user.
- [ ] P2-56 Search box focus with "/" on list screens.
- [ ] P2-57 Copy buttons on IDs and document numbers.
- [ ] P2-58 Relative dates ("3 days ago") have the exact date on hover.
- [ ] P2-59 Consistent capitalisation of buttons (sentence case).
- [ ] P2-60 No horizontal scroll on any phone screen.
- [ ] P2-61 Favicon and app icon for installed (PWA) use.
- [ ] P2-62 Empty search results suggest clearing filters.
- [ ] P2-63 Unsaved-changes warning on every form.
- [ ] P2-64 Spellcheck pass on all English strings.
- [ ] P2-65 Hebrew strings reviewed by a native speaker (owner) — list exported for review.

## How items get here

The lead adds: anything seen in screenshots, issues labelled `idea`, owner remarks, and the audit
reports' checked findings. Each item says what "done" looks like in one line.
