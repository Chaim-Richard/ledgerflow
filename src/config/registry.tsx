/*
 * REGISTRY MAP - HOW TO MODIFY:
 * ---------------------------------
 * - VIEW_COMPONENTS: Register new main components here (lazy loaded).
 * - APP_TABS: Register left sidebar navigation tabs.
 * - NAV_GROUPS: Categorize sidebar tabs into dropdowns.
 * - SYSTEM_COMMANDS: Add new commands for the CMD+K palette.
 * - DASHBOARD_KPI_REGISTRY: Add new top-level dashboard metrics.
 * - ANALYTICAL_LENSES_REGISTRY: Add tools for the Intelligence Center.
 * - *_TABS_REGISTRY: Inner navigation tabs for specific views (Reports, Settings, etc).
 */

import { lazy } from 'react';
import { 
  LayoutGrid, BarChart3, Activity, FileText, Database, Layers, 
  ArrowDownRight, ArrowUpRight, FolderKanban, Users, RefreshCw, 
  ShieldCheck, Terminal as TerminalIcon, Settings, Building, Cpu as CpuIcon,
  Target, Briefcase, Sparkles, CheckCircle2, Leaf,
  TrendingUp, TrendingDown, DollarSign, Calendar, Sliders,
  Home, CreditCard, Clock, FileSignature, Zap, ShoppingCart, Headphones, ShieldAlert, Network, Search, Package, CalendarDays, Star, Globe, Award, Truck, Handshake, ClipboardCheck, GitMerge, Trash2, Scale, Barcode, RotateCcw, Coins, HardHat, Wallet, Filter, MailWarning, Blocks, PackageCheck, ShoppingBag
, Store, Receipt, PenTool as Tool, Tag , PieChart, Wrench, Inbox, BookOpen } from 'lucide-react';

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
  'inventory': lazy(() => import('../components/inventory/Inventory')),
  ...dynamicComponents,
  'dashboard': lazy(() => import('../components/Dashboard')),
  'architecture': lazy(() => import('../components/system/ArchitectureViewer')),
  'intelligence': lazy(() => import('../components/intelligence/IntelligenceCenter')),
  'copilot': lazy(() => import('../components/intelligence/Copilot')),
  'audit': lazy(() => import('../components/forensics/ForensicAudit')),
  'transactions': lazy(() => import('../components/ledger/TransactionGrid')),
  'register': lazy(() => import('../components/finance/AccountRegisterView')),
  'general-ledger': lazy(() => import('../components/ledger/GeneralLedgerView')),
  'statement': lazy(() => import('../components/reporting/StatementView')),
  'payments': lazy(() => import('../components/finance/PaymentsView')),
  'tax-liability': lazy(() => import('../components/reporting/TaxLiabilityView')),
  'estimates': lazy(() => import('../components/sales/EstimatesView')),
  'projects': lazy(() => import('../components/projects/Projects')),
  'reports': lazy(() => import('../components/reporting/Reports')),
  'ledger': lazy(() => import('../components/ledger/TwoLensesLedger')),
  'sales': lazy(() => import('../components/sales/Sales')),
  'purchases': lazy(() => import('../components/purchases/Purchases')),
  'settings': lazy(() => import('../components/platform/Settings')),
  'api-hub': lazy(() => import('../components/platform/ApiHub')),
  'reconciliation': lazy(() => import('../components/ledger/Reconciliation')),
  'banking': lazy(() => import('../components/banking/Banking')),
  'forecaster': lazy(() => import('../components/planning/CashFlowPredictor')),
  'budgets': lazy(() => import('../components/planning/BudgetManager')),
  'time-machine': lazy(() => import('../components/ledger/TimeMachine')),
  'inbox': lazy(() => import('../components/ledger/InboxView')),
  'month-end-close': lazy(() => import('../components/ledger/MonthEndCloseView')),
  'ask': lazy(() => import('../components/ledger/AskLoop')),
  'magic': lazy(() => import('../components/ledger/MagicEntry')),
  'vault': lazy(() => import('../components/forensics/Vault')),
  'audit-trail': lazy(() => import('../components/forensics/AuditTrail')),
  'system-command-center': lazy(() => import('../components/platform/SystemCommandCenter')),
  'consolidation': lazy(() => import('../components/finance/Consolidation')),
  'credit-notes': lazy(() => import('../components/finance/CreditNotesView')),
  'taxes': lazy(() => import('../components/finance/TaxManager')),
  'support': lazy(() => import('../components/support/SupportView')),
  'help': lazy(() => import('../components/support/HelpGuideView')),
  'data-health': lazy(() => import('../components/system/DataHealthView')),
  'charts': lazy(() => import('../components/finance/FinancialChartsDashboard')),
  'query-builder': lazy(() => import('../components/ledger/QueryView')),
};

