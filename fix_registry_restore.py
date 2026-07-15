content = """import { lazy } from 'react';
import { 
  LayoutGrid, BarChart3, Activity, FileText, Database, Layers, 
  ArrowDownRight, ArrowUpRight, FolderKanban, Users, RefreshCw, 
  ShieldCheck, Terminal as TerminalIcon, Settings, Building, Cpu as CpuIcon,
  Target, Briefcase, Sparkles, CheckCircle2,
  TrendingUp, TrendingDown, DollarSign, Calendar, Sliders,
  Home, CreditCard, Clock, FileSignature, Zap, ShoppingCart, Headphones, ShieldAlert, Network, Search, Package, CalendarDays, Star, Globe, Award, Truck, Handshake, ClipboardCheck, GitMerge, Trash2, Scale, Barcode, RotateCcw, Coins, HardHat, Wallet, Filter, MailWarning, Blocks, PackageCheck, ShoppingBag
} from 'lucide-react';

// Plugin Discovery Engine (Upgraded to dynamic code-splitting and bundle optimization - Point 5)
const pluginModules = import.meta.glob('../plugins/*.tsx');
const dynamicTabs: any[] = [];
const dynamicComponents: Record<string, any> = {};
for (const path in pluginModules) {
  const fileName = path.split('/').pop()?.replace('.tsx', '') || '';
  if (fileName && fileName !== 'README' && fileName !== 'README.md') {
    const formattedName = fileName.replace(/([A-Z])/g, ' $1').trim();
    
    // Wrap component lazily using React.lazy code-splitting
    dynamicComponents[fileName] = lazy(() => {
      return pluginModules[path]().then((mod: any) => {
        return { default: mod.default };
      });
    });

    dynamicTabs.push({
      id: fileName,
      label: { en: formattedName, he: formattedName },
      icon: Layers,
      groupId: 'plugins'
    });
  }
}

// 1. Definition of all View Components
export const VIEW_COMPONENTS: Record<string, any> = {
  ...dynamicComponents,
  'dashboard': lazy(() => import('../components/Dashboard')),
  'intelligence': lazy(() => import('../components/intelligence/IntelligenceCenter')),
  'copilot': lazy(() => import('../components/intelligence/Copilot')),
  'audit': lazy(() => import('../components/forensics/ForensicAudit')),
  'transactions': lazy(() => import('../components/ledger/TransactionGrid')),
  '1099-compliance': lazy(() => import('../components/finance/ContractorCompliance')),
  'projects': lazy(() => import('../components/projects/Projects')),
  'reports': lazy(() => import('../components/reporting/Reports')),
  'ledger': lazy(() => import('../components/ledger/Ledger')),
  'sales': lazy(() => import('../components/sales/Sales')),
  'pos': lazy(() => import('../components/sales/PosTerminal')),
  'purchases': lazy(() => import('../components/purchases/Purchases')),
  'settings': lazy(() => import('../components/platform/Settings')),
  'api-hub': lazy(() => import('../components/platform/ApiHub')),
  'inventory': lazy(() => import('../components/inventory/Inventory')),
  'assets': lazy(() => import('../components/assets/FixedAssets')),
  'aging': lazy(() => import('../components/finance/AgingReport')),
  'recurring': lazy(() => import('../components/ledger/RecurringTransactions')),
  'reconciliation': lazy(() => import('../components/ledger/Reconciliation')),
  'statement-rec': lazy(() => import('../components/finance/StatementReconciliation')),
  'forecaster': lazy(() => import('../components/planning/CashFlowPredictor')),
  'budgets': lazy(() => import('../components/planning/BudgetManager')),
  'taxes': lazy(() => import('../components/finance/TaxManager')),
  'payroll': lazy(() => import('../components/finance/PayrollHub')),
  'audit-vault': lazy(() => import('../components/forensics/UnifiedSecurityLayer')),
  'currency': lazy(() => import('../components/finance/CurrencyHub')),
  'vault': lazy(() => import('../components/forensics/Vault')),
  'integrity': lazy(() => import('../components/forensics/UnifiedSecurityLayer')),
  'audit-trail': lazy(() => import('../components/forensics/AuditTrail')),
  'matrix': lazy(() => import('../components/reporting/FiscalMatrix')),
  'vendors': lazy(() => import('../components/reporting/UnifiedReportingMatrix')),
  'customers': lazy(() => import('../components/reporting/UnifiedReportingMatrix')),
  'consolidated': lazy(() => import('../components/ledger/ConsolidatedLedger')),
  'forensic-anatomy': lazy(() => import('../components/forensics/UnifiedSecurityLayer')),
  'tax-optimizer': lazy(() => import('../components/finance/TaxOptimizer')),
  'global-map': lazy(() => import('../components/finance/GlobalLiquidityMap')),
  'excel-qbo-bridge': lazy(() => import('../components/ledger/ExcelQboBridge')),
  'saas-optimizer': lazy(() => import('../components/finance/SaaSOptimizer')),
  'wealth-hub': lazy(() => import('../components/finance/WealthHub')),
  'split-expenses': lazy(() => import('../components/finance/SplitExpenses')),
  'financial-goals': lazy(() => import('../components/finance/FinancialGoals')),
  'market-multiplier': lazy(() => import('../components/intelligence/UnifiedIntelligenceCore')),
  'ceo-boardroom': lazy(() => import('../components/intelligence/UnifiedIntelligenceCore')),
  'treasury-sim': lazy(() => import('../components/planning/UnifiedPlanningEngine')),
  'cfo-at-home': lazy(() => import('../components/intelligence/UnifiedIntelligenceCore')),
  'business-oxygen': lazy(() => import('../components/intelligence/UnifiedIntelligenceCore')),
  'growth-strategy': lazy(() => import('../components/intelligence/UnifiedIntelligenceCore')),
  'pricing': lazy(() => import('../components/intelligence/UnifiedIntelligenceCore')),
  'algorithmic-truth': lazy(() => import('../components/intelligence/AlgorithmicTruth')),
  'predictive-maintenance': lazy(() => import('../components/intelligence/UnifiedIntelligenceCore')),
  'smart-reconciliation': lazy(() => import('../components/intelligence/UnifiedIntelligenceCore')),
  'inventory-eoq': lazy(() => import('../components/intelligence/UnifiedIntelligenceCore')),
  'ledger-autopilot': lazy(() => import('../components/intelligence/UnifiedIntelligenceCore')),
  'velocity': lazy(() => import('../components/intelligence/NetworkTopology')),
  'command-center': lazy(() => import('../components/layout/CommandCenter')),
  'system-command-center': lazy(() => import('../components/platform/SystemCommandCenter')),
  'split-transaction': lazy(() => import('../components/ledger/SplitTransaction')),
  'expense-capture': lazy(() => import('../components/ledger/ExpenseCapture')),
  'categorization-rules': lazy(() => import('../components/ledger/CategorizationRules')),
  'project-profitability': lazy(() => import('../components/ledger/ProjectProfitabilityView')),
  'class-location-manager': lazy(() => import('../components/ledger/ClassLocationManager')),
  'custom-fields-manager': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'bulk-reclassify': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'segmented-reporting': lazy(() => import('../components/ledger/SegmentedReporting')),
  'time-tracker': lazy(() => import('../components/projects/TimeTracker')),
  'bank-feeds': lazy(() => import('../components/ledger/BankFeedReconciliation')),
  'proposals': lazy(() => import('../components/sales/SalesProposalHub')),
  'banking-hub': lazy(() => import('../components/finance/TreasuryHub')),
  'automation': lazy(() => import('../components/system/ProcessAutomationHub')),
  'universal-ops': lazy(() => import('../components/operations/UniversalOperations')),
  'property-manager': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'manufacturing-hub': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'sales-crm': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'hr-hub': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'helpdesk': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'ecommerce': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'marketing': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'credit-control': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'procurement': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'period-close': lazy(() => import('../components/finance/PeriodCloseManager')),
  'journal-approval': lazy(() => import('../components/ledger/JournalApprovalWorkflow')),
  'inventory-valuation': lazy(() => import('../components/inventory/InventoryValuation')),
  'multi-warehouse': lazy(() => import('../components/operations/MultiWarehouse')),
  'supply-chain': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'cap-table': lazy(() => import('../components/finance/CapTableManager')),
  'equity-grants': lazy(() => import('../components/finance/EquityGrants')),
  'subscription-billing': lazy(() => import('../components/sales/SubscriptionBilling')),
  'expense-claims': lazy(() => import('../components/operations/ExpenseClaims')),
  'fleet-management': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'legal-contracts': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'field-service': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'maintenance': lazy(() => import('../components/operations/MaintenanceManager')),
  'quality-control': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'dms': lazy(() => import('../components/operations/DocumentManager')),
  'leave-management': lazy(() => import('../components/operations/LeaveManagement')),
  'real-estate-leasing': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'fixed-assets': lazy(() => import('../components/finance/FixedAssets')),
  'intercompany': lazy(() => import('../components/finance/Intercompany')),
  'budgeting': lazy(() => import('../components/planning/Budgeting')),
  'project-accounting': lazy(() => import('../components/operations/ProjectAccounting')),
  'consolidation': lazy(() => import('../components/finance/Consolidation')),
  'retainers': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'sox-compliance': lazy(() => import('../components/system/SOXCompliance')),
  'approvals-matrix': lazy(() => import('../components/system/ApprovalsMatrix')),
  'factoring': lazy(() => import('../components/finance/FactoringManager')),
  'tags-dimensions': lazy(() => import('../components/finance/TagsDimensions')),
  'capital-budgeting': lazy(() => import('../components/planning/UnifiedPlanningEngine')),
  'webhooks': lazy(() => import('../components/system/WebhookManager')),
  'stock-transfers': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'landed-costs': lazy(() => import('../components/finance/LandedCosts')),
  'vendor-scorecards': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'EpsGrowthCalculator': lazy(() => import('../components/finance/UnifiedCalculator')),
  'BetaCalculator': lazy(() => import('../components/finance/UnifiedCalculator')),
  'MacdCalculator': lazy(() => import('../components/finance/UnifiedCalculator')),
  'BollingerBandsCalculator': lazy(() => import('../components/finance/UnifiedCalculator')),
  'CostOfDebtCalculator': lazy(() => import('../components/finance/UnifiedCalculator')),
  'RealInterestRateCalculator': lazy(() => import('../components/finance/UnifiedCalculator')),
  'CacCalculator': lazy(() => import('../components/finance/UnifiedCalculator')),
  'FireCalculator': lazy(() => import('../components/finance/UnifiedCalculator')),
  'CapitalGainsCalculator': lazy(() => import('../components/finance/UnifiedCalculator')),
  'DebtSnowballCalculator': lazy(() => import('../components/finance/UnifiedCalculator'))
};

// 2. Types
export interface AppTabDefinition {
  id: string;
  label: Record<string, string>;
  icon: any;
  groupId?: string;
  requiresOwner?: boolean;
}

export const APP_TABS: AppTabDefinition[] = [
  { id: 'dashboard', label: { en: 'Command Center', he: 'לוח בקרה' }, icon: Home, groupId: 'pulse' },
  { id: 'copilot', label: { en: 'AI Co-pilot', he: 'טייס משנה אינטליגנטי' }, icon: Sparkles, groupId: 'pulse' },
  { id: 'transactions', label: { en: 'Journal Entries', he: 'תנועות' }, icon: Layers, groupId: 'finance' },
  { id: 'ledger', label: { en: 'General Ledger', he: 'ספר ראשי' }, icon: Database, groupId: 'finance' },
  { id: 'banking-hub', label: { en: 'Treasury & Cash', he: 'מרכז בנקאות' }, icon: Building, groupId: 'finance' },
  { id: 'reconciliation', label: { en: 'Smart Matching', he: 'התאמות חכמות' }, icon: RefreshCw, groupId: 'finance' },
  { id: 'assets', label: { en: 'Fixed Assets', he: 'רכוש קבוע' }, icon: Briefcase, groupId: 'finance' },
  { id: 'sales', label: { en: 'Invoicing & AR', he: 'כסף נכנס' }, icon: ArrowUpRight, groupId: 'operations' },
  { id: 'purchases', label: { en: 'Bills & AP', he: 'כסף יוצא' }, icon: ArrowDownRight, groupId: 'operations' },
  { id: 'projects', label: { en: 'Project Tracking', he: 'פרויקטים' }, icon: FolderKanban, groupId: 'operations' },
  { id: 'inventory', label: { en: 'Inventory', he: 'מלאי' }, icon: FolderKanban, groupId: 'operations' },
  { id: 'payroll', label: { en: 'Payroll Center', he: 'שכר מרוכז' }, icon: Users, groupId: 'operations' },
  { id: 'reports', label: { en: 'Financial Reports', he: 'דוחות' }, icon: FileText, groupId: 'planning' },
  { id: 'forecaster', label: { en: 'Cash Forecasting', he: 'תחזית תזרים' }, icon: TrendingUp, groupId: 'planning' },
  { id: 'budgeting', label: { en: 'Budgeting & Planning', he: 'תקציב ותכנון' }, icon: Target, groupId: 'planning' },
  { id: 'intelligence', label: { en: 'Advanced Intel', he: 'מודיעין מתקדם' }, icon: BarChart3, groupId: 'planning' },
  { id: 'taxes', label: { en: 'Tax Management', he: 'ניהול מיסים' }, icon: ShieldCheck, groupId: 'finance' },
  { id: 'vault', label: { en: 'Documents', he: 'כספת מסמכים' }, icon: ShieldCheck, groupId: 'system' },
  { id: 'automation', label: { en: 'Automations', he: 'אוטומציה עסקית' }, icon: Zap, groupId: 'system' },
  { id: 'settings', label: { en: 'Settings', he: 'הגדרות' }, icon: Settings, groupId: 'system' },
  { id: 'audit-trail', label: { en: 'Audit Trail', he: 'יומן ביקורת מתקדם' }, icon: Search, groupId: 'system' },
  { id: 'api-hub', label: { en: 'API Platform', he: 'ממשק API' }, icon: TerminalIcon, groupId: 'system' },
  { id: 'system-command-center', label: { en: 'Admin Panel', he: 'Admin Panel' }, icon: Building, groupId: 'admin', requiresOwner: true }
];

export const NAV_GROUPS: Record<string, Record<string, string>> = {
  pulse: { en: 'Dashboard', he: 'ראשי' },
  finance: { en: 'Accounting', he: 'הנהלת חשבונות' },
  operations: { en: 'Business Ops', he: 'תפעול עסקי' },
  planning: { en: 'Reports & Intel', he: 'דוחות ובינה' },
  system: { en: 'Settings & Tools', he: 'הגדרות וכלים' },
  admin: { en: 'Admin Panel', he: 'Admin Panel' }
};

export const getVisibleTabs = (lang: string, isOwner: boolean, hiddenTabs?: string[]) => {
  const groups: Record<string, any[]> = Object.keys(NAV_GROUPS).reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {} as Record<string, any[]>);

  const dynamicGroups: Record<string, any[]> = {};

  APP_TABS.forEach(tab => {
    if (tab.requiresOwner && !isOwner) return;
    if (hiddenTabs && hiddenTabs.includes(tab.id)) return;
    if (tab.groupId === 'hidden') return;
    
    if (groups[tab.groupId || '']) {
      groups[tab.groupId || ''].push({
        id: tab.id,
        label: tab.label[lang] || tab.label['en'],
        icon: tab.icon
      });
    } else {
      if (!dynamicGroups[tab.groupId || '']) dynamicGroups[tab.groupId || ''] = [];
      dynamicGroups[tab.groupId || ''].push({
        id: tab.id,
        label: tab.label[lang] || tab.label['en'],
        icon: tab.icon
      });
    }
  });

  return Object.keys(groups)
    .filter(groupId => groups[groupId].length > 0)
    .map(groupId => ({
      id: groupId,
      label: NAV_GROUPS[groupId] ? (NAV_GROUPS[groupId][lang] || NAV_GROUPS[groupId]['en']) : groupId,
      items: groups[groupId]
    }))
    .concat(
      Object.keys(dynamicGroups).map(groupId => ({
        id: groupId,
        label: groupId,
        items: dynamicGroups[groupId]
      }))
    );
};

export const SYSTEM_GLOSSARY: Record<string, Record<string, string>> = {
  'dashboard.welcome.title': { en: 'Welcome to the System', he: 'ברוכים הבאים למערכת' },
  'dashboard.welcome.subtitle': { en: 'Complete these steps to get your ERP fully operational.', he: 'השלם את השלבים האלה כדי להפעיל את המערכת.' },
  'dashboard.onboarding.step1.title': { en: 'Create Workspace', he: 'צור סביבת עבודה' },
  'dashboard.onboarding.step1.desc': { en: 'Set up your business profile and preferences.', he: 'הגדר את פרופיל העסק שלך והעדפותיך.' },
  'dashboard.onboarding.step2.title': { en: 'Add Bank Accounts', he: 'הוסף חשבונות בנק' },
  'dashboard.onboarding.step2.desc': { en: 'Connect or create asset accounts to track cash flow.', he: 'התחבר או צור חשבונות נכסים.' },
  'dashboard.onboarding.step3.title': { en: 'Create First Invoice', he: 'צור חשבונית ראשונה' },
  'dashboard.onboarding.step3.desc': { en: 'Get paid by your customers and record sales.', he: 'קבל תשלום מהלקוחות שלך ורשום מכירות.' },
  appName: { en: 'LedgerFlow', he: 'לדג׳רפלואו' },
  overview: { en: 'Overview', he: 'סקירה' },
  transactions: { en: 'Transactions', he: 'תנועות' },
  generalLedger: { en: 'General Ledger', he: 'ספר ראשי' },
  trialBalance: { en: 'Trial Balance', he: 'מאזן בוחן' },
  profitAndLoss: { en: 'Profit & Loss', he: 'רווח והפסד' },
  balanceSheet: { en: 'Balance Sheet', he: 'מאזן' },
  reconciliation: { en: 'Reconciliation', he: 'התאמות' },
  settings: { en: 'Settings', he: 'הגדרות' },
  budget: { en: 'Budgets', he: 'תקציבים' },
  secureAuthentication: { en: 'Secure Authentication', he: 'אימות מאובטח' },
  loginWithGoogle: { en: 'Login with Google', he: 'התחברות באמצעות Google' },
  connectingSecureVault: { en: 'Connecting to Secure Vault', he: 'מתחבר לכספת מאובטחת' },
  professionalFinancialManagement: { en: 'Professional financial management for modern business. Smart auditing and reporting.', he: 'ניהול פיננסי מקצועי לעסקים מודרניים. ניהול ביקורת כספיים חכם.' }
};

export interface CommandDefinition {
  id: string;
  label: { en: string; he: string };
  category: string;
  actionId: string;
  payload?: any;
}

export const SYSTEM_COMMANDS: CommandDefinition[] = [
  { id: 'reconcile', label: { en: 'Reconcile Ledger', he: 'התאמת ספר יומן' }, category: 'Operations', actionId: 'start-reconciliation' },
  { id: 'generate-report', label: { en: 'Generate Financial Report', he: 'הפקת דוחות כספיים' }, category: 'Insights', actionId: 'reports' },
  { id: 'calibrate', label: { en: 'Calibrate Volatility', he: 'כיול תנודתיות' }, category: 'System', actionId: 'open-converter' },
  { id: 'quick-entry', label: { en: 'Add New Transaction', he: 'הוספת תנועה חדשה' }, category: 'Operations', actionId: 'quick-entry' },
  { id: 'switch-tab-ledger', label: { en: 'Go to Ledger', he: 'מעבר לספר ראשי' }, category: 'Navigation', actionId: 'switch-tab', payload: { tab: 'ledger' } },
  { id: 'switch-tab-reports', label: { en: 'Go to Reports', he: 'מעבר לדוחות' }, category: 'Navigation', actionId: 'switch-tab', payload: { tab: 'reports' } },
  { id: 'run-audit', label: { en: 'Run Audit Vault', he: 'הרצת ביקורת כספת' }, category: 'System', actionId: 'open-integrity' },
  { id: 'system-center', label: { en: 'Open System Admin Center', he: 'פתיחת מרכז ניהול מערכת' }, category: 'System', actionId: 'open-command-center' },
];

export interface DashboardKpiDefinition {
  id: string;
  title: Record<string, string>;
  icon: any;
  color: 'emerald' | 'rose' | 'azure' | 'amber';
  actionId: string;
  actionPayload?: any;
  valueExtractor: (stats: any) => string;
  trendExtractor: (stats: any) => number;
}

export const DASHBOARD_KPI_REGISTRY: DashboardKpiDefinition[] = [
  {
    id: 'revenue',
    title: { en: 'Total Revenue', he: 'סך הכנסות' },
    icon: TrendingUp,
    color: 'emerald',
    actionId: 'drill-down',
    actionPayload: { type: 'income' },
    valueExtractor: (stats) => stats.revenue,
    trendExtractor: (stats) => stats.revenueTrend
  },
  {
    id: 'expenses',
    title: { en: 'Total Expenses', he: 'סך הוצאות' },
    icon: TrendingDown,
    color: 'rose',
    actionId: 'drill-down',
    actionPayload: { type: 'expense' },
    valueExtractor: (stats) => stats.expenses,
    trendExtractor: (stats) => stats.expensesTrend
  },
  {
    id: 'netCash',
    title: { en: 'Net Cash Flow', he: 'תזרים מזומנים נטו' },
    icon: DollarSign,
    color: 'azure',
    actionId: 'drill-down',
    valueExtractor: (stats) => stats.netCash,
    trendExtractor: (stats) => stats.netCashTrend
  },
  {
    id: 'runway',
    title: { en: 'Current Runway', he: 'תזרים לבנייה גמישה' },
    icon: Calendar,
    color: 'amber',
    actionId: 'switch-tab',
    actionPayload: { tab: 'forecaster' },
    valueExtractor: (stats) => stats.runway + ' Mo',
    trendExtractor: () => 0
  }
];

export const REPORT_COMPONENTS: Record<string, any> = {
  'PNLView': lazy(() => import('../components/reporting/UnifiedReportingMatrix')),
  'BalanceSheetReportView': lazy(() => import('../components/reporting/BalanceSheetReportView')),
  'CashFlowView': lazy(() => import('../components/reporting/CashFlowView')),
  'BudgetActualView': lazy(() => import('../components/reporting/UnifiedReportingMatrix')),
  'TrendsView': lazy(() => import('../components/reporting/UnifiedReportingMatrix')),
  'ProjectVelocityView': lazy(() => import('../components/reporting/UnifiedReportingMatrix')),
  'TaxReportView': lazy(() => import('../components/reporting/UnifiedReportingMatrix'))
};
"""

with open('src/config/registry.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
