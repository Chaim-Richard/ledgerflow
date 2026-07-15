import VendorPriceVariance from '../components/finance/VendorPriceVariance';
import WorkCenterRouting from '../components/operations/WorkCenterRouting';
import DemandForecasting from '../components/operations/DemandForecasting';
import MachineLearningOps from '../components/ledger/MachineLearningOps';
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
, Store, Receipt, PenTool as Tool, Tag , PieChart, Wrench } from 'lucide-react';

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
  'system-command-center': lazy(() => import('../components/platform/SystemCommandCenter')),
  'esg-ledger': lazy(() => import('../components/operations/EsgLedger')),
  'autonomous-agents': lazy(() => import('../components/system/AutonomousAgents')),
  'cap-table': lazy(() => import('../components/finance/CapTableManager')),
  'factoring': lazy(() => import('../components/finance/FactoringManager')),
  'dms': lazy(() => import('../components/operations/DocumentManager')),
  'subscription-billing': lazy(() => import('../components/sales/SubscriptionBilling')),
  'maintenance': lazy(() => import('../components/operations/MaintenanceManager')),
  'field-service': lazy(() => import('../components/operations/FieldService')),
  'quality-control': lazy(() => import('../components/operations/QualityControl')),
  'property-manager': lazy(() => import('../components/operations/PropertyManager')),
  'pricing-engine': lazy(() => import('../components/sales/PricingEngine')),


  'crm': lazy(() => import('../components/sales/CrmPipeline')),
  'procurement': lazy(() => import('../components/purchases/PurchasePipeline')),
  'recruiting': lazy(() => import('../components/operations/ApplicantTracking')),
  'mrp': lazy(() => import('../components/operations/ManufacturingBOM')),
  'helpdesk': lazy(() => import('../components/operations/SupportHelpdesk')),
  'fleet': lazy(() => import('../components/operations/FleetLogistics')),
  'revrec': lazy(() => import('../components/finance/RevenueRecognition')),
  'forensics': lazy(() => import('../components/reporting/ForensicAuditor')),
  'currency-hub': lazy(() => import('../components/finance/MultiCurrencyManager')),
  'leave-management': lazy(() => import('../components/operations/LeaveManagement')),
  'multi-warehouse': lazy(() => import('../components/operations/MultiWarehouse')),
  'expense-claims': lazy(() => import('../components/operations/ExpenseClaims')),
  'ecommerce-integrations': lazy(() => import('../components/operations/EcommerceIntegrations')),
  'custom-fields': lazy(() => import('../components/operations/CustomFieldsManager')),
  'pos': lazy(() => import('../components/sales/PosTerminal')),
  'treasury': lazy(() => import('../components/finance/TreasuryHub')),
  'wealth': lazy(() => import('../components/finance/WealthHub')),
  'tax-nexus': lazy(() => import('../components/finance/SalesTaxNexus')),


  'architecture': lazy(() => import('../components/system/ArchitectureViewer')),
  'intelligence': lazy(() => import('../components/intelligence/IntelligenceCenter')),
  'copilot': lazy(() => import('../components/intelligence/Copilot')),
  'audit': lazy(() => import('../components/forensics/ForensicAudit')),
  'transactions': lazy(() => import('../components/ledger/TransactionGrid')),
  '1099-compliance': lazy(() => import('../components/finance/ContractorCompliance')),
  'projects': lazy(() => import('../components/projects/Projects')),
  'reports': lazy(() => import('../components/reporting/Reports')),
  'ledger': lazy(() => import('../components/ledger/Ledger')),
  'sales': lazy(() => import('../components/sales/Sales')),
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
  'manufacturing-hub': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'sales-crm': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'hr-hub': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'ecommerce': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'marketing': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'credit-control': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'period-close': lazy(() => import('../components/finance/PeriodCloseManager')),
  'journal-approval': lazy(() => import('../components/ledger/JournalApprovalWorkflow')),
  'inventory-valuation': lazy(() => import('../components/inventory/InventoryValuation')),
  'supply-chain': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'equity-grants': lazy(() => import('../components/finance/EquityGrants')),
  'fleet-management': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'legal-contracts': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'real-estate-leasing': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'fixed-assets': lazy(() => import('../components/finance/FixedAssets')),
  'intercompany': lazy(() => import('../components/finance/Intercompany')),
  'budgeting': lazy(() => import('../components/planning/Budgeting')),
  'project-accounting': lazy(() => import('../components/operations/ProjectAccounting')),
  'consolidation': lazy(() => import('../components/finance/Consolidation')),
  'retainers': lazy(() => import('../components/operations/UnifiedOperationsHub')),
  'sox-compliance': lazy(() => import('../components/system/SOXCompliance')),
  'approvals-matrix': lazy(() => import('../components/system/ApprovalsMatrix')),
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
  { id: 'architecture', label: { en: 'Dev Hub', he: 'מפת מערכת' }, icon: Network, groupId: 'pulse' },
  { id: 'copilot', label: { en: 'AI Co-pilot', he: 'טייס משנה אינטליגנטי' }, icon: Sparkles, groupId: 'pulse' },
  { id: 'transactions', label: { en: 'Journal Entries', he: 'תנועות' }, icon: Layers, groupId: 'finance' },
  { id: 'ledger', label: { en: 'General Ledger', he: 'ספר ראשי' }, icon: Database, groupId: 'finance' },
  { id: 'banking-hub', label: { en: 'Treasury & Cash', he: 'מרכז בנקאות' }, icon: Building, groupId: 'finance' },
  { id: 'reconciliation', label: { en: 'Smart Matching', he: 'התאמות חכמות' }, icon: RefreshCw, groupId: 'finance' },
  { id: 'assets', label: { en: 'Fixed Assets', he: 'רכוש קבוע' }, icon: Briefcase, groupId: 'finance' },
  { id: 'sales', label: { en: 'Invoicing & AR', he: 'כסף נכנס' }, icon: ArrowUpRight, groupId: 'operations' },

  { id: 'pos', label: { en: 'Point of Sale (POS)', he: 'נקודת מכירה' }, icon: Store, groupId: 'operations' },

  { id: 'purchases', label: { en: 'Bills & AP', he: 'כסף יוצא' }, icon: ArrowDownRight, groupId: 'operations' },
  { id: 'projects', label: { en: 'Project Tracking', he: 'פרויקטים' }, icon: FolderKanban, groupId: 'operations' },

  { id: 'crm', label: { en: 'CRM & Pipeline', he: 'ניהול לקוחות' }, icon: Users, groupId: 'operations' },
  { id: 'mrp', label: { en: 'Manufacturing (MRP)', he: 'ייצור' }, icon: CpuIcon, groupId: 'operations' },
  { id: 'procurement', label: { en: 'Procurement (PO)', he: 'רכש' }, icon: ShoppingCart, groupId: 'operations' },
  { id: 'helpdesk', label: { en: 'Support Helpdesk', he: 'תמיכה' }, icon: Headphones, groupId: 'operations' },
  { id: 'fleet', label: { en: 'Fleet & Logistics', he: 'צי רכב ולוגיסטיקה' }, icon: Truck, groupId: 'operations' },
  { id: 'recruiting', label: { en: 'Applicant Tracking', he: 'גיוס עובדים' }, icon: Briefcase, groupId: 'operations' },
  { id: 'revrec', label: { en: 'Revenue Recognition', he: 'הכרת הכנסה' }, icon: Layers, groupId: 'finance' },
  { id: 'currency-hub', label: { en: 'Multi-Currency', he: 'ריבוי מטבעות' }, icon: Globe, groupId: 'finance' },

  { id: 'treasury', label: { en: 'Corporate Treasury', he: 'גזברות' }, icon: Coins, groupId: 'finance' },
  { id: 'wealth', label: { en: 'Wealth & Portfolio', he: 'ניהול הון' }, icon: Wallet, groupId: 'finance' },
  { id: 'tax-nexus', label: { en: 'Global Tax Nexus', he: 'מס גלובלי' }, icon: Globe, groupId: 'finance' },
  { id: 'consolidation', label: { en: 'Multi-Entity Consolidation', he: 'איחוד חברות' }, icon: Layers, groupId: 'finance' },
  { id: 'autonomous-agents', label: { en: 'Agentic Finance', he: 'סוכנים אוטונומיים' }, icon: CpuIcon, groupId: 'system' },
  { id: 'esg-ledger', label: { en: 'ESG & Carbon Ledger', he: 'פנקס פליטות' }, icon: Leaf, groupId: 'operations' },

  { id: 'forensics', label: { en: 'Forensic Audit', he: 'ביקורת' }, icon: ShieldCheck, groupId: 'system' },

  { id: 'inventory', label: { en: 'Inventory', he: 'מלאי' }, icon: FolderKanban, groupId: 'operations' },
  { id: 'payroll', label: { en: 'Payroll Center', he: 'שכר מרוכז' }, icon: Users, groupId: 'operations' },

  { id: 'leave-management', label: { en: 'HR & Leaves', he: 'חופשות ומשאבי אנוש' }, icon: Users, groupId: 'operations' },
  { id: 'multi-warehouse', label: { en: 'Multi-Warehouse', he: 'ניהול מחסנים' }, icon: Package, groupId: 'operations' },
  { id: 'expense-claims', label: { en: 'Expense Claims', he: 'החזרי הוצאות' }, icon: Receipt, groupId: 'operations' },
  { id: 'ecommerce-integrations', label: { en: 'E-Commerce Hub', he: 'מסחר אלקטרוני' }, icon: ShoppingBag, groupId: 'operations' },

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

  { id: 'cap-table', label: { en: 'Cap Table & Equity', he: 'טבלת הון' }, icon: PieChart, groupId: 'finance' },
  { id: 'factoring', label: { en: 'A/R Factoring', he: 'ניכיון כרטיסים' }, icon: Coins, groupId: 'finance' },
  { id: 'subscription-billing', label: { en: 'Recurring Billing', he: 'חיובים חוזרים' }, icon: RefreshCw, groupId: 'operations' },
  { id: 'dms', label: { en: 'Document Manager (DMS)', he: 'מסמכים' }, icon: FileText, groupId: 'operations' },
  { id: 'maintenance', label: { en: 'Maintenance & EAM', he: 'תחזוקה' }, icon: Wrench, groupId: 'operations' },
  { id: 'system-command-center', label: { en: 'Admin Panel', he: 'Admin Panel' }, icon: Building, groupId: 'admin', requiresOwner: true },


  { id: 'field-service', label: { en: 'Field Service (FSM)', he: 'שירות שטח' }, icon: Tool, groupId: 'operations' },
  { id: 'quality-control', label: { en: 'Quality Control (QA)', he: 'בקרת איכות' }, icon: ShieldCheck, groupId: 'operations' },
  { id: 'property-manager', label: { en: 'Property Manager', he: 'ניהול נכסים' }, icon: Building, groupId: 'operations' },
  { id: 'pricing-engine', label: { en: 'Advanced Pricing', he: 'תמחור מתקדם' }, icon: Tag, groupId: 'operations' },


  { id: 'custom-fields', label: { en: 'Custom Fields & Data', he: 'שדות מותאמים' }, icon: Blocks, groupId: 'system' },

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
  'PNLView': lazy(() => import('../components/ledger/ProfitAndLossView')),
  'BalanceSheetReportView': lazy(() => import('../components/ledger/BalanceSheetView')),
  'CashFlowView': lazy(() => import('../components/ledger/CashFlowView')),
  'BudgetActualView': lazy(() => import('../components/reporting/UnifiedReportingMatrix')),
  'TrendsView': lazy(() => import('../components/reporting/UnifiedReportingMatrix')),
  'ProjectVelocityView': lazy(() => import('../components/reporting/UnifiedReportingMatrix')),
  'TaxReportView': lazy(() => import('../components/reporting/UnifiedReportingMatrix'))
};

