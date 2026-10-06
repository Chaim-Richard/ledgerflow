/** Screen descriptions are part of the registry contract; no generic fallback hides missing help. */
export const SCREEN_HELP: Record<string, Record<string, string>> = {
  main: {
    dashboard:
      "Review the workspace overview for a chosen period. Arrange widgets, inspect balances and follow their report links. Forecast estimates and incomplete loaded history are labelled separately.",
    inbox:
      "Review imported activity needing attention. Inspect suggested categories or matches before accepting them. A suggestion does not establish that records are identical.",
    copilot:
      "Explore workspace data with the AI copilot. Review source records and proposed actions before using an answer. Generated advice is not a posted entry.",
    transactions:
      "Browse ledger transactions and their lines. Filter records, arrange columns and open the existing financial editor. Draft and void entries do not appear in posted reports.",
    "credit-notes":
      "Manage customer credits and vendor credits. Inspect allocations, remaining credit and refunds through the existing document workflow. Change amounts through the credit or refund workflow.",
    assets:
      "Maintain fixed-asset records and inspect depreciation history. Edit supported metadata or use the existing depreciation workflow. A preview does not post depreciation.",
    register:
      "Inspect activity for a selected account. Review individual entries and their account effects. Financial corrections use the original entry editor.",
    ledger:
      "Inspect journals, accounts and posted activity. Filter entries or open account detail and related reports. Account openings and period movement have different time scopes.",
    intercompany:
      "Explore activity between entities. Inspect source entries and the available elimination presentation. Viewing a consolidation does not itself post a journal.",
    recurring:
      "Manage recurring entry schedules. Inspect the next occurrence, pause a schedule or review generated documents. Generated drafts still require their normal workflow.",
    "query-builder":
      "Build a query over loaded workspace records. Add filters and inspect matching rows. Browser queries are limited to the history loaded for the workspace.",
    banking:
      "Manage existing bank connections and imported activity. Reconnect expired logins and inspect connection health. Provider setup determines which live services are available.",
    "audit-trail":
      "Review the recorded history of workspace actions. Find a record and inspect who changed it and when. An audit log is not an independent financial reconciliation.",
    "client-queries":
      "Questions the bookkeeper or accountant asked about entries, and the answers. Ask from an entry's edit window with \"Ask about this entry\"; answer, follow up or close the question here. Each side gets a notification; a question changes nothing in the books.",
    reconciliation:
      "Match bank activity with ledger entries. Review differences before accepting matches or completing reconciliation. Inspect the underlying documents when a match is uncertain.",
    "month-end-close":
      "Review the checks used to close a month. Inspect unresolved items and use the existing close workflow. Server permissions and period locks remain enforced.",
    "fiscal-periods":
      "Manage the fiscal calendar and period status. Inspect closed periods and the existing lock controls. Financial edits must respect the effective period lock.",
    sales:
      "Manage customers and sales invoices. Create or inspect an invoice, record settlement and edit related metadata in its side drawer. Approval, delivery and posting retain their existing document rules.",
    estimates:
      "Prepare estimates and quotes. Edit a draft or use the existing conversion workflow when accepted. An estimate is not posted sales revenue.",
    payments:
      "Review received and made payments. Inspect allocations and use the existing payment workflow for changes. Unapplied receipts are distinct from sales revenue.",
    purchases:
      "Manage suppliers and purchase bills. Inspect a bill, record payment and edit related metadata without leaving the form. Review taxes and totals before saving a bill.",
    "purchase-orders":
      "Prepare and track purchase orders. Inspect ordered items and use the existing receiving and bill workflows. A purchase order is not a posted bill.",
    loans:
      "Maintain loans the workspace owes: the lender, the principal, the rate, the term and the repayment schedule to the cent. Recording the money arriving or a payment posts one balanced entry through the ordinary posting path, so the period lock applies; a closed period refuses it. The screen never invents an account: it asks for the liability, interest and bank accounts it already has.",
    "petty-cash":
      "Run the petty cash box: one of the workspace's own cash-type accounts, with its balance read straight from the ledger. Spend from the box against an expense category, top it up from a bank account, or count the cash and post the difference to a chosen over/short account. Every movement is one balanced entry through the ordinary posting path, so the period lock applies; the screen never invents an account.",
    payroll:
      "Maintain employee information and inspect pay runs. Edit supported metadata and review the existing payroll workflow. A displayed calculation does not prove that a pay run was posted.",
    reports:
      "Choose a financial report and its dates. Compare periods, print or copy an exact report link. Each report explains its timing and loaded-history limits.",
    charts:
      "Explore financial series and their declared units. Switch to a table, hide a series or narrow the date range. Presentation controls do not change accounting calculations.",
    forecaster:
      "Explore cash-flow forecasts and scenarios. Review assumptions and compare possible outcomes. Forecast values are estimates rather than posted balances.",
    intelligence:
      "Explore analytical tools over workspace context. Choose a tool and inspect its inputs and explanation. Scores and simulations are advisory rather than confirmed facts.",
    settings:
      "Configure workspace preferences and supported services. Choose a section or find it with the command palette. Some changes are available only to workspace owners.",
    "data-health":
      "Inspect consistency and data-quality findings. Follow record links and review corrections in their normal editors. Findings cover the records currently loaded, which may be incomplete.",
    support:
      "Review support requests and conversations. Create a ticket using the existing support workflow. Availability depends on the configured service and access.",
    help: "Find workflow guidance and registered screen descriptions. Search All screens using English or Hebrew names and inspect release notes. Send feedback from any screen to save a support ticket with screen and app version. Help describes the implemented workflow and its limits.",
    vault:
      "Manage supporting documents for financial work. Browse files and inspect their record associations. Upload availability depends on the configured document service.",
    pricing:
      "Compare available plans and published features. Review details before using the existing billing workflow. A plan description is not confirmation of a payment.",
    "api-hub":
      "Explore the API interface and integration examples. Review endpoint documentation and developer controls. An example response does not establish a live provider connection.",
    "system-command-center":
      "Inspect the developer-only administration demonstration. Explore its example panels when developer mode is enabled. Demonstration telemetry is distinct from production monitoring.",
  },
  reports: {
    "budget-actual": "Compare a saved account budget with posted account movement for the selected period or months. Open an actual to inspect its contributing entries. Recurring caps are spread by month; partial months keep their cap, and loaded-cache figures are provisional until full history is requested.",
    pnl: "Review posted income, cost of goods sold and expenses for the period. Compare periods and choose presentation columns. Incomplete loaded history makes the figures provisional.",
    "balance-sheet":
      "Review assets, liabilities and equity at the end date. Compare snapshots and inspect account detail. The start date does not erase earlier activity.",
    "cash-flow":
      "Review the existing posted cash-flow statement. Compare periods and inspect included account activity. Scenario forecasts are separate from this statement.",
    "party-linked-trial-balance":
      "Review journals explicitly linked to one customer or supplier. Choose a party and inspect debits, credits and account balances. Unallocated workspace openings and unlinked journals are excluded.",
    "sales-trends":
      "Review twelve months of issued-invoice item activity. Group by customer or item and compare another ending date. Credit notes and document-level tax or discount allocation are outside this item calculation.",
    "purchase-trends":
      "Review twelve months of issued-bill totals by supplier. Inspect monthly activity and compare ending dates. This report groups bills by supplier, not by purchased item.",
    "sales-payment-summary":
      "Review customer receipts grouped by stored payment method. Compare periods and inspect undated receipt counts. Unapplied receipts are not automatically sales revenue.",
    "exchange-rates-used":
      "Review exchange rates stored on workspace documents and entries. Choose dates and inspect the rates actually used. Historical rates on records are distinct from current market quotes.",
    "open-advances":
      "Review customer deposits and vendor prepayments not yet applied to an invoice or bill, oldest first. See how long each has waited and which contacts hold the most. Apply them from the customer's or vendor's page.",
    "deferred-revenue-waterfall":
      "Review scheduled revenue earned by month and still deferred at the period end. Inspect each schedule and its recorded earned amounts. Future scheduled amounts remain distinct from posted earned revenue.",
    "financial-ratios":
      "Review financial ratios together with their formulas. Adjust report-only current-account groups and compare periods. Zero denominators are undefined and turnover days use labelled revenue or COGS proxies.",
    "gross-profit-by-customer":
      "Review sales, estimated cost and gross profit by customer. Compare periods and inspect cost provenance. The existing invoice-item margin rules remain unchanged.",
    "inactive-items":
      "Find items without a recorded sale for a typed number of days. Inspect the last included sale or missing-date warning. No recorded sale is different from complete sales history.",
    "account-balances-as-of":
      "Review account balances through one end date. Compare closing snapshots. Existing openings and prior posted history remain included.",
    "payment-period-by-invoice-date":
      "Review recorded settlement days for paid invoices issued in the period. Compare issue-date windows and inspect invoice labels. Later settlements remain included and partial payments are not a weighted cash model.",
    "customer-period-summary":
      "Review customer openings, invoicing, receipts, credits and closings. Search parties and compare closing balances. Loaded history must be complete before exporting this summary.",
    "supplier-period-summary":
      "Review supplier openings, bills, payments, credits and closings. Search parties and compare closing balances. Negative closings can represent overpayments.",
    "customer-balance-summary":
      "Review customer balances at the selected date. Inspect balances across customers. The existing document status, FX and credit rules determine inclusion.",
    "vendor-balance-summary":
      "Review supplier balances at the selected date. Inspect balances across suppliers. The existing bill, payment and credit rules determine inclusion.",
    "contact-balance-summary":
      "Review the combined contact balance presentation. Inspect party detail for the chosen dates. Interpret the source and timing as labelled on the report.",
    "transactions-by-customer":
      "Review customer documents and receipts for the period. Filter rows and inspect related records. Document movements are distinct from every ledger journal.",
    "transactions-by-vendor":
      "Review supplier documents and payments for the period. Filter rows and inspect related records. Existing bill and payment status rules determine inclusion.",
    "transactions-by-reference":
      "Find posted activity associated with a reference. Inspect matching source entries. A shared reference does not prove records are duplicates.",
    "sales-by-item":
      "Review issued-invoice sales and margin by item. Compare periods and inspect estimated-cost indicators. The existing report explains document-level allocation limits.",
    "inventory-valuation":
      "Review the existing inventory quantity and value presentation. Inspect items and valuation provenance. Current stock records and historical snapshots have different timing.",
    "journal-sheet":
      "Review posted journal lines for the dates. Inspect account, debit and credit detail or print the report. Drafts do not belong in the posted journal.",
    "expense-by-category":
      "Review posted expenses by account category. Compare periods and inspect contributing accounts. Categories come from the workspace chart of accounts.",
    "income-by-source":
      "Review posted income grouped by its reported source. Compare periods and inspect source totals. Existing account-role and posting rules determine inclusion.",
    "top-expenses-income":
      "Review the largest included expense and income lines. Compare dates and inspect their source entries. A large amount is not by itself an anomaly.",
    "monthly-averages":
      "Review the existing monthly averages. Select dates and inspect the stated month count. Partial periods require the timing interpretation shown on the report.",
    "tag-breakdown":
      "Review posted activity by tags. Inspect contributing entries and compare dates. Overlapping tags can describe the same underlying activity.",
    "ar-aging":
      "Review currently unpaid customer invoices by age. Choose the as-of date and inspect overdue documents. Current unpaid status does not reconstruct every historical open balance.",
    "ap-aging":
      "Review currently unpaid supplier bills by age. Choose the as-of date and inspect overdue documents. Current unpaid status does not reconstruct every historical open balance.",
    "general-ledger":
      "Review account openings, posted lines and running balances. Choose an account or period and inspect source journals. Openings include activity before the selected start date.",
    statement:
      "Review a party statement and included documents. Choose a customer or supplier and inspect movements and balance. Sending a statement retains the existing delivery workflow.",
    "tax-liability":
      "Review the existing sales-tax liability report. Select dates and inspect taxable amounts and tax totals. Review the report scope before using it for a tax filing.",
  },
  settings: {
    "scheduled-reports":
      "Choose a report to be emailed by itself after each finished week or month: the profit and loss, the balance sheet or receivables aging. The figures are in the email with a spreadsheet attached, and each period is sent once. Send now emails the last finished period straight away.",
    tags:
      "Review every tag used in the workspace and how many customers, vendors, projects, documents and entries carry it. Rename a tag everywhere at once, merge two by giving one the other's name, or remove a tag from every record. Only the tags change; amounts and entries stay as they are.",
    "incoming-events":
      "Review what Stripe and the email provider reported for this workspace and what came of it. Check whether an online card payment was recorded, is waiting for the bank or was refused, and whether an email was delivered or bounced. Nothing here changes any record.",
    rules:
      "Manage classification and automation rules. Inspect conditions, test matches and use the existing save or apply workflow. Review proposed matches before applying changes.",
    dimensions:
      "Manage workspace axes and labels. Edit supported names or add label nodes. Stable IDs remain unchanged and previous names can remain aliases.",
    appearance:
      "Choose display preferences. Adjust the available theme and density controls. These preferences change presentation rather than posted records.",
    team: "Manage workspace members and invitations. Owners can use the existing invite, role and removal workflow. Only an owner can change workspace membership.",
    billing:
      "Review the workspace plan and billing controls. Use the existing subscription workflow to request changes. A displayed plan does not prove a payment provider accepted a change.",
    templates:
      "Review workspace templates. Inspect a template before applying its chart of accounts. Applying a template changes the workspace.",
    security:
      "Review account and workspace security controls. Use available sign-in, second-factor and session workflows. Confirm sensitive changes before applying them.",
    rule: "Review AI and copilot preferences. Change available controls and inspect their descriptions. Generated advice remains separate from authorized financial writes.",
    developer:
      "Manage API keys and webhook controls. Review scopes and endpoints before making changes. Only authorized members can manage credentials and integrations.",
    import:
      "Import contacts, items or accounts from CSV or Excel. Map columns, preview problems and submit valid rows. This workflow accepts supported fields and creates identities rather than restoring a complete backup.",
    emails:
      "Configure document emails, reminders and invoice approval. Review delivery preferences and the existing send workflow. Sending rules do not change invoice posting.",
    branding:
      "Configure branding and document appearance. Review workspace details and PDF previews. Branding changes do not alter invoice amounts.",
    numbering:
      "Configure document numbering series. Inspect prefixes and sequence controls. New documents receive the next number when they are saved.",
    defaults:
      "Review the accounts used by supported posting workflows. Choose an account or retain automatic role resolution. Posting validation still checks the selected account.",
    schedule:
      "Inspect the daily job schedule and recorded runs. Review status, timing and reported failures. A displayed schedule does not prove a provider action succeeded.",
    export:
      "Download a verified backup or choose a data export. Select posted ledger lines, complete record fields or a base-currency bank account and period. CSV import retains field and identity limits while full restoration uses the verified JSON workflow.",
    shortcuts:
      "Review documented keyboard shortcuts. Find navigation and screen-specific commands. Typing fields and dialogs retain their own keyboard behavior.",
  },
  intelligence: {
    intelligence:
      "Explore the registered intelligence screen. Choose an available tool and inspect its inputs and explanation. An analytical score is not a confirmed accounting fact.",
  },
  lenses: {
    forensics_1:
      "Explore anomaly tools in the shared catalog. Choose an algorithm and inspect source data and assumptions. A high score is a review signal rather than proof of fraud.",
    forensics_2:
      "Explore categorization checks in the shared catalog. Review algorithm suggestions against source records. A suggested category does not authorize a posting change.",
  },
  extra: {
    inventory:
      "Review items, quantities and stock workflows. Edit supported metadata or inspect counts and adjustments. Use the stock adjustment workflow to change quantities or values.",
    projects:
      "Manage projects and inspect their pipeline or profitability. Edit metadata and inspect associated records. Profitability uses the included posted activity.",
    architecture:
      "Explore the application architecture map. Inspect data, algorithm and view layers. The map describes software structure rather than financial results.",
    audit:
      "Inspect the forensic audit presentation. Review source activity and signal explanations. A finding is a reason to investigate rather than proof of fraud.",
    budgets:
      "Maintain budgets and compare them with actual activity. Edit supported metadata and review dates. A budget is a plan rather than a posted transaction.",
    "time-machine":
      "Explore the historical ledger presentation. Choose available dates and inspect included activity. Missing loaded records can leave the view incomplete.",
    ask: "Explore the question-driven ledger workflow. Review interpreted requests and source records. Financial changes require their normal authorized action.",
    magic:
      "Use assisted transaction entry. Review the interpreted amount, accounts and description before saving. A suggestion is not already a posted entry.",
    taxes:
      "Manage tax definitions and inspect tax workflows. Review rates and component rules before changing them. Review resulting tax totals on the affected documents.",
    consolidation:
      "Inspect consolidation across entities. Review selected entities and source account activity. A displayed elimination does not itself post a journal.",
    "accept-invite":
      "Review a workspace invitation. Sign in and accept a valid invitation using its existing workflow. Only a valid invitation can grant workspace access.",
  },
};
export function withScreenHelp<T extends { id: string }>(
  entries: T[],
  group: string,
): (T & { help: string })[] {
  return entries.map((entry) => ({
    ...entry,
    help: SCREEN_HELP[group]?.[entry.id] || "",
  }));
}
