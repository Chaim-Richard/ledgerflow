import re
with open('src/config/registry.tsx', 'r', encoding='utf-8') as f:
    content = f.read()
    
# Replace the bad REPORT_TABS_REGISTRY
bad_str = """export const REPORT_TABS_REGISTRY = [
  { id: 'financial-statements', label: { en: 'Financial Statements', he: 'דוחות כספיים' } }
];"""

good_str = """export const REPORT_TABS_REGISTRY = [
  { id: 'pnl', label: { en: 'Profit & Loss', he: 'רווח והפסד' }, componentName: 'PNLView' },
  { id: 'balance-sheet', label: { en: 'Balance Sheet', he: 'מאזן' }, componentName: 'BalanceSheetReportView' },
  { id: 'cash-flow', label: { en: 'Cash Flow', he: 'תזרים' }, componentName: 'CashFlowView' },
  { id: 'budget-actual', label: { en: 'Budget vs Actual', he: 'תקציב מול ביצוע' }, componentName: 'BudgetActualView' }
];"""

content = content.replace(bad_str, good_str)
with open('src/config/registry.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
