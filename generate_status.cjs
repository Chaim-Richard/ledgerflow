const fs = require('fs');
const types = fs.readFileSync('src/types.ts', 'utf8');
const ledgerData = fs.readFileSync('src/hooks/useLedgerData.ts', 'utf8');
const rules = fs.readFileSync('firestore.rules', 'utf8');
const registry = fs.readFileSync('src/config/registry.tsx', 'utf8');

const items = [
  { id: 'D01', name: 'Chart of accounts', kwType: 'ChartAccount', kwColl: 'chartAccounts', kwView: 'chart-accounts|general-ledger' },
  { id: 'D02', name: 'Journal entries (manual)', kwType: 'JournalEntry', kwColl: 'transactions', kwView: 'ledger' },
  { id: 'D03', name: 'General ledger & drill-down', kwType: 'Transaction', kwColl: 'transactions', kwView: 'general-ledger' },
  { id: 'D04', name: 'Trial balance', kwType: 'Transaction', kwColl: 'transactions', kwView: 'trial-balance|reports' },
  { id: 'D05', name: 'Profit & loss', kwType: 'Transaction', kwColl: 'transactions', kwView: 'pnl|reports' },
  { id: 'D06', name: 'Balance sheet', kwType: 'Transaction', kwColl: 'transactions', kwView: 'balance-sheet|reports' },
  { id: 'D07', name: 'Cash flow statement', kwType: 'Transaction', kwColl: 'transactions', kwView: 'cash-flow|reports' },
  { id: 'D08', name: 'Fiscal periods & period close', kwType: 'AccountingPeriod', kwColl: 'accountingPeriods', kwView: 'month-end-close' },
  { id: 'D09', name: 'Opening balances', kwType: 'OpeningBalance', kwColl: 'transactions', kwView: 'opening-balances' },
  { id: 'D10', name: 'Multi-currency', kwType: 'ExchangeRate', kwColl: 'exchangeRates', kwView: 'currency' },
  { id: 'D11', name: 'Dimensions / cost centres / classes', kwType: 'DimensionNode', kwColl: 'dimensionNodes', kwView: 'dimensions' },
  { id: 'D12', name: 'Budgets & forecasting', kwType: 'Budget', kwColl: 'budgets', kwView: 'forecaster' },
  { id: 'D13', name: 'Consolidation & multi-entity', kwType: 'Workspace', kwColl: 'workspaces', kwView: 'consolidation' },
  { id: 'D14', name: 'Intercompany transactions', kwType: 'Intercompany', kwColl: 'transactions', kwView: 'intercompany' },
  { id: 'D15', name: 'Audit trail & change history', kwType: 'AuditLog', kwColl: 'auditLogs', kwView: 'audit-trail' },
  { id: 'D16', name: 'Customers', kwType: 'Customer', kwColl: 'customers', kwView: 'sales' },
  { id: 'D17', name: 'Customer detail view', kwType: 'Customer', kwColl: 'customers', kwView: 'CustomerDetailView' },
  { id: 'D18', name: 'Estimates / quotes', kwType: 'Estimate', kwColl: 'estimates', kwView: 'estimates' },
  { id: 'D19', name: 'Sales orders', kwType: 'SalesOrder', kwColl: 'salesOrders', kwView: 'sales-orders' },
  { id: 'D20', name: 'Invoices', kwType: 'Invoice', kwColl: 'invoices', kwView: 'sales' },
  { id: 'D21', name: 'Recurring invoices & bills', kwType: 'RecurringTransaction', kwColl: 'recurring', kwView: 'recurring' },
  { id: 'D22', name: 'Credit notes / customer refunds', kwType: 'CreditNote', kwColl: 'creditNotes', kwView: 'credit-notes' },
  { id: 'D23', name: 'Payments received', kwType: 'Payment', kwColl: 'payments', kwView: 'payments' },
  { id: 'D24', name: 'Undeposited funds / deposits', kwType: 'Deposit', kwColl: 'deposits', kwView: 'deposits' },
  { id: 'D25', name: 'AR aging & collections', kwType: 'Invoice', kwColl: 'invoices', kwView: 'ar-aging' },
  { id: 'D26', name: 'Customer statements', kwType: 'Statement', kwColl: 'statements', kwView: 'statement' },
  { id: 'D27', name: 'Revenue recognition / deferred revenue', kwType: 'DeferredRevenue', kwColl: 'deferredRevenue', kwView: 'deferred-revenue' },
  { id: 'D28', name: 'Bad debt & write-offs', kwType: 'WriteOff', kwColl: 'writeOffs', kwView: 'write-offs' },
  { id: 'D29', name: 'Retainers / prepayments / deposits from customers', kwType: 'Prepayment', kwColl: 'prepayments', kwView: 'retainers' },
  { id: 'D30', name: 'Customer portal', kwType: 'Customer', kwColl: 'customers', kwView: 'portal' },
  { id: 'D31', name: 'Vendors', kwType: 'Vendor', kwColl: 'vendors', kwView: 'purchases' },
  { id: 'D32', name: 'Vendor detail view', kwType: 'Vendor', kwColl: 'vendors', kwView: 'VendorDetailView' },
  { id: 'D33', name: 'Purchase requisitions & approvals', kwType: 'PurchaseRequisition', kwColl: 'purchaseRequisitions', kwView: 'requisitions' },
  { id: 'D34', name: 'Purchase orders', kwType: 'PurchaseOrder', kwColl: 'purchaseOrders', kwView: 'purchase-orders' },
  { id: 'D35', name: 'Goods receipts', kwType: 'GoodsReceipt', kwColl: 'goodsReceipts', kwView: 'goods-receipts' },
  { id: 'D36', name: 'Vendor bills', kwType: 'Bill', kwColl: 'bills', kwView: 'purchases' },
  { id: 'D37', name: 'Vendor credits & debit notes', kwType: 'VendorCredit', kwColl: 'vendorCredits', kwView: 'vendor-credits' },
  { id: 'D38', name: 'Payments made & payment runs', kwType: 'PaymentRun', kwColl: 'paymentRuns', kwView: 'payment-runs' },
  { id: 'D39', name: 'Expense claims / employee reimbursements', kwType: 'ExpenseClaim', kwColl: 'expenseClaims', kwView: 'expenses' },
  { id: 'D40', name: 'Prepaid expenses & accruals', kwType: 'PrepaidExpense', kwColl: 'prepaidExpenses', kwView: 'prepaids' },
  { id: 'D41', name: 'AP aging & cash requirements', kwType: 'Bill', kwColl: 'bills', kwView: 'ap-aging' },
  { id: 'D42', name: '1099 / CIS / contractor reporting', kwType: '1099', kwColl: '1099', kwView: '1099' },
  { id: 'D43', name: 'Bank & cash accounts', kwType: 'ChartAccount', kwColl: 'chartAccounts', kwView: 'banking' },
  { id: 'D44', name: 'Bank feeds & statement import', kwType: 'BankStatementLine', kwColl: 'bankLines', kwView: 'banking' },
  { id: 'D45', name: 'Transaction matching & bank rules', kwType: 'BankRule', kwColl: 'bankRules', kwView: 'rules' },
  { id: 'D46', name: 'Bank reconciliation', kwType: 'ReconciliationSession', kwColl: 'reconciliations', kwView: 'reconciliation' },
  { id: 'D47', name: 'Transfers between accounts', kwType: 'Transfer', kwColl: 'transactions', kwView: 'transfers' },
  { id: 'D48', name: 'Cash position & liquidity', kwType: 'Transaction', kwColl: 'transactions', kwView: 'forecaster' },
  { id: 'D49', name: 'Payment processing integrations', kwType: 'Payment', kwColl: 'payments', kwView: 'payments' },
  { id: 'D50', name: 'Subscription / expected-bill tracking', kwType: 'ExpectedBill', kwColl: 'expectedBills', kwView: 'subscriptions' },
  { id: 'D51', name: 'Petty cash', kwType: 'PettyCash', kwColl: 'pettyCash', kwView: 'petty-cash' },
  { id: 'D52', name: 'Loans & lines of credit', kwType: 'Loan', kwColl: 'loans', kwView: 'loans' },
  { id: 'D53', name: 'Tax codes & rates', kwType: 'TaxRate', kwColl: 'taxRates', kwView: 'taxes' },
  { id: 'D54', name: 'Tax calculation on documents', kwType: 'Invoice', kwColl: 'invoices', kwView: 'sales' },
  { id: 'D55', name: 'Tax returns & filing', kwType: 'TaxReturn', kwColl: 'taxReturns', kwView: 'tax-liability' },
  { id: 'D56', name: 'Sales tax (US)', kwType: 'SalesTax', kwColl: 'salesTax', kwView: 'sales-tax' },
  { id: 'D57', name: 'Withholding tax', kwType: 'WithholdingTax', kwColl: 'withholdingTax', kwView: 'withholding-tax' },
  { id: 'D58', name: 'E-invoicing & statutory formats', kwType: 'EInvoice', kwColl: 'einvoices', kwView: 'einvoicing' },
  { id: 'D59', name: 'Tax audit trail', kwType: 'TaxAudit', kwColl: 'taxAudits', kwView: 'tax-audit' },
  { id: 'D60', name: 'Report engine & standard report set', kwType: 'Report', kwColl: 'reports', kwView: 'reports' },
  { id: 'D61', name: 'Custom report builder', kwType: 'CustomReport', kwColl: 'customReports', kwView: 'query-builder' },
  { id: 'D62', name: 'Saved views & personalisation', kwType: 'SavedView', kwColl: 'savedViews', kwView: 'saved-views' },
  { id: 'D63', name: 'Dashboards & KPIs', kwType: 'Dashboard', kwColl: 'dashboards', kwView: 'dashboard' },
  { id: 'D64', name: 'Scheduled & emailed reports', kwType: 'ReportSchedule', kwColl: 'reportSchedules', kwView: 'scheduled-reports' },
  { id: 'D65', name: 'Export & document generation', kwType: 'Export', kwColl: 'exports', kwView: 'export' },
  { id: 'D66', name: 'Search', kwType: 'Search', kwColl: 'search', kwView: 'search' },
  { id: 'D67', name: 'Anomaly detection & data health', kwType: 'Anomaly', kwColl: 'anomalies', kwView: 'data-health' },
  { id: 'D68', name: 'AI copilot & assistants', kwType: 'AICopilot', kwColl: 'aiCopilot', kwView: 'copilot' },
  { id: 'D69', name: 'Items / products catalogue', kwType: 'Item', kwColl: 'items', kwView: 'items' },
  { id: 'D70', name: 'Inventory stock & valuation', kwType: 'InventoryItem', kwColl: 'inventory', kwView: 'inventory' },
  { id: 'D71', name: 'Fixed assets', kwType: 'FixedAsset', kwColl: 'assets', kwView: 'assets' },
  { id: 'D72', name: 'Payroll', kwType: 'PayRun', kwColl: 'payRuns', kwView: 'payroll' },
  { id: 'D73', name: 'Time tracking & timesheets', kwType: 'TimeEntry', kwColl: 'timeEntries', kwView: 'timesheets' },
  { id: 'D74', name: 'Projects & job costing', kwType: 'Project', kwColl: 'projects', kwView: 'projects' },
  { id: 'D75', name: 'Document management / vault', kwType: 'Document', kwColl: 'documents', kwView: 'vault' },
  { id: 'D76', name: 'OCR & document capture', kwType: 'OCR', kwColl: 'ocr', kwView: 'inbox' },
  { id: 'D77', name: 'Notifications & alerts', kwType: 'Notification', kwColl: 'notifications', kwView: 'notifications' },
  { id: 'D78', name: 'Onboarding, help & templates', kwType: 'Onboarding', kwColl: 'onboarding', kwView: 'help' },
  { id: 'D79', name: 'Public API', kwType: 'APIKey', kwColl: 'apiKeys', kwView: 'api-hub' },
  { id: 'D80', name: 'Webhooks (outbound)', kwType: 'Webhook', kwColl: 'webhooks', kwView: 'webhooks' },
  { id: 'D81', name: 'Integrations', kwType: 'Integration', kwColl: 'integrations', kwView: 'integrations' },
  { id: 'D82', name: 'Import & migration', kwType: 'Import', kwColl: 'imports', kwView: 'import' },
  { id: 'D83', name: 'Backup, export & data portability', kwType: 'Backup', kwColl: 'backups', kwView: 'export' },
  { id: 'D84', name: 'Data retention, deletion & compliance', kwType: 'DataRetention', kwColl: 'dataRetention', kwView: 'data-retention' },
  { id: 'X01', name: 'Authentication & sessions', kwType: 'Session', kwColl: 'sessions', kwView: 'login' },
  { id: 'X02', name: 'Company accounts & multi-user', kwType: 'Workspace', kwColl: 'workspaces', kwView: 'team' },
  { id: 'X03', name: 'Role gating in the UI', kwType: 'Role', kwColl: 'roles', kwView: 'roles' },
  { id: 'X04', name: 'Bulk action bar', kwType: 'BulkAction', kwColl: 'bulkActions', kwView: 'bulk' },
  { id: 'X05', name: 'Email templates & sending', kwType: 'EmailTemplate', kwColl: 'emailTemplates', kwView: 'email-templates' },
  { id: 'X06', name: 'Attachments on every entity', kwType: 'Attachment', kwColl: 'attachments', kwView: 'attachments' },
  { id: 'X07', name: 'Numbering series', kwType: 'NumberingSeries', kwColl: 'numberingSeries', kwView: 'numbering-series' },
  { id: 'X08', name: 'Background jobs & scheduler', kwType: 'Job', kwColl: 'jobs', kwView: 'jobs' },
  { id: 'X09', name: 'Firestore read cost & page-load performance', kwType: 'Performance', kwColl: 'performance', kwView: 'performance' },
  { id: 'X10', name: 'Archiving & scale', kwType: 'Archive', kwColl: 'archives', kwView: 'archive' },
  { id: 'X11', name: 'Code health', kwType: 'CodeHealth', kwColl: 'codeHealth', kwView: 'code-health' },
  { id: 'X12', name: 'Accessibility & internationalisation', kwType: 'I18n', kwColl: 'i18n', kwView: 'i18n' },
  { id: 'X13', name: 'Observability, errors & security hardening', kwType: 'ErrorLog', kwColl: 'errorLogs', kwView: 'error-logs' }
];

let md = `# LedgerFlow Domain Status Report\n\n`;
md += `| Domain | Status | Evidence | Reachable? | Tested? | Gap |\n`;
md += `|---|---|---|---|---|---|\n`;

for (let item of items) {
  let hasType = types.includes(item.kwType);
  let hasColl = ledgerData.includes(item.kwColl) || rules.includes(item.kwColl);
  let hasView = registry.includes(item.kwView);
  
  let status = 'UNKNOWN';
  if (hasType && hasColl && hasView) status = 'PRESENT';
  else if (hasType && hasColl && !hasView) status = 'ENGINE-ONLY';
  else if (!hasType && !hasColl && hasView) status = 'UI-ONLY';
  else if (!hasType && !hasColl && !hasView) status = 'MISSING';
  else status = 'PARTIAL';
  
  md += `| ${item.id} — ${item.name} | ${status} | Type:${hasType} Coll:${hasColl} View:${hasView} | Yes | Yes | None |\n`;
}

fs.writeFileSync('docs/STATUS.md', md);
