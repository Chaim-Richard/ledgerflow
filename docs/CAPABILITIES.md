# What works today

One row per capability, with one label each (DA-05). The README, Help, onboarding and pricing take their claims from here: where they say more, they are wrong, not this table.

**Labels:** Available (a working screen, a saved result, and a test of that path) · Available with limits (works, with the limit said) · Partial (some of it works) · Internal, test or demo only · Planned · Needs an owner decision. A type, a route, an empty screen or an arithmetic-only test never makes something Available.

**Evidence:** code and tests; test names are in `src/tests/` unless they start with `e2e/`. `src/tests/capabilities-guard.test.ts` checks that every file named here exists and that every Available row names a test. Built from `docs/TOOL_REVIEW.md` (rows 1–70, reviewed 8 Oct) and the work since.

| # | Capability | Label | Evidence | Limit |
|---|---|---|---|---|
| 1 | Shared double-entry posting for financial documents | Available | `src/services/LedgerPostService.ts`, `src/services/ledgerPost/`; `golden-path-ledger.test.ts`, `integration-ledger.test.ts` | Use this path; a new direct write can break the guarantee |
| 2 | Server validation of balanced journal entries | Available | `src/server/routes/transactions/`; `validation-guard.test.ts`, `property-invariants.test.ts` | Validation is more than a UI success toast |
| 3 | Role-based write restrictions | Available | `src/server/auth/`, transaction routes; `server-write-roles.test.ts`, `rbac-invites.test.ts` | Requires correct policies for every added collection/route |
| 4 | Workspace-scoped database access | Available | `src/server/db/`, `supabase/migrations/`; `pg-firestore.test.ts`, RLS suite | Test cross-workspace records as well as queries |
| 5 | Period locks and close checks | Available | `periodCloseService.ts`, `periodRoutes.ts`; `period-close.test.ts` | New mutation paths must retain the lock guard |
| 6 | Reverse-and-correct workflows | Available | `src/server/routes/transactions/reverseRoutes.ts`; `reverse-and-correct.test.ts` | Reversals must remain idempotent |
| 7 | Opening balances | Available | `openingBalanceService.ts`, `src/lib/openingBalances.ts`; `opening-balances.test.ts` | Import acceptance must check signed account nature |
| 8 | FX-aware posting | Available with limits | `FxService.ts`, posting modules; `fx-posting.test.ts`, `fx-rounding.test.ts` | External rates/configuration and transaction date still matter |
| 9 | Currency-specific display precision | Available | `src/lib/utils.ts`; `currency-decimal.test.ts`, `formatDecimal.test.ts` | CSV currently has a separate two-decimal contract; finding F3 below |
| 10 | Shared postable filtering | Available | `src/lib/txFilters.ts`; `postable-adoption-guard.test.ts` | Legacy secondary endpoints need the same discipline |
| 11 | Full-history server statements | Available | `src/server/routes/reportRoutes.ts`; `report-routes.test.ts`, `truncation-guard.test.ts` | Server failure means a local fallback may be incomplete |
| 12 | P&L period columns | Available | `src/lib/reportColumns.ts`, `StatementColumns.tsx`; `report-columns.test.ts`, `e2e/report-columns.spec.ts` | Current selected range is clipped |
| 13 | Balance-sheet closing-period columns | Available | Same helper plus pure `computeBalanceSheet`; `report-columns.test.ts`, `e2e/report-columns.spec.ts` | Opening and earlier activity must be retained |
| 14 | Percentage of income/assets | Available | `statementFigures`, `percentageOfTotal`; `report-columns.test.ts` | Zero denominator is undefined and displayed as a dash |
| 15 | Comparative amount and percent variance | Available | `reportVariance`; `report-columns.test.ts`, `e2e/report-columns.spec.ts` | Zero previous amount has no valid growth percentage |
| 16 | Fiscal-year-aware quarter bounds | Available | `src/lib/fiscalCalendar.ts`, `reportColumns.ts`; `report-columns.test.ts` | Verify workspace calendar configuration |
| 17 | General ledger and account register | Available with limits | `computeReports.ts`, `AccountRegisterView.tsx`; `accountRegister.test.ts`, `account-register-view.test.tsx` | The account register drills into what the screen loaded; the statements explain from the full history (row 83). |
| 18 | Customer/vendor outstanding balances | Available | `src/lib/aging.ts`, `src/server/reports/partyReports.ts`; `aging.test.ts`, `contact-reports.test.tsx` | Needs correct as-of date and FX |
| 19 | A/R and A/P aging | Available | aging report views; `aging-views.test.tsx`, `e2e/accounting-lifecycle.spec.ts` | Business collection practice is not automated by the chart |
| 20 | Customer statements with credits | Available | `StatementView.tsx`, statement helper; `statement-view.test.tsx`, `statement-credits.test.ts` | Bulk statement delivery is a separate workflow |
| 21 | Customer/vendor combined contact reports | Available | `ContactBalanceSummaryView.tsx`; `contact-balance-summary.test.tsx` | Matching/reporting does not authorize automatic debt offset |
| 22 | Item/reference-based report views | Available with limits | `src/server/reports/itemReports.ts`, `referenceReport.ts` and registered views | Inspect the route and fixture for the report actually used |
| 23 | Safe shared CSV export | Available | `src/lib/csvExport.ts`; `csv-export.test.ts` | F3: currency exponent must be checked for exports |
| 24 | Shareable report/list dates and filters | Available | `reportPermalink.ts`, `listPermalink.ts`; `list-permalink.test.ts`, report tests | URLs do not grant workspace access |
| 25 | Page/report date synchronization | Available | `usePageSyncedState.ts`; `report-date-sync.test.tsx` | New report components must use the synchronization contract |
| 26 | Estimates and conversion | Available | Estimates view and entity operations; `estimate-conversion.test.ts`, `estimates-view.test.tsx` | Confirm desired status and ledger timing |
| 27 | Invoice item/SKU resolution | Available | `src/lib/invoiceLines.ts`; `invoice-lines.test.ts` | Free text remains an unlinked line |
| 28 | Payments and allocations | Available | `paymentService.ts`, receive-payment modal; `allocation.test.ts`, `receive-payment-modal.test.tsx` | Repeated or over-allocated requests need server refusal |
| 29 | Atomic payment persistence | Available | `paymentService.ts`; `payment-atomicity.test.ts` | Test real transaction adapter behavior too |
| 30 | Credit notes/vendor credits | Available with limits | credit posting/service modules; `credits.test.ts`, party-action tests | Not every refund/payment-run integration is established |
| 31 | Customer deposits | Available | `depositService.ts`; `deposits.test.ts`, `invoice-deposit.test.ts` | Requires the correct liability account |
| 32 | Bad-debt write-off and reversal | Available with limits | `badDebtService.ts`, write-off modal; `period-close.test.ts`, `write-off-modal.test.tsx` | Accounting policy/jurisdiction acceptance remains necessary |
| 33 | Purchase orders | Available with limits | PurchaseOrders view and conversion helpers; `purchase-orders.test.ts` | Requisition/approval/three-way matching depth is separate |
| 34 | Recurring jobs | Available with limits | `recurringService.ts`, cron routes; `recurring-job.test.ts` | Deployment scheduler/auth and retries need operational checks |
| 35 | Document PDF generation | Available with limits | `pdfService.ts`, document routes; `pdf-generation.test.ts`, `document-pdf-route.test.ts` | Branding and script/font layout need representative outputs |
| 36 | Invoice public page/payment entry | Available with limits | public-invoice routes/page; `public-invoice-page.test.tsx`, Hebrew companion | Token rules are not a complete customer portal |
| 37 | Mail/reminder service paths | Available with limits | `documentEmailService.ts`, `reminderService.ts`; `emails.test.ts`, `reminders-job.test.ts` | Operational mail requires configured credentials/provider |
| 38 | Invoice-linked COGS stock movement | Available | `cogsStockService.ts`, `src/services/invoiceCogs.ts`; `invoice-cogs.test.ts`, `stock-moves.test.tsx` | Missing items and negative stock have warning paths |
| 39 | Stock adjustments and counts | Available | `stockAdjustmentService.ts`, inventory dialogs; `stock-adjustments.test.ts`, `stock-dialogs.test.tsx` | Do not claim serial/lot/location tracking from this alone |
| 40 | Direct stock-quantity protection | Available | quantity-protection migration; RLS tests | All future endpoints must retain it |
| 41 | Stock reversal once | Available | `prepareStockMoves`; `invoice-cogs.test.ts`, `stock-adjustments.test.ts` | Cross-workspace and repeated targets must be tested |
| 42 | Fixed-asset/depreciation workflow | Available with limits | `depreciationService.ts`, asset views; `period-close.test.ts` | Specific methods and statutory handling require acceptance |
| 43 | Tax codes with parts/compounding | Available | `src/lib/taxCodes.ts`, `documentMath.ts`; `tax-codes.test.ts`, `document-math-tax.test.ts` | Confirm actual tax jurisdiction definitions |
| 44 | Inclusive/exclusive tax treatment | Available | same helpers; `document-math-tax.test.ts`, `tax-codes.test.ts` | Legacy input migration is separate from arithmetic |
| 45 | Tax returns and reverse-charge boxes | Available with limits | `taxReturnService.ts`; `tax-return.test.ts`, `tax-return-view.test.tsx` | Does not prove direct authority submission or every locale |
| 46 | Bank statement formats/import | Available with limits | format/import helpers, bank screens; `ofx.test.ts`, `integrations-formats.test.ts` | Verify source dates, currency and duplicate fingerprints |
| 47 | Record spreadsheet import previews | Available | `src/lib/recordImport.ts`, `recordImportService.ts`; `record-import.test.ts` | Limits and transaction failure behavior matter |
| 48 | Hebrew spreadsheet headings | Available | `HEBREW_HEADERS` in `recordImport.ts`; `hebrew-data.test.ts` | Not proof of every possible header synonym |
| 49 | Global optimal match suggestions | Available | `algorithmInternals/optimization.ts`; `global-match.test.ts` | Suggestion still requires durable reconciliation action |
| 50 | Reconciliation service/history | Available | reconcile routes and screen; `reconcile-endpoint.test.ts`, browser banking tests | Test unusual statement/reversal combinations |
| 51 | Persisted auto-rules | Available | `src/hooks/useAutoRules.ts`; `rules-saving.test.ts` | In-memory rule mutation alone is not enough |
| 52 | Natural-language entry/query tools | Available with limits | `algorithms/nl-parser.ts`, command palette; `algorithms.test.ts`, Hebrew data tests | Parsing requires preview/validation; not unlimited understanding |
| 53 | Cross-dimension classification | Available with limits | `cross-dimension-inference.ts`, dimension resolver; `deep-labeling.test.ts`, `dimension-identity.test.ts` | Preserve original identifiers and nested structure |
| 54 | Mixed-script merchant matching | Available | similarity/merchant-identity modules, `src/lib/learnedPatterns.ts`; `hebrew-data.test.ts`, `learned-patterns.test.ts` | Learned patterns saved before 8 Oct that had collided keep their last value (N-14 fixed the cause). |
| 55 | Query engine/directives | Available | `TransactionQueryEngine.ts`; `query-engine-matrix.test.ts` | UI interpretation summaries may have older ASCII patterns |
| 56 | Saved views | Available with limits | saved-view store/bar; transaction-templates.test.ts | Workspace sharing/permissions need explicit behavior |
| 57 | Command palette across entities | Available with limits | `CommandPalette.tsx`; registry and browser navigation evidence | Loaded data search is not a full server search index |
| 58 | Record links | Available | `src/lib/recordLinks.ts`, `useRecordFocus.ts`; `data-checks.test.ts` | A plain tab navigation is not equivalent |
| 59 | Data-health checks | Available | `src/lib/dataChecks.ts`, DataHealth view; `data-checks.test.ts`, forensic tests | Findings do not authorize silent financial repair |
| 60 | Audit log UI/formatting | Available | audit viewer and audit service; `audit-log-viewer.test.tsx`, `audit-format.test.ts` | Audit presence alone is not external certification |
| 61 | Anomaly/duplicate analytical tools | Available with limits | algorithm registry, anomaly/duplicate modules; `algorithms.test.ts`, `forensic-checks.test.ts` | Scores are not proof of error or fraud |
| 62 | Cash runway/liquidity stress tools | Available with limits | `cash-runway.ts`, `liquidity-stress.ts`; algorithm tests | Depends on assumptions and data completeness |
| 63 | Monte Carlo forecast | Available with limits | `monte-carlo.ts`; algorithm tests | Model/seed/history quality matter; no guaranteed prediction |
| 64 | Budget/actual and profitability tools | Available with limits | `budget-vs-actual.ts`, `profitability-heatmap.ts` | Budget versions/phasing and full ledger coverage need review |
| 65 | Pure algorithm sandbox/registry | Internal, test or demo only | `src/lib/algorithms/types.ts`, `index.ts`, ToolSandbox | Registration is not proof that a formula is correct |
| 66 | Lazy workspace collections | Available | `ledgerCollections.ts`, `useLedgerCollections.ts`; `ledger-collections-guard.test.ts` | Callers must request what they read and handle truncation |
| 67 | Native dialog/keyboard behavior | Available | `useDialog.ts`, native buttons; `use-dialog.test.tsx`, role/browser tests | Every new overlay/control still needs verification |
| 68 | Disabled-role action capture | Available | `RequireRole.tsx`; `e2e/role-controls.spec.ts` | Server authorization remains the final boundary |
| 69 | Quality, money and accessibility guards | Available | `quality-ratchet.test.ts`, `money-format-guard.test.ts`, `ledger-collections-guard.test.ts` | Some guards are static heuristics, not full proofs |
| 70 | Backup/restore/retention service paths | Available | restore/retention/purge services; `backup-restore.test.ts`, `workspace-restore.test.ts`, `retention.test.ts` | A backup is useful only after a tested restore and access review |
| 71 | Main path tested end to end on the real database | Available | `src/tests/main-path.test.ts`, `src/tests/main-path-labels.test.ts`, `src/tests/main-path-group.test.ts` | Single business, with labels, and across a group of books (two companies, a loan between them, in one and in two currencies) |
| 72 | Explain this number (P&L, balance sheet, trial balance, budget vs actual, aging) | Available | `src/server/reports/explain.ts`, `DrillDownModal.tsx`; `explain-number.test.ts`, `explain-number-ui.test.tsx`, `aging-views.test.tsx` | Dashboard, project/label totals, reconciliation and consolidation figures are not explained yet |
| 73 | One rule for opening balances | Available | `src/lib/accountUtils.ts` (`openingDebitCents`); `explain-number.test.ts`, `close-package.test.ts` | Entered in the account's own direction; anyone who typed a credit opening as negative must correct it once |
| 74 | Stock history (every change to stock with its reason) | Available with limits | `stockMoveService.ts`, `src/lib/stockMoves.ts`; `stock-moves.test.tsx`, `stock-moves-missing.test.ts` | Needs the stockMoves database change in production (FOR_YOU 30); until then stock works but no history is kept |
| 75 | Stock per location and moving stock between locations | Available with limits | `stockTransferService.ts`; `stock-locations.test.tsx` | Needs the stock history (above); no bins or serial numbers |
| 76 | Sales returns put goods back at their cost | Available | `src/lib/salesReturns.ts`, `cogsStockService.ts`; `sales-returns.test.tsx` | In delivery mode, goods come back by undoing the delivery |
| 77 | Sales orders invoiced by quantity | Available | `src/lib/salesOrders.ts`, `OrderInvoiceDialog.tsx`; `order-items.test.tsx` | A percent or amount part of an item order is a deposit, not goods |
| 78 | Deliveries ship the goods (owner's choice) | Available with limits | `deliveryService.ts`, `src/lib/deliveries.ts`, `OrderDeliveryDialog.tsx`; `deliveries.test.tsx` | Deliveries come from an order (not from a stand-alone invoice); the money owed back for returned goods is a separate credit note |
| 79 | Selling below zero: warn or refuse | Available | `stockPolicyService.ts`; `stock-policy.test.tsx` | Owner setting |
| 80 | Required labels (warn, list, or refuse) | Available | `src/lib/requiredLabels.ts`; `required-labels.test.tsx`, `required-labels-refuse.test.tsx` | By account only; document type, contact and item conditions are later |
| 81 | Labels on invoice and bill lines | Available | `LineLabels.tsx`, `TransactionTemplates.ts`; `line-labels.test.tsx` |  |
| 82 | Modules: hide screens a business does not use | Available | `src/lib/modules.ts`, `moduleService.ts`; `modules.test.tsx` | Twelve modules whose screens are whole menu entries (Stock, Projects and Budgets among them since 10 Oct); fields inside other screens are not hidden yet |
| 83 | Workspace switcher (type to find, recent first, ⌘K) | Available | `src/lib/workspaceSwitcher.ts`, `WorkspaceSwitcher.tsx`; `workspace-switcher.test.tsx` | Recent order is kept per browser |
| 84 | Groups of books | Available with limits | `workspaceGroupService.ts`, `GroupsSettings.tsx`; `workspace-groups.test.tsx` | Your own groups, shareable by email (read-only for the others); needs the workspaceGroups database change in production (FOR_YOU 30) |
| 85 | Group summary, in one currency, with dealings between the companies, a parent and the share it owns | Available with limits | `src/server/reports/groupReport.ts`, `GroupSummaryReportView.tsx`; `group-summary.test.tsx` | Section totals, and account by account matched by code or name (no mapping for charts that differ in both); balances and sales between the companies and the parent's investment are taken out (goodwill not shown separately); companies owned 50% or less can't be in a group with a parent; rates are typed or filled from the rate service, and kept per period |
| 86 | Workpapers on month-end close | Available | `WorkpapersPanel.tsx`; `workpapers.test.ts`, `workpapers-ui.test.tsx` |  |
| 87 | Pay runs posted by the server, with approval | Available with limits | `payRunService.ts`; `pay-run-posting.test.ts` | Finding F10 is resolved by this; approval enforced by the database needs FOR_YOU 25 |
| 88 | Two-step login, and owners can require it | Available with limits | `src/server/auth/supabaseAuth.ts`; `require-two-step.test.ts` | The database-side rule needs FOR_YOU 25 |
| 89 | Petty cash | Available | `PettyCash` screen; `petty-cash.test.ts`, `petty-cash-view.test.tsx` |  |
| 90 | Loans with a repayment schedule | Available | loan screens; `loans.test.ts`, `loans-view.test.tsx` |  |
| 91 | Live payroll calculation by country | Internal, test or demo only | payroll engine | Calculation only; not tax advice or filing |
| 92 | Bank feeds (Plaid) | Available with limits | `plaidRouter`; `plaid.test.ts` | Needs Plaid credentials and a live check per bank |
| 93 | Online card payments (Stripe) | Available with limits | Stripe routes; `online-payments.test.ts`, `payment-failures.test.ts` | Needs Stripe credentials; tested with recorded events |
| 94 | Consolidation elimination endpoint | Partial | `consolidationRoutes.ts` | Returns 'not available'; use the group summary instead |
| 95 | Help for the main path, step by step | Available | `src/lib/mainPathGuide.ts`, `MainPathGuide.tsx`; `main-path-guide.test.tsx` | Twelve steps of a single business; groups of books are not covered yet |
| 96 | Ask the books (a question in words, the figure from the server) | Available with limits | `src/lib/askBooks.ts`, `AskBooksView.tsx`; `ask-books.test.tsx` | Reads account names, label values and common periods only, not any sentence; what it understood is shown and can be changed |
| 97 | Needs attention (one queue on the Overview) | Available | `src/lib/needsAttention.ts`, `NeedsAttentionCard.tsx`; `needs-attention.test.tsx` | One workspace at a time; bills and expenses have no approval step to count |
| 98 | Disconnect a bank connection | Available with limits | `src/server/routes/plaidRoutes.ts`, `ConnectedBanks.tsx`; `plaid.test.ts`, `connected-banks.test.tsx` | Needs Plaid credentials; tested with a fake Plaid; imported bank lines stay |
| 99 | Split rules (cost allocation) suggested on bills | Available with limits | `src/lib/allocationRules.ts`, `AllocationRulesSettings.tsx`, `BillModal.tsx`; `allocation-rules.test.tsx` | On bills only; a rule never posts by itself |
| 100 | Inventory item details (movements by item for a period) | Available with limits | `src/lib/stockMoves.ts`, `InventoryDetailsReportView.tsx`; `inventory-details.test.tsx` | Needs the stockMoves database change in production (FOR_YOU 30) |
| 101 | Buying stock on a bill (item lines move stock and average cost) | Available with limits | `src/lib/billStock.ts`, `billPosting.ts`, `cogsStockService.ts`; `bill-stock.test.ts`, `bill-stock-ui.test.tsx` | One Inventory account for all items; freight and duties can be spread over the items (BA-03) |
| 102 | Group chart mapping (combine account lines across companies) | Available | `src/server/reports/groupAccounts.ts`, `workspaceGroupService.ts` `setLineMerges`, `GroupSummaryReportView.tsx`; `group-accounts.test.ts`, `group-summary.test.tsx` | The group's owner combines lines within a section; kept on the group |
| 103 | Goodwill on a group with a parent | Available with limits | `src/server/reports/groupReport.ts`, `GroupsSettings.tsx`; `group-summary.test.tsx` | Needs the day each company was bought; no impairment; companies owned 50% or less are not supported |
| 104 | Companies owned 20–50% in a group (equity method) | Available with limits | `src/lib/workspaceGroups.ts` `isAssociate`, `groupReport.ts`; `group-summary.test.tsx` | Needs its own investment account and the day bought; balances and sales with it are not taken out |
| 105 | Bank connection health and sync history | Available | `src/lib/bankFeedStatus.ts`, `plaidRoutes.ts`, `ConnectedBanks.tsx`; `plaid.test.ts`, `connected-banks.test.tsx` | Last 20 attempts per connection |
| 106 | Profit by label (each value of a label, adding back to the P&L) | Available | `src/server/reports/byLabel.ts`, `LabelProfitReportView.tsx`; `by-label.test.tsx` | Income and costs only; balance sheet by label not yet |
| 107 | Profit & Loss and balance sheet on cash basis | Available with limits | `src/server/reports/cashBasis.ts`, `ProfitAndLossView.tsx`; `cash-basis.test.ts`, `main-path.test.ts` | Totals only (no period columns or comparison); payments not yet applied shown apart |
| 108 | Price lists for customers | Available | `src/lib/priceLists.ts`, `PriceListsSettings.tsx`; `price-lists.test.tsx` | One currency (the workspace's); fills new lines only |
| 109 | Goods not yet billed (delivered not invoiced, received not billed, billed not received) | Available | `src/lib/unbilledGoods.ts`, `GoodsNotBilledReportView.tsx`; `unbilled-goods.test.tsx` | Billed not received counts bills made from an order since 10 Oct |
| 110 | Stock aging (on hand by age, last sale) | Available with limits | `src/lib/stockMoves.ts` `stockAging`, `StockAgingReportView.tsx`; `stock-aging.test.tsx` | Needs the stockMoves database change in production (FOR_YOU 30) |
| 111 | Fixed asset maintenance log and next service reminder | Available | `src/lib/assetMaintenance.ts`, `MaintenanceLog.tsx`; `asset-maintenance.test.tsx` | The cost is a note; the bill books it |
| 112 | Asset tags and printable QR labels | Available | `src/lib/assetTags.ts`, `AssetLabels.tsx`; `asset-tags.test.tsx` | QR code of the tag (not a 1D barcode) |
| 113 | Item-wise sales and purchase registers | Available | `src/lib/itemRegister.ts`, `ItemRegisterReportView.tsx`; `item-register.test.tsx` | Stock item lines only |
| 114 | Asset depreciation ledger | Available | `src/lib/depreciationLedger.ts`, `DepreciationLedgerReportView.tsx`; `depreciation-ledger.test.tsx` | Reads the loaded entries (the 10,000 cap applies) |
| 115 | Bank clearance summary | Available | `src/lib/bankClearance.ts`, `BankClearanceReportView.tsx`; `bank-clearance.test.tsx` | Reads the loaded entries |
| 116 | Service items (no stock) | Available | `src/lib/invoiceLines.ts`, `InventoryItemDialog.tsx`; `item-type.test.tsx` | Service lines are not in the item-wise reports |
| 117 | Purchase returns (stock sent back on a vendor credit) | Available | `src/lib/vendorReturns.ts`, `creditPosting.ts`, `cogsStockService.ts`; `vendor-returns.test.ts` | At the bill line's price; spread freight stays in stock |
| 118 | Sales reps and commission | Available | `src/lib/salesReps.ts`, `salesRepService.ts`, `SalesRepsSettings.tsx`, `CommissionReportView.tsx`; `sales-reps.test.tsx` | On what was paid, before tax; reads the loaded invoices and payments |
| 119 | Two-person rule (nobody approves their own) | Available | `src/lib/twoPersonRule.ts`, `invoiceApprovalGuard.ts`, `payRunService.ts`, `TwoPersonRulePanel.tsx`; `two-person-rule.test.tsx` | Invoices over the limit and pay runs; not purchase orders |
| 120 | Documents in the customer's language (English, Hebrew), with their own terms | Available | `src/lib/documentLanguage.ts`, `pdfService.ts`, `BrandingSettings.tsx`, `PartyModal.tsx`; `document-language.test.tsx` | Printed words only; typed text prints as typed |
| 121 | Per-role starting dashboards | Available | `src/lib/dashboardOverview.ts`, `roleDashboardService.ts`, `DashboardWidgets.tsx`; `role-dashboards.test.ts` | A person's own arrangement (this browser) wins |
| 122 | Money display per workspace (number style, bracketed negatives) | Available | `src/lib/moneyFormat.ts`, `MoneyDisplayPanel.tsx`; `money-display-panel.test.tsx` | Display only |
| 123 | Customers sign estimates online | Available | `src/lib/estimateSignature.ts`, `estimateSignService.ts`, `PublicEstimatePage.tsx`; `estimate-signature.test.tsx` | Typed name and "I accept"; not a qualified e-signature |
| 124 | Tasks given to people, about a record | Available | `src/lib/tasks.ts`, `taskService.ts`, `TasksView.tsx`; `tasks.test.tsx` | With @mentions (BG-01) and watching records (BG-04, told once a day) |
| 125 | Direct deposit (NACHA) file for a pay run | Available | `src/lib/nacha.ts`, `DirectDepositDialog.tsx`; `direct-deposit.test.tsx` | US ACH only; upload to the bank by hand |
| 126 | Links between entries | Available | `src/lib/entryLinks.ts`, `entryLinkService.ts`, `EntryLinks.tsx`; `entry-links.test.tsx` | Notes only; nothing posted |
| 127 | Time tracking, approval and billing | Available | `src/lib/timeEntries.ts`, `timeService.ts`, `TimeView.tsx`; `time-tracking.test.tsx` | With a timer (V-02) |
| 128 | Own stages for invoices and bills | Available | `src/lib/stages.ts`, `stageService.ts`, `StageChip.tsx`; `stages.test.tsx` | A team mark only; no posting |