export interface AppTabDefinition {
  id: string;
  label: Record<string, string>;
  icon: any;
  groupId?: string;
  requiresOwner?: boolean;
  isAdvanced?: boolean;
}

export const APP_TABS: AppTabDefinition[] = [
  { id: 'dashboard', label: { en: 'Overview', he: 'סקירה' }, icon: Home, groupId: 'dashboard' },
  { id: 'inbox', label: { en: 'To Review', he: 'לסקירה' }, icon: Inbox, groupId: 'dashboard' },
  { id: 'copilot', label: { en: 'AI Co-pilot', he: 'טייס משנה' }, icon: Sparkles, groupId: 'dashboard' },

  { id: 'transactions', label: { en: 'Transactions', he: 'תנועות' }, icon: Layers, groupId: 'transactions' },
  { id: 'credit-notes', label: { en: 'Credit Notes & Vendor Credits', he: 'זיכויים וזיכויי ספק' }, icon: RotateCcw, groupId: 'transactions' },
  { id: 'register', label: { en: 'Account Register', he: 'יומן חשבון' }, icon: BookOpen, groupId: 'transactions' },
  { id: 'ledger', label: { en: 'Ledger & Journal', he: 'ספר ראשי ויומן' }, icon: Database, groupId: 'transactions' },
  { id: 'query-builder', label: { en: 'BQL Query Builder', he: 'בונה שאילתות' }, icon: Filter, groupId: 'transactions' },
  { id: 'banking', label: { en: 'Bank Connections', he: 'חיבורי בנק' }, icon: Building, groupId: 'transactions' },
  { id: 'audit-trail', label: { en: 'Audit Trail', he: 'יומן ביקורת' }, icon: Search, groupId: 'transactions' },

  { id: 'reconciliation', label: { en: 'Reconcile', he: 'התאמות' }, icon: RefreshCw, groupId: 'reconcile' },
  { id: 'month-end-close', label: { en: 'Month-End Close', he: 'סגירת חודש' }, icon: ClipboardCheck, groupId: 'reconcile' },

  { id: 'sales', label: { en: 'Sales', he: 'כסף נכנס' }, icon: ArrowUpRight, groupId: 'money_in' },
  { id: 'estimates', label: { en: 'Estimates & Quotes', he: 'הצעות מחיר' }, icon: FileSignature, groupId: 'money_in' },
  { id: 'payments', label: { en: 'Payments', he: 'תשלומים' }, icon: DollarSign, groupId: 'money_in' },
  
  { id: 'purchases', label: { en: 'Purchases', he: 'כסף יוצא' }, icon: ArrowDownRight, groupId: 'money_out' },

  { id: 'reports', label: { en: 'Reports', he: 'דוחות' }, icon: FileText, groupId: 'reports' },
  { id: 'charts', label: { en: 'Visual Analytics', he: 'ניתוח חזותי' }, icon: PieChart, groupId: 'reports' },
  { id: 'forecaster', label: { en: 'Forecasting', he: 'תחזית תזרים' }, icon: TrendingUp, groupId: 'reports' },
  { id: 'intelligence', label: { en: 'Insights', he: 'תובנות' }, icon: BarChart3, groupId: 'reports' },

  { id: 'settings', label: { en: 'Preferences', he: 'הגדרות' }, icon: Settings, groupId: 'settings' },
  { id: 'data-health', label: { en: 'Data Health & Audit', he: 'בריאות נתונים' }, icon: ShieldCheck, groupId: 'settings' },
  { id: 'support', label: { en: 'Support', he: 'תמיכה' }, icon: Headphones, groupId: 'settings' },
  { id: 'help', label: { en: 'Help & Guide', he: 'מדריך ועזרה' }, icon: BookOpen, groupId: 'settings' },
  { id: 'vault', label: { en: 'Documents', he: 'מסמכים' }, icon: ShieldCheck, groupId: 'settings' },
  { id: 'api-hub', label: { en: 'API Platform', he: 'ממשק API' }, icon: TerminalIcon, groupId: 'settings' },
  { id: 'system-command-center', label: { en: 'Admin Panel', he: 'ניהול' }, icon: Building, groupId: 'settings', requiresOwner: true }
];

