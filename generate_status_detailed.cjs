const fs = require('fs');
const child_process = require('child_process');

const domains = [
  { id: 'D01', name: 'Chart of accounts', type: 'ChartAccount', coll: 'chartAccounts', view: 'GeneralLedger' },
  { id: 'D02', name: 'Journal entries (manual)', type: 'JournalEntry', coll: 'transactions', view: 'Journal' },
  { id: 'D03', name: 'General ledger & drill-down', type: 'Transaction', coll: 'transactions', view: 'GeneralLedgerView' },
  { id: 'D04', name: 'Trial balance', type: 'TrialBalance', coll: 'transactions', view: 'TrialBalance' },
  { id: 'D05', name: 'Profit & loss', type: 'Transaction', coll: 'transactions', view: 'PNLView' },
  { id: 'D06', name: 'Balance sheet', type: 'Transaction', coll: 'transactions', view: 'BalanceSheetReportView' },
  { id: 'D07', name: 'Cash flow statement', type: 'Transaction', coll: 'transactions', view: 'CashFlowView' },
  { id: 'D08', name: 'Fiscal periods & period close', type: 'AccountingPeriod', coll: 'accountingPeriods', view: 'MonthEndClose' },
  { id: 'D09', name: 'Opening balances', type: 'OpeningBalance', coll: 'transactions', view: 'OpeningBalance' },
  { id: 'D10', name: 'Multi-currency', type: 'ExchangeRate', coll: 'exchangeRates', view: 'Currency' },
  { id: 'D11', name: 'Dimensions / cost centres / classes', type: 'DimensionNode', coll: 'dimensionNodes', view: 'DimensionsView' },
  { id: 'D12', name: 'Budgets & forecasting', type: 'Budget', coll: 'budgets', view: 'Budget' },
  { id: 'D13', name: 'Consolidation & multi-entity', type: 'Workspace', coll: 'workspaces', view: 'Consolidation' },
  { id: 'D14', name: 'Intercompany transactions', type: 'Intercompany', coll: 'transactions', view: 'Intercompany' },
  { id: 'D15', name: 'Audit trail & change history', type: 'AuditLog', coll: 'auditLogs', view: 'AuditLog' },
  { id: 'D16', name: 'Customers', type: 'Customer', coll: 'customers', view: 'Customer' },
  { id: 'D17', name: 'Customer detail view', type: 'Customer', coll: 'customers', view: 'CustomerDetail' },
  { id: 'D18', name: 'Estimates / quotes', type: 'Estimate', coll: 'estimates', view: 'Estimate' },
  { id: 'D19', name: 'Sales orders', type: 'SalesOrder', coll: 'salesOrders', view: 'SalesOrder' },
  { id: 'D20', name: 'Invoices', type: 'Invoice', coll: 'invoices', view: 'Invoice' },
  { id: 'D21', name: 'Recurring invoices & bills', type: 'RecurringTransaction', coll: 'recurring', view: 'Recurring' },
  { id: 'D22', name: 'Credit notes / customer refunds', type: 'CreditNote', coll: 'creditNotes', view: 'CreditNote' },
  { id: 'D23', name: 'Payments received', type: 'Payment', coll: 'payments', view: 'Payment' },
  { id: 'D24', name: 'Undeposited funds / deposits', type: 'Deposit', coll: 'deposits', view: 'Deposit' },
  { id: 'D25', name: 'AR aging & collections', type: 'Invoice', coll: 'invoices', view: 'ARAgingReportView' },
  { id: 'D26', name: 'Customer statements', type: 'Statement', coll: 'statements', view: 'StatementView' },
  { id: 'D27', name: 'Revenue recognition / deferred revenue', type: 'DeferredRevenue', coll: 'deferredRevenue', view: 'DeferredRevenue' },
  { id: 'D28', name: 'Bad debt & write-offs', type: 'WriteOff', coll: 'writeOffs', view: 'WriteOff' },
  { id: 'D29', name: 'Retainers / prepayments / deposits from customers', type: 'Prepayment', coll: 'prepayments', view: 'Retainer' },
  { id: 'D30', name: 'Customer portal', type: 'Customer', coll: 'customers', view: 'Portal' },
  { id: 'D31', name: 'Vendors', type: 'Vendor', coll: 'vendors', view: 'Vendor' },
  { id: 'D32', name: 'Vendor detail view', type: 'Vendor', coll: 'vendors', view: 'VendorDetail' },
  { id: 'D33', name: 'Purchase requisitions & approvals', type: 'PurchaseRequisition', coll: 'purchaseRequisitions', view: 'Requisition' },
  { id: 'D34', name: 'Purchase orders', type: 'PurchaseOrder', coll: 'purchaseOrders', view: 'PurchaseOrdersView' },
  { id: 'D35', name: 'Goods receipts', type: 'GoodsReceipt', coll: 'goodsReceipts', view: 'GoodsReceipt' },
  { id: 'D36', name: 'Vendor bills', type: 'Bill', coll: 'bills', view: 'Bill' },
  { id: 'D37', name: 'Vendor credits & debit notes', type: 'VendorCredit', coll: 'vendorCredits', view: 'VendorCredit' },
  { id: 'D38', name: 'Payments made & payment runs', type: 'PayRun', coll: 'payRuns', view: 'PaymentRun' },
  { id: 'D39', name: 'Expense claims / employee reimbursements', type: 'ExpenseClaim', coll: 'expenseClaims', view: 'ExpenseClaim' },
  { id: 'D40', name: 'Prepaid expenses & accruals', type: 'PrepaidExpense', coll: 'prepaidExpenses', view: 'PrepaidExpense' },
  { id: 'D41', name: 'AP aging & cash requirements', type: 'Bill', coll: 'bills', view: 'APAgingReportView' },
  { id: 'D42', name: '1099 / CIS / contractor reporting', type: '1099', coll: '1099', view: '1099' },
  { id: 'D43', name: 'Bank & cash accounts', type: 'BankStatementLine', coll: 'bankLines', view: 'Bank' },
  { id: 'D44', name: 'Bank feeds & statement import', type: 'BankStatementLine', coll: 'bankLines', view: 'BankFeed' },
  { id: 'D45', name: 'Transaction matching & bank rules', type: 'AutoRule', coll: 'autoRules', view: 'Rule' },
  { id: 'D46', name: 'Bank reconciliation', type: 'ReconciliationSession', coll: 'reconciliations', view: 'Reconciliation' },
  { id: 'D47', name: 'Transfers between accounts', type: 'Transfer', coll: 'transactions', view: 'Transfer' },
  { id: 'D48', name: 'Cash position & liquidity', type: 'Transaction', coll: 'transactions', view: 'CashPosition' },
  { id: 'D49', name: 'Payment processing integrations', type: 'Payment', coll: 'payments', view: 'PaymentIntegration' },
  { id: 'D50', name: 'Subscription / expected-bill tracking', type: 'ExpectedBill', coll: 'expectedBills', view: 'Subscription' },
  { id: 'D51', name: 'Petty cash', type: 'PettyCash', coll: 'pettyCash', view: 'PettyCash' },
  { id: 'D52', name: 'Loans & lines of credit', type: 'Loan', coll: 'loans', view: 'Loan' },
  { id: 'D53', name: 'Tax codes & rates', type: 'TaxRate', coll: 'taxRates', view: 'TaxRate' },
  { id: 'D54', name: 'Tax calculation on documents', type: 'Invoice', coll: 'invoices', view: 'Tax' },
  { id: 'D55', name: 'Tax returns & filing', type: 'TaxReturn', coll: 'taxReturns', view: 'TaxLiabilityView' },
  { id: 'D56', name: 'Sales tax (US)', type: 'SalesTax', coll: 'salesTax', view: 'SalesTax' },
  { id: 'D57', name: 'Withholding tax', type: 'WithholdingTax', coll: 'withholdingTax', view: 'WithholdingTax' },
  { id: 'D58', name: 'E-invoicing & statutory formats', type: 'EInvoice', coll: 'einvoices', view: 'EInvoice' },
  { id: 'D59', name: 'Tax audit trail', type: 'TaxAudit', coll: 'taxAudits', view: 'TaxAudit' },
  { id: 'D60', name: 'Report engine & standard report set', type: 'Report', coll: 'reports', view: 'Report' },
  { id: 'D61', name: 'Custom report builder', type: 'CustomReport', coll: 'customReports', view: 'ReportBuilder' },
  { id: 'D62', name: 'Saved views & personalisation', type: 'SavedView', coll: 'savedViews', view: 'SavedView' },
  { id: 'D63', name: 'Dashboards & KPIs', type: 'DashboardSchema', coll: 'dashboards', view: 'Dashboard' },
  { id: 'D64', name: 'Scheduled & emailed reports', type: 'ReportSchedule', coll: 'reportSchedules', view: 'ScheduledReport' },
  { id: 'D65', name: 'Export & document generation', type: 'Export', coll: 'exports', view: 'ExportView' },
  { id: 'D66', name: 'Search', type: 'Search', coll: 'search', view: 'Search' },
  { id: 'D67', name: 'Anomaly detection & data health', type: 'Anomaly', coll: 'anomalies', view: 'Anomaly' },
  { id: 'D68', name: 'AI copilot & assistants', type: 'AICopilot', coll: 'aiCopilot', view: 'AISettingsView' },
  { id: 'D69', name: 'Items / products catalogue', type: 'InventoryItem', coll: 'inventory', view: 'Item' },
  { id: 'D70', name: 'Inventory stock & valuation', type: 'InventoryItem', coll: 'inventory', view: 'Inventory' },
  { id: 'D71', name: 'Fixed assets', type: 'FixedAsset', coll: 'assets', view: 'Asset' },
  { id: 'D72', name: 'Payroll', type: 'PayRun', coll: 'payRuns', view: 'Payroll' },
  { id: 'D73', name: 'Time tracking & timesheets', type: 'TimeEntry', coll: 'timeEntries', view: 'Timesheet' },
  { id: 'D74', name: 'Projects & job costing', type: 'Project', coll: 'projects', view: 'Project' },
  { id: 'D75', name: 'Document management / vault', type: 'CloudDocument', coll: 'documents', view: 'Document' },
  { id: 'D76', name: 'OCR & document capture', type: 'OCR', coll: 'ocr', view: 'OCR' },
  { id: 'D77', name: 'Notifications & alerts', type: 'AppNotification', coll: 'notifications', view: 'Notification' },
  { id: 'D78', name: 'Onboarding, help & templates', type: 'Onboarding', coll: 'onboarding', view: 'Onboarding' },
  { id: 'D79', name: 'Public API', type: 'APIKey', coll: 'apiKeys', view: 'API' },
  { id: 'D80', name: 'Webhooks (outbound)', type: 'Webhook', coll: 'webhooks', view: 'Webhook' },
  { id: 'D81', name: 'Integrations', type: 'Integration', coll: 'integrations', view: 'Integration' },
  { id: 'D82', name: 'Import & migration', type: 'Import', coll: 'imports', view: 'Import' },
  { id: 'D83', name: 'Backup, export & data portability', type: 'Backup', coll: 'backups', view: 'ExportView' },
  { id: 'D84', name: 'Data retention, deletion & compliance', type: 'DataRetention', coll: 'dataRetention', view: 'DataRetention' },
  { id: 'X01', name: 'Authentication & sessions', type: 'Session', coll: 'sessions', view: 'Login' },
  { id: 'X02', name: 'Company accounts & multi-user', type: 'Workspace', coll: 'workspaces', view: 'Workspace' },
  { id: 'X03', name: 'Role gating in the UI', type: 'Role', coll: 'roles', view: 'TeamView' },
  { id: 'X04', name: 'Bulk action bar', type: 'BulkAction', coll: 'bulkActions', view: 'Bulk' },
  { id: 'X05', name: 'Email templates & sending', type: 'EmailTemplate', coll: 'emailTemplates', view: 'Email' },
  { id: 'X06', name: 'Attachments on every entity', type: 'Attachment', coll: 'attachments', view: 'Attachment' },
  { id: 'X07', name: 'Numbering series', type: 'NumberingSeries', coll: 'numberingSeries', view: 'Numbering' },
  { id: 'X08', name: 'Background jobs & scheduler', type: 'Job', coll: 'jobs', view: 'Job' },
  { id: 'X09', name: 'Firestore read cost & page-load performance', type: 'Performance', coll: 'performance', view: 'Performance' },
  { id: 'X10', name: 'Archiving & scale', type: 'Archive', coll: 'archives', view: 'Archive' },
  { id: 'X11', name: 'Code health', type: 'CodeHealth', coll: 'codeHealth', view: 'Health' },
  { id: 'X12', name: 'Accessibility & internationalisation', type: 'I18n', coll: 'i18n', view: 'I18n' },
  { id: 'X13', name: 'Observability, errors & security hardening', type: 'ErrorLogRecord', coll: 'errorLogs', view: 'Error' }
];