export const ANALYTICAL_LENSES_REGISTRY = [
  { id: 'erp_0', label: { en: 'Economic Order Quantity (EOQ)', he: 'כמות הזמנה כלכלית' }, componentName: 'ToolSandbox' },
  { id: 'erp_1', label: { en: 'WACC Calculator', he: 'מחשבון WACC' }, componentName: 'ToolSandbox' },
  { id: 'erp_2', label: { en: 'Black-Scholes Options Pricing', he: 'תמחור אופציות' }, componentName: 'ToolSandbox' },
  { id: 'erp_3', label: { en: 'Customer Lifetime Value (CLV)', he: 'ערך חיי לקוח' }, componentName: 'ToolSandbox' },

  {
    id: 'ml_ops',
    name: 'Machine Learning Auto-Categorization',
    description: 'Monitor and tune Bayesian probability models for bank feed resolution.',
    component: 'MachineLearningOps'
  },

  { id: 'EpsGrowthCalculator', label: { en: 'EPS Growth Calculator', he: 'מחשבון צמיחת EPS' }, componentName: 'EpsGrowthCalculator' },
  { id: 'BetaCalculator', label: { en: 'Beta Calculator', he: 'מחשבון בטא' }, componentName: 'BetaCalculator' },
  { id: 'MacdCalculator', label: { en: 'MACD Calculator', he: 'מחשבון MACD' }, componentName: 'MacdCalculator' }
];