export const NAV_GROUPS: Record<string, Record<string, string>> = {
  dashboard: { en: 'Dashboard', he: 'לוח בקרה' },
  transactions: { en: 'Transactions', he: 'תנועות' },
  reconcile: { en: 'Reconcile', he: 'התאמות' },
  money_in: { en: 'Money In', he: 'כסף נכנס' },
  money_out: { en: 'Money Out', he: 'כסף יוצא' },
  reports: { en: 'Reports', he: 'דוחות' },
  settings: { en: 'Settings', he: 'הגדרות' }
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
  { id: 'reconcile', label: { en: 'Smart Matching', he: 'התאמות חכמות' }, category: 'Operations', actionId: 'start-reconciliation' },
  { id: 'generate-report', label: { en: 'Financial Reports', he: 'דוחות כספיים' }, category: 'Insights', actionId: 'reports' },
  { id: 'calibrate', label: { en: 'Currency Converter', he: 'המרת מטבעות' }, category: 'System', actionId: 'open-converter' },
  { id: 'quick-entry', label: { en: 'Add New Entry', he: 'הוספת תנועה חדשה' }, category: 'Operations', actionId: 'quick-entry' },
  { id: 'switch-tab-ledger', label: { en: 'Go to General Ledger', he: 'מעבר לספר ראשי' }, category: 'Navigation', actionId: 'switch-tab', payload: { tab: 'ledger' } },
  { id: 'switch-tab-reports', label: { en: 'Go to Financial Reports', he: 'מעבר לדוחות' }, category: 'Navigation', actionId: 'switch-tab', payload: { tab: 'reports' } },
  { id: 'health-check', label: { en: 'Ledger Health Check', he: 'בדיקת בריאות' }, category: 'System', actionId: 'open-health-check' },
  { id: 'run-audit', label: { en: 'Ledger Integrity Auditor', he: 'ביקורת תקינות ספר ראשי' }, category: 'System', actionId: 'open-integrity' },
  { id: 'system-center', label: { en: 'Admin Panel', he: 'פתיחת מרכז ניהול מערכת' }, category: 'System', actionId: 'open-command-center' },
  { id: 'settings-currency', label: { en: 'Change Currency (Settings)', he: 'שינוי מטבע (הגדרות)' }, category: 'Settings', actionId: 'switch-tab', payload: { tab: 'settings', subTab: 'localization' } },
  { id: 'settings-taxes', label: { en: 'Tax Settings', he: 'הגדרות מס' }, category: 'Settings', actionId: 'switch-tab', payload: { tab: 'settings', subTab: 'taxes' } },
  { id: 'settings-team', label: { en: 'Team & Roles', he: 'צוות והרשאות' }, category: 'Settings', actionId: 'switch-tab', payload: { tab: 'settings', subTab: 'team' } },
  { id: 'settings-profile', label: { en: 'User Profile', he: 'פרופיל משתמש' }, category: 'Settings', actionId: 'switch-tab', payload: { tab: 'settings', subTab: 'profile' } }
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
    title: { en: 'Current Runway', he: 'תחזית נזילות' },
    icon: Calendar,
    color: 'amber',
    actionId: 'switch-tab',
    actionPayload: { tab: 'forecaster' },
    valueExtractor: (stats) => stats.runway + ' Mo',
    trendExtractor: () => 0
  }
];

export const REPORT_COMPONENTS: Record<string, any> = {
  'PNLView': lazy(() => import('../components/ledger/ProfitAndLossView')),
  'BalanceSheetReportView': lazy(() => import('../components/ledger/BalanceSheetView')),
  'CashFlowView': lazy(() => import('../components/ledger/CashFlowView')),
  'ARAgingReportView': lazy(() => import('../components/reporting/ARAgingReportView')),
  'APAgingReportView': lazy(() => import('../components/reporting/APAgingReportView')),
  'GeneralLedgerView': lazy(() => import('../components/ledger/GeneralLedgerView')),
  'StatementView': lazy(() => import('../components/reporting/StatementView')),
  'TaxLiabilityView': lazy(() => import('../components/reporting/TaxLiabilityView')),
};