function checkDomain(domain) {
  let hasType = false;
  let hasColl = false;
  let hasView = false;
  let hasTests = false;

  try {
    hasType = child_process.execSync(`grep -q "export interface ${domain.type}" src/types.ts || grep -q "export type ${domain.type}" src/types.ts`).status === undefined;
  } catch(e) {}
  
  try {
    hasColl = child_process.execSync(`grep -q "${domain.coll}" src/hooks/useLedgerData.ts || grep -q "${domain.coll}" firestore.rules`).status === undefined;
  } catch(e) {}
  
  try {
    hasView = child_process.execSync(`grep -q "${domain.view}" src/config/registry.tsx`).status === undefined;
  } catch(e) {}
  
  try {
    hasTests = child_process.execSync(`grep -riq "${domain.type}\\|${domain.coll}" src/tests/`).status === undefined;
  } catch(e) {}

  let status = 'MISSING';
  if (hasType && hasColl && hasView) status = 'PRESENT';
  else if (hasType && hasColl && !hasView) status = 'ENGINE-ONLY';
  else if (hasType && !hasColl && !hasView) status = 'PARTIAL';
  else if (!hasType && hasColl) status = 'PARTIAL';
  else if (!hasType && !hasColl && hasView) status = 'UI-ONLY';
  else if (!hasType && !hasColl && !hasView) status = 'MISSING';

  // Specific overrides based on user instructions
  if (domain.id === 'D72') status = 'ENGINE-ONLY'; // Payroll is engine only
  
  return `| ${domain.id} — ${domain.name} | ${status} | Type:${hasType} Coll:${hasColl} View:${hasView} | - | ${hasTests} | - |`;
}

let md = `# LedgerFlow Domain Status Report\n\n`;
md += `Generated by automated analysis.\n\n`;
md += `| Domain | Status | Evidence | Reachable? | Tested? | Gap |\n`;
md += `|---|---|---|---|---|---|\n`;

for (let d of domains) {
  md += checkDomain(d) + '\n';
}

fs.writeFileSync('docs/STATUS.md', md);
console.log('Generated docs/STATUS.md');
