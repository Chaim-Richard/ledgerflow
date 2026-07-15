const fs = require('fs');
const path = './src/config/registry.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  /export const REPORT_TABS_REGISTRY = \[([\s\S]*?)\];/,
  `export const REPORT_TABS_REGISTRY = [
  { id: 'pnl', label: { en: 'Profit & Loss', he: 'רווח והפסד' }, componentName: 'PNLView', icon: Activity },
  { id: 'balance-sheet', label: { en: 'Balance Sheet', he: 'מאזן' }, componentName: 'BalanceSheetReportView', icon: Layers },
  { id: 'cash-flow', label: { en: 'Cash Flow', he: 'תזרים' }, componentName: 'CashFlowView', icon: RefreshCw },
  { id: 'budget-actual', label: { en: 'Budget vs Actual', he: 'תקציב מול ביצוע' }, componentName: 'BudgetActualView', icon: Target }
];`
);

code = code.replace(
  /export const SETTINGS_TABS_REGISTRY = \[([\s\S]*?)\];/,
  `export const SETTINGS_TABS_REGISTRY = [
  { id: 'billing', label: { en: 'Billing & Plan', he: 'תוכניות וחיוב' }, componentName: 'BillingView', icon: CreditCard },
  { id: 'templates', label: { en: 'Custom Templates', he: 'תבניות' }, componentName: 'TemplatesView', icon: FileText }
];`
);

code = code.replace(
  /export const INTELLIGENCE_TABS_REGISTRY = \[([\s\S]*?)\];/,
  `export const INTELLIGENCE_TABS_REGISTRY = [
  { id: 'intelligence', label: { en: 'Intelligence', he: 'מודיעין' }, componentName: 'UnifiedIntelligenceCore' }
];`
);

fs.writeFileSync(path, code);