export const ANALYTICAL_LENSES_REGISTRY = [
  { id: 'forensics_1', label: { en: 'Forensic Anomaly Detection', he: 'זיהוי חריגות פיננסיות' }, componentName: 'ToolSandbox' },
  { id: 'forensics_2', label: { en: 'Categorization Consistency Checker', he: 'בדיקת עקביות סיווגים' }, componentName: 'ToolSandbox' }
];

export const LENS_COMPONENTS: Record<string, any> = {
  'ToolSandbox': lazy(() => import('../components/platform/ToolsCatalog'))
};
export const REPORT_TABS_REGISTRY = [
  { id: 'pnl', label: { en: 'Profit & Loss', he: 'רווח והפסד' }, componentName: 'PNLView', icon: Activity },
  { id: 'balance-sheet', label: { en: 'Balance Sheet', he: 'מאזן' }, componentName: 'BalanceSheetReportView', icon: Layers },
  { id: 'cash-flow', label: { en: 'Cash Flow', he: 'תזרים' }, componentName: 'CashFlowView', icon: RefreshCw },
  { id: 'ar-aging', label: { en: 'A/R Aging', he: 'גיול לקוחות' }, componentName: 'ARAgingReportView', icon: Users },
  { id: 'ap-aging', label: { en: 'A/P Aging', he: 'גיול ספקים' }, componentName: 'APAgingReportView', icon: Building },
  { id: 'general-ledger', label: { en: 'General Ledger', he: 'ספר ראשי' }, componentName: 'GeneralLedgerView', icon: BookOpen },
  { id: 'statement', label: { en: 'Account Statement', he: 'דף חשבון' }, componentName: 'StatementView', icon: FileText },
  { id: 'tax-liability', label: { en: 'Sales Tax Liability', he: 'חבות מס קניה' }, componentName: 'TaxLiabilityView', icon: Receipt },
];

export const SETTINGS_TABS_REGISTRY = [
  { id: 'dimensions', label: { en: 'Dimensions & Labels', he: 'ממדים ותגיות' }, componentName: 'DimensionsView', icon: Tag },
  { id: 'appearance', label: { en: 'Appearance & Display', he: 'מראה ותצוגה' }, componentName: 'AppearanceSettingsView', icon: Sliders },
  { id: 'team', label: { en: 'Team & Invites', he: 'צוות והרשאות' }, componentName: 'TeamView', icon: Users },
  { id: 'billing', label: { en: 'Billing & Plan', he: 'תוכניות וחיוב' }, componentName: 'BillingView', icon: CreditCard },
  { id: 'templates', label: { en: 'Custom Templates', he: 'תבניות' }, componentName: 'TemplatesView', icon: FileText },
  { id: 'security', label: { en: 'Security', he: 'אבטחה' }, componentName: 'SecurityView', icon: ShieldCheck },
  { id: 'rule', label: { en: 'AI & Rules', he: 'בינה מלאכותית' }, componentName: 'AISettingsView', icon: CpuIcon },
  { id: 'developer', label: { en: 'Developer', he: 'מפתחים' }, componentName: 'DeveloperView', icon: TerminalIcon },
  { id: 'export', label: { en: 'Backup & Export', he: 'גיבוי וייצוא' }, componentName: 'ExportView', icon: Database },
  { id: 'shortcuts', label: { en: 'Shortcuts', he: 'קיצורי דרך' }, componentName: 'ShortcutsView', icon: Zap }
];

export const SETTINGS_COMPONENTS: Record<string, any> = {
  'DimensionsView': lazy(() => import('../components/platform/settings/DimensionsSettings')),
  'AppearanceSettingsView': lazy(() => import('../components/platform/settings/AppearanceSettings')),
  'TeamView': lazy(() => import('../components/platform/settings/TeamSettings')),
  'BillingView': lazy(() => import('../components/platform/settings/BillingSettings')),
  'TemplatesView': lazy(() => import('../components/platform/settings/BlueprintSettings')),
  'SecurityView': lazy(() => import('../components/platform/settings/SecuritySettings')),
  'AISettingsView': lazy(() => import('../components/platform/settings/AISettings')),
  'DeveloperView': lazy(() => import('../components/platform/settings/DeveloperSettings')),
  'ExportView': lazy(() => import('../components/platform/settings/BackupExportSettings')),
  'ShortcutsView': lazy(() => import('../components/platform/settings/ShortcutSettings'))
};

export const INTELLIGENCE_TABS_REGISTRY = [
  { id: 'intelligence', label: { en: 'Intelligence', he: 'מודיעין' }, componentName: 'UnifiedIntelligenceCore' }
];