export const LENS_COMPONENTS: Record<string, any> = {
  'EpsGrowthCalculator': VIEW_COMPONENTS['EpsGrowthCalculator'],
  'BetaCalculator': VIEW_COMPONENTS['BetaCalculator'],
  'MacdCalculator': VIEW_COMPONENTS['MacdCalculator'],
  'BollingerBandsCalculator': VIEW_COMPONENTS['BollingerBandsCalculator'],
  'CostOfDebtCalculator': VIEW_COMPONENTS['CostOfDebtCalculator'],
  'RealInterestRateCalculator': VIEW_COMPONENTS['RealInterestRateCalculator'],
  'CacCalculator': VIEW_COMPONENTS['CacCalculator'],
  'FireCalculator': VIEW_COMPONENTS['FireCalculator'],
  'CapitalGainsCalculator': VIEW_COMPONENTS['CapitalGainsCalculator'],
  'DebtSnowballCalculator': VIEW_COMPONENTS['DebtSnowballCalculator']
};

export const REPORT_TABS_REGISTRY = [
  { id: 'pnl', label: { en: 'Profit & Loss', he: 'רווח והפסד' }, componentName: 'PNLView', icon: Activity },
  { id: 'balance-sheet', label: { en: 'Balance Sheet', he: 'מאזן' }, componentName: 'BalanceSheetReportView', icon: Layers },
  { id: 'cash-flow', label: { en: 'Cash Flow', he: 'תזרים' }, componentName: 'CashFlowView', icon: RefreshCw },
  { id: 'budget-actual', label: { en: 'Budget vs Actual', he: 'תקציב מול ביצוע' }, componentName: 'BudgetActualView', icon: Target }
];

export const SETTINGS_TABS_REGISTRY = [
  { id: 'billing', label: { en: 'Billing & Plan', he: 'תוכניות וחיוב' }, componentName: 'BillingView', icon: CreditCard },
  { id: 'templates', label: { en: 'Custom Templates', he: 'תבניות' }, componentName: 'TemplatesView', icon: FileText }
];

export const SETTINGS_COMPONENTS: Record<string, any> = {
  'BillingView': lazy(() => import('../components/platform/Settings')),
  'TemplatesView': lazy(() => import('../components/platform/Settings'))
};

export const INTELLIGENCE_TABS_REGISTRY = [
  { id: 'intelligence', label: { en: 'Intelligence', he: 'מודיעין' }, componentName: 'UnifiedIntelligenceCore' }
];
