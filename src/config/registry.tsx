import { lazy } from 'react';
import { 
  LayoutGrid, BarChart3, Activity, FileText, Database, Layers, 
  ArrowDownRight, ArrowUpRight, FolderKanban, Users, RefreshCw, 
  ShieldCheck, Terminal as TerminalIcon, Settings, Building, Cpu as CpuIcon,
  Target, Briefcase, Sparkles, CheckCircle2,
  TrendingUp, TrendingDown, DollarSign, Calendar, Sliders,
  Home, CreditCard, Clock, FileSignature, Zap, ShoppingCart, Send, Headphones, ShieldAlert, Network, Search, Package, Cloud, Tags, CalendarDays, Star, Globe, Award, Truck, Handshake, ClipboardCheck, GitMerge, Trash2, Scale, Barcode, RotateCcw, Coins, HardHat, Wallet, Filter, MailWarning, Blocks, PackageCheck, ShoppingBag
, Flame } from 'lucide-react';

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
  'audit-vault': lazy(() => import('../components/forensics/AuditVault')),
  'currency': lazy(() => import('../components/finance/CurrencyHub')),
  'vault': lazy(() => import('../components/forensics/Vault')),
  'integrity': lazy(() => import('../components/forensics/SystemIntegrity')),
  'audit-trail': lazy(() => import('../components/forensics/AuditTrail')),
  'matrix': lazy(() => import('../components/reporting/FiscalMatrix')),
  'vendors': lazy(() => import('../components/reporting/VendorPerformance')),
  'customers': lazy(() => import('../components/reporting/CustomerInsights')),
  'consolidated': lazy(() => import('../components/ledger/ConsolidatedLedger')),
  'forensic-anatomy': lazy(() => import('../components/forensics/ForensicAnatomy')),
  'tax-optimizer': lazy(() => import('../components/finance/TaxOptimizer')),
  'global-map': lazy(() => import('../components/finance/GlobalLiquidityMap')),
  'excel-qbo-bridge': lazy(() => import('../components/ledger/ExcelQboBridge')),
  'saas-optimizer': lazy(() => import('../components/finance/SaaSOptimizer')),
  'wealth-hub': lazy(() => import('../components/finance/WealthHub')),
  'split-expenses': lazy(() => import('../components/finance/SplitExpenses')),
  'financial-goals': lazy(() => import('../components/finance/FinancialGoals')),
  'market-multiplier': lazy(() => import('../components/intelligence/MarketMultiplier')),
  'ceo-boardroom': lazy(() => import('../components/intelligence/CEOBoardroom')),
  'treasury-sim': lazy(() => import('../components/planning/TreasurySimulator')),
  'cfo-at-home': lazy(() => import('../components/intelligence/CFOAtHome')),
  'business-oxygen': lazy(() => import('../components/intelligence/BusinessOxygen')),
  'growth-strategy': lazy(() => import('../components/intelligence/GrowthStrategy')),
  'pricing': lazy(() => import('../components/intelligence/PricingOptimizer')),
  'algorithmic-truth': lazy(() => import('../components/intelligence/AlgorithmicTruth')),
  'predictive-maintenance': lazy(() => import('../components/intelligence/DeepPredictiveMaintenance')),
  'smart-reconciliation': lazy(() => import('../components/intelligence/SmartReconciliation')),
  'inventory-eoq': lazy(() => import('../components/intelligence/EconomicOrderQuantity')),
  'ledger-autopilot': lazy(() => import('../components/intelligence/LedgerAutoPilot')),
  'velocity': lazy(() => import('../components/intelligence/NetworkTopology')),
  'command-center': lazy(() => import('../components/layout/CommandCenter')),
  'system-command-center': lazy(() => import('../components/platform/SystemCommandCenter')),
  'split-transaction': lazy(() => import('../components/ledger/SplitTransaction')),
  'expense-capture': lazy(() => import('../components/ledger/ExpenseCapture')),
  'categorization-rules': lazy(() => import('../components/ledger/CategorizationRules')),
  'project-profitability': lazy(() => import('../components/ledger/ProjectProfitabilityView')),
  'class-location-manager': lazy(() => import('../components/ledger/ClassLocationManager')),
  'custom-fields-manager': lazy(() => import('../components/ledger/CustomFieldsManager')),
  'bulk-reclassify': lazy(() => import('../components/ledger/BulkReclassify')),
  'segmented-reporting': lazy(() => import('../components/ledger/SegmentedReporting')),
  'time-tracker': lazy(() => import('../components/projects/TimeTracker')),
  'bank-feeds': lazy(() => import('../components/ledger/BankFeedReconciliation')),
  'proposals': lazy(() => import('../components/sales/SalesProposalHub')),
  'banking-hub': lazy(() => import('../components/finance/TreasuryHub')),
  'automation': lazy(() => import('../components/system/ProcessAutomationHub')),
  'universal-ops': lazy(() => import('../components/operations/UniversalOperations')),
  'property-manager': lazy(() => import('../components/operations/PropertyManager')),
  'manufacturing-hub': lazy(() => import('../components/operations/ManufacturingHub')),
  'sales-crm': lazy(() => import('../components/operations/SalesCRM')),
  'hr-hub': lazy(() => import('../components/operations/HRHub')),
  'helpdesk': lazy(() => import('../components/operations/Helpdesk')),
  'ecommerce': lazy(() => import('../components/operations/ECommerceIntegration')),
  'marketing': lazy(() => import('../components/operations/MarketingAutomation')),
  'credit-control': lazy(() => import('../components/operations/CreditControlHub')),
  'procurement': lazy(() => import('../components/purchases/ProcurementHub')),
  'period-close': lazy(() => import('../components/finance/PeriodCloseManager')),
  'journal-approval': lazy(() => import('../components/ledger/JournalApprovalWorkflow')),
  'inventory-valuation': lazy(() => import('../components/inventory/InventoryValuation')),
  'multi-warehouse': lazy(() => import('../components/operations/MultiWarehouse')),
  'supply-chain': lazy(() => import('../components/operations/SupplyChainControl')),
  'cap-table': lazy(() => import('../components/finance/CapTableManager')),
  'equity-grants': lazy(() => import('../components/finance/EquityGrants')),
  'subscription-billing': lazy(() => import('../components/sales/SubscriptionBilling')),
  'expense-claims': lazy(() => import('../components/operations/ExpenseClaims')),
  'fleet-management': lazy(() => import('../components/operations/FleetManagement')),
  'legal-contracts': lazy(() => import('../components/operations/LegalContracts')),
  'field-service': lazy(() => import('../components/operations/FieldService')),
  'maintenance': lazy(() => import('../components/operations/MaintenanceManager')),
  'quality-control': lazy(() => import('../components/operations/QualityControl')),
  'dms': lazy(() => import('../components/operations/DocumentManager')),
  'leave-management': lazy(() => import('../components/operations/LeaveManagement')),
  'real-estate-leasing': lazy(() => import('../components/operations/RealEstateLeasing')),
  'fixed-assets': lazy(() => import('../components/finance/FixedAssets')),
  'intercompany': lazy(() => import('../components/finance/Intercompany')),
  'budgeting': lazy(() => import('../components/planning/Budgeting')),
  'project-accounting': lazy(() => import('../components/operations/ProjectAccounting')),
  'consolidation': lazy(() => import('../components/finance/Consolidation')),
  'retainers': lazy(() => import('../components/operations/Retainers')),
  'sox-compliance': lazy(() => import('../components/system/SOXCompliance')),
  'approvals-matrix': lazy(() => import('../components/system/ApprovalsMatrix')),
  'factoring': lazy(() => import('../components/finance/FactoringManager')),
  'tags-dimensions': lazy(() => import('../components/finance/TagsDimensions')),
  'capital-budgeting': lazy(() => import('../components/planning/CapitalBudgeting')),
  'webhooks': lazy(() => import('../components/system/WebhookManager')),
  'stock-transfers': lazy(() => import('../components/operations/StockTransfers')),
  'landed-costs': lazy(() => import('../components/finance/LandedCosts')),
  'vendor-scorecards': lazy(() => import('../components/operations/VendorScorecards')),
  'purchase-requisitions': lazy(() => import('../components/operations/PurchaseRequisitions')),
  'expense-policies': lazy(() => import('../components/system/ExpensePolicies')),
  'timesheet-approvals': lazy(() => import('../components/operations/TimesheetApprovals')),
  'shift-scheduling': lazy(() => import('../components/operations/ShiftScheduling')),
  'customer-portal-settings': lazy(() => import('../components/system/CustomerPortalSettings')),
  'equipment-maintenance': lazy(() => import('../components/operations/EquipmentMaintenance')),
  'quality-inspections': lazy(() => import('../components/operations/QualityInspections')),
  'warehouse-locations': lazy(() => import('../components/operations/WarehouseLocations')),
  'manufacturing-routings': lazy(() => import('../components/operations/ManufacturingRoutings')),
  'drop-shipping': lazy(() => import('../components/operations/DropShipping')),
  'expense-budgets': lazy(() => import('../components/planning/ExpenseBudgets')),
  'time-off-manager': lazy(() => import('../components/operations/TimeOffManager')),
  'performance-reviews': lazy(() => import('../components/operations/PerformanceReviews')),
  'customer-contracts': lazy(() => import('../components/operations/CustomerContracts')),
  'lot-tracking': lazy(() => import('../components/operations/LotTracking')),
  'workforce-planning': lazy(() => import('../components/planning/WorkforcePlanning')),
  'subscription-metrics': lazy(() => import('../components/finance/SubscriptionMetrics')),
  'fleet-tracking': lazy(() => import('../components/operations/FleetManagement')),
  'it-helpdesk': lazy(() => import('../components/operations/HelpdeskTicketing')),
  'blanket-orders': lazy(() => import('../components/operations/BlanketOrders')),
  'deferred-revenue': lazy(() => import('../components/finance/DeferredRevenue')),
  'wave-picking': lazy(() => import('../components/operations/WavePicking')),
  'cycle-counts': lazy(() => import('../components/operations/CycleCounts')),
  'bank-matching-rules': lazy(() => import('../components/finance/BankMatchingRules')),
  'asset-disposals': lazy(() => import('../components/finance/AssetDisposals')),
  'landed-cost-variances': lazy(() => import('../components/finance/LandedCostVariances')),
  'serial-number-tracking': lazy(() => import('../components/operations/SerialNumberTracking')),
  'rma-receipts': lazy(() => import('../components/operations/RMAReceipts')),
  'sales-commissions-rules': lazy(() => import('../components/sales/SalesCommissionsRules')),
  'subcontractor-management': lazy(() => import('../components/operations/SubcontractorManagement')),
  'tax-exemption-certificates': lazy(() => import('../components/finance/TaxExemptionCertificates')),
  'crm-pipeline': lazy(() => import('../components/sales/CrmPipeline')),
  'dunning-collections': lazy(() => import('../components/finance/DunningCollections')),
  'customer-statements': lazy(() => import('../components/finance/CustomerStatements')),
  'inventory-assemblies': lazy(() => import('../components/operations/InventoryAssemblies')),
  'sales-order-fulfillment': lazy(() => import('../components/operations/SalesOrderFulfillment')),
  'ecommerce-integrations': lazy(() => import('../components/system/EcommerceIntegrations')),
  'time-and-billing': lazy(() => import('../components/operations/TimeAndBilling')),
  'vendor-prepayments': lazy(() => import('../components/finance/VendorPrepayments')),
};

// 2. Tab Metadata (For Sidebar, Command Palette, etc)
export interface AppTabDefinition {
  id: string;
  label: Record<string, string>; // e.g. { en: "Overview", he: "סקירה" }
  icon: any;
  groupId: string;
  requiresOwner?: boolean;
}

export const APP_TABS: AppTabDefinition[] = [
  ...dynamicTabs,
  
  // Dashboard & Pulse
  { id: 'dashboard', label: { en: 'Command Center', he: 'לוח בקרה' }, icon: Home, groupId: 'pulse' },
  { id: 'business-oxygen', label: { en: 'Cash & Oxygen', he: 'חמצן ותזרים' }, icon: DollarSign, groupId: 'pulse' },
  { id: 'copilot', label: { en: 'AI Co-pilot', he: 'טייס משנה אינטליגנטי' }, icon: Sparkles, groupId: 'pulse' },
  
  // Financial Architecture (Core)
  { id: 'ledger', label: { en: 'General Ledger', he: 'ספר ראשי' }, icon: Database, groupId: 'finance' },
  { id: 'transactions', label: { en: 'Journal Entries', he: 'תנועות' }, icon: Layers, groupId: 'finance' },
  { id: 'journal-approval', label: { en: 'Journal Approvals', he: 'אישורי פקודות יומן' }, icon: ShieldCheck, groupId: 'finance' },
  { id: 'banking-hub', label: { en: 'Treasury & Cash', he: 'מרכז בנקאות' }, icon: Building, groupId: 'finance' },
  { id: 'reconciliation', label: { en: 'Smart Matching', he: 'התאמות חכמות' }, icon: RefreshCw, groupId: 'finance' },
  { id: 'bank-feeds', label: { en: 'Bank Feed Rules', he: 'חוקי בנקים' }, icon: RefreshCw, groupId: 'finance' },
  { id: 'statement-rec', label: { en: 'Bank Rec (Statement)', he: 'התאמת בנק לחשבון' }, icon: CheckCircle2, groupId: 'finance' },
  { id: 'assets', label: { en: 'Fixed Assets', he: 'רכוש קבוע' }, icon: Briefcase, groupId: 'finance' },
  { id: 'fixed-assets', label: { en: 'Asset Register (FAS)', he: 'רכוש קבוע מתקדם' }, icon: Briefcase, groupId: 'finance' },
  { id: 'intercompany', label: { en: 'Intercompany', he: 'בין חברתי' }, icon: Building, groupId: 'finance' },
  { id: 'consolidation', label: { en: 'Consolidation', he: 'איחוד דוחות' }, icon: Layers, groupId: 'finance' },
  { id: 'period-close', label: { en: 'Period Close Manager', he: 'סגירת תקופה' }, icon: ShieldAlert, groupId: 'finance' },

  // Operations & Revenue
  { id: 'universal-ops', label: { en: 'Universal Omni-Tracker', he: 'מעקב אוניברסלי' }, icon: Layers, groupId: 'operations' },
  { id: 'sales-crm', label: { en: 'Sales CRM', he: 'CRM מכירות' }, icon: Users, groupId: 'operations' },
  { id: 'proposals', label: { en: 'Proposals & Quotes', he: 'הצעות מחיר' }, icon: FileSignature, groupId: 'operations' },
  { id: 'sales', label: { en: 'Invoicing & AR', he: 'כסף נכנס' }, icon: ArrowUpRight, groupId: 'operations' },
  { id: 'subscription-billing', label: { en: 'Subscription Billing', he: 'מנויים וחיובים' }, icon: RefreshCw, groupId: 'operations' },
  { id: 'pos', label: { en: 'Point of Sale', he: 'קופה רושמת' }, icon: CreditCard, groupId: 'operations' },
  { id: 'credit-control', label: { en: 'Credit Control (Dunning)', he: 'גבייה ואשראי' }, icon: ShieldAlert, groupId: 'operations' },
  { id: 'purchases', label: { en: 'Bills & AP', he: 'כסף יוצא' }, icon: ArrowDownRight, groupId: 'operations' },
  { id: 'expense-claims', label: { en: 'Expense Claims', he: 'החזרי הוצאות' }, icon: DollarSign, groupId: 'operations' },
  { id: 'procurement', label: { en: 'Procurement (PO)', he: 'רכש' }, icon: Database, groupId: 'operations' },
  { id: 'payroll', label: { en: 'Payroll Center', he: 'שכר מרוכז' }, icon: Users, groupId: 'operations' },
  { id: 'time-tracker', label: { en: 'Time Tracker', he: 'מעקב זמן' }, icon: Clock, groupId: 'operations' },
  { id: 'leave-management', label: { en: 'Leave Management', he: 'ניהול חופשות' }, icon: Calendar, groupId: 'operations' },
  { id: 'projects', label: { en: 'Project Tracking', he: 'פרויקטים' }, icon: FolderKanban, groupId: 'operations' },
  { id: 'project-accounting', label: { en: 'Project Accounting', he: 'הנהלת חשבונות פרויקטים' }, icon: Briefcase, groupId: 'operations' },
  { id: 'field-service', label: { en: 'Field Service', he: 'ניהול טכנאים' }, icon: Target, groupId: 'operations' },
  { id: 'inventory', label: { en: 'Inventory', he: 'מלאי' }, icon: FolderKanban, groupId: 'operations' },
  { id: 'inventory-valuation', label: { en: 'Inventory Valuation', he: 'הערכת שווי מלאי' }, icon: Layers, groupId: 'operations' },
  { id: 'inventory-eoq', label: { en: 'EOQ Optimization', he: 'אופטימיזציית הזמנות' }, icon: Package, groupId: 'operations' },
  { id: 'multi-warehouse', label: { en: 'Multi-Warehouse', he: 'ריבוי מחסנים' }, icon: Building, groupId: 'operations' },
  { id: 'supply-chain', label: { en: 'Supply Chain MRP', he: 'שרשרת אספקה' }, icon: Network, groupId: 'operations' },
  { id: 'fleet-management', label: { en: 'Fleet Management', he: 'ניהול ציי רכב' }, icon: Zap, groupId: 'operations' },
  { id: 'maintenance', label: { en: 'Maintenance & EAM', he: 'תחזוקה' }, icon: Settings, groupId: 'operations' },
  { id: 'quality-control', label: { en: 'Quality Control', he: 'בקרת איכות' }, icon: CheckCircle2, groupId: 'operations' },
  { id: 'property-manager', label: { en: 'Property Manager', he: 'ניהול נכסים' }, icon: Building, groupId: 'operations' },
  { id: 'real-estate-leasing', label: { en: 'Real Estate Leasing', he: 'ניהול השכרות' }, icon: Home, groupId: 'operations' },
  { id: 'manufacturing-hub', label: { en: 'Manufacturing (MRP)', he: 'ייצור' }, icon: CpuIcon, groupId: 'operations' },
  { id: 'legal-contracts', label: { en: 'Legal & Contracts', he: 'חוזים ומשפטים' }, icon: FileSignature, groupId: 'operations' },
  { id: 'dms', label: { en: 'Document Manager', he: 'ניהול מסמכים (DMS)' }, icon: FileText, groupId: 'operations' },

  // Strategy & Growth
  { id: 'ceo-boardroom', label: { en: 'CEO Boardroom', he: 'לשכת מנכ״ל' }, icon: Briefcase, groupId: 'strategy' },
  { id: 'market-multiplier', label: { en: 'Market Multiplier', he: 'מכפיל שווי' }, icon: Target, groupId: 'strategy' },
  { id: 'growth-strategy', label: { en: 'Strategy & ROI', he: 'אסטרטגיה ו-ROI' }, icon: TrendingUp, groupId: 'strategy' },
  { id: 'pricing', label: { en: 'Pricing Optimizer', he: 'תמחור' }, icon: Users, groupId: 'strategy' },
  { id: 'intelligence', label: { en: 'Advanced Intel', he: 'מודיעין מתקדם' }, icon: BarChart3, groupId: 'strategy' },
  { id: 'ledger-autopilot', label: { en: 'Ledger AutoPilot', he: 'טייס אוטומטי' }, icon: Zap, groupId: 'strategy' },
  { id: 'algorithmic-truth', label: { en: 'Algorithmic Truth', he: 'אמת אלגוריתמית' }, icon: Target, groupId: 'strategy' },
  { id: 'predictive-maintenance', label: { en: 'Predictive Maintenance', he: 'תחזוקה חזויה' }, icon: CpuIcon, groupId: 'strategy' },
  { id: 'smart-reconciliation', label: { en: 'Smart Reconciliation', he: 'התאמות חכמות' }, icon: Sparkles, groupId: 'finance' },
  { id: 'wealth-hub', label: { en: 'Wealth Portfolio', he: 'מרכז הון' }, icon: Briefcase, groupId: 'strategy' },
  { id: 'cap-table', label: { en: 'Cap Table Manager', he: 'טבלת הון' }, icon: Users, groupId: 'strategy' },
  { id: 'equity-grants', label: { en: 'Equity Grants', he: 'הקצאת מניות' }, icon: Briefcase, groupId: 'strategy' },

  // Planning & Tax
  { id: 'reports', label: { en: 'Financial Reports', he: 'דוחות' }, icon: FileText, groupId: 'planning' },
  { id: 'forecaster', label: { en: 'Cash Forecasting', he: 'תחזית תזרים' }, icon: TrendingUp, groupId: 'planning' },
  { id: 'budgeting', label: { en: 'Budgeting & Planning', he: 'תקציב ותכנון' }, icon: Target, groupId: 'planning' },
  { id: 'capital-budgeting', label: { en: 'Capital Budgeting (IRR)', he: 'השקעות הון' }, icon: BarChart3, groupId: 'planning' },
  { id: 'segmented-reporting', label: { en: 'Segmented P&L', he: 'רווח והפסד מחלקתי' }, icon: FileText, groupId: 'planning' },
  { id: 'treasury-sim', label: { en: 'Monte Carlo Box', he: 'סימולטור מונטה קרלו' }, icon: Activity, groupId: 'planning' },
  { id: 'taxes', label: { en: 'Tax Management', he: 'ניהול מיסים' }, icon: ShieldCheck, groupId: 'planning' },
  { id: 'tax-optimizer', label: { en: 'Tax Optimizer', he: 'אופטימיזציית מס' }, icon: Target, groupId: 'planning' },

  // System & Vault
  { id: 'automation', label: { en: 'Automations', he: 'אוטומציה עסקית' }, icon: Zap, groupId: 'system' },
  { id: 'vault', label: { en: 'Documents', he: 'כספת מסמכים' }, icon: ShieldCheck, groupId: 'system' },
  { id: 'audit-trail', label: { en: 'Audit Trail', he: 'יומן ביקורת מתקדם' }, icon: Search, groupId: 'system' },
  { id: 'integrity', label: { en: 'Security', he: 'ביקורת מערכת' }, icon: ShieldCheck, groupId: 'system' },
  { id: 'api-hub', label: { en: 'API Platform', he: 'ממשק API' }, icon: TerminalIcon, groupId: 'system' },
  { id: 'excel-qbo-bridge', label: { en: 'Import Data', he: 'יבוא נתונים' }, icon: FileText, groupId: 'system' },
  { id: 'settings', label: { en: 'Settings', he: 'הגדרות' }, icon: Settings, groupId: 'system' },
  { id: 'categorization-rules', label: { en: 'Bank Rules', he: 'חוקים בנקאיים' }, icon: Settings, groupId: 'finance' },
  { id: 'split-transaction', label: { en: 'Split Tool', he: 'פיצול תנועות' }, icon: Settings, groupId: 'finance' },
  { id: 'expense-capture', label: { en: 'Receipt Capture', he: 'סריקת קבלות' }, icon: Settings, groupId: 'operations' },
  { id: 'custom-fields-manager', label: { en: 'Custom Fields', he: 'שדות מותאמים' }, icon: Settings, groupId: 'operations' },
  { id: 'bulk-reclassify', label: { en: 'Bulk Reclassify', he: 'קיטלוג המוני' }, icon: Settings, groupId: 'operations' },
  { id: 'project-profitability', label: { en: 'Project Dashboard', he: 'לוח שעונים לפרויקטים' }, icon: Briefcase, groupId: 'operations' },
  { id: 'class-location-manager', label: { en: 'Classes & Locations', he: 'מחלקות ומיקומים' }, icon: Settings, groupId: 'finance' },
  { id: 'system-command-center', label: { en: 'Admin Panel', he: 'Admin Panel' }, icon: Building, groupId: 'admin', requiresOwner: true },
  { id: 'retainers', label: { en: 'Retainer Management', he: 'ריטיינרים' }, icon: Clock, groupId: 'operations' },
  { id: 'sox-compliance', label: { en: 'SOX Controls', he: 'בקרות SOX' }, icon: ShieldCheck, groupId: 'system' },
  { id: 'approvals-matrix', label: { en: 'Approvals Matrix', he: 'מערך אישורים' }, icon: ShieldCheck, groupId: 'system' },
  { id: 'factoring', label: { en: 'Invoice Factoring', he: 'ניכיון צ׳קים' }, icon: CreditCard, groupId: 'finance' },
  { id: 'tags-dimensions', label: { en: 'Tags & Dimensions', he: 'תיוגים וממדים' }, icon: FolderKanban, groupId: 'finance' },
  { id: 'webhooks', label: { en: 'Webhooks', he: 'Webhooks' }, icon: Zap, groupId: 'system' },
  { id: 'stock-transfers', label: { en: 'Stock Transfers', he: 'העברות מלאי' }, icon: Package, groupId: 'operations' },
  { id: 'landed-costs', label: { en: 'Landed Costs', he: 'עלויות הובלה ומכס' }, icon: Building, groupId: 'finance' },
  { id: 'vendor-scorecards', label: { en: 'Vendor Scorecards', he: 'דירוג ספקים' }, icon: Star, groupId: 'operations' },
  { id: 'purchase-requisitions', label: { en: 'Purchase Requisitions', he: 'דרישות רכש' }, icon: ShoppingCart, groupId: 'operations' },
  { id: 'expense-policies', label: { en: 'Expense Policies', he: 'מדיניות הוצאות' }, icon: ShieldAlert, groupId: 'system' },
  { id: 'timesheet-approvals', label: { en: 'Timesheet Approvals', he: 'אישור שעות' }, icon: Clock, groupId: 'operations' },
  { id: 'shift-scheduling', label: { en: 'Shift Scheduling', he: 'סידור עבודה' }, icon: CalendarDays, groupId: 'operations' },
  { id: 'equipment-maintenance', label: { en: 'Equipment Maintenance', he: 'תחזוקת ציוד' }, icon: Settings, groupId: 'operations' },
  { id: 'quality-inspections', label: { en: 'Quality Inspections', he: 'בקרת איכות ציוד' }, icon: ShieldCheck, groupId: 'operations' },
  { id: 'warehouse-locations', label: { en: 'Bin Locations', he: 'מיקומי מחסן' }, icon: Package, groupId: 'operations' },
  { id: 'manufacturing-routings', label: { en: 'Mfg Routings', he: 'ניתוב ייצור' }, icon: Network, groupId: 'operations' },
  { id: 'drop-shipping', label: { en: 'Drop Shipping', he: 'משלוח ישיר' }, icon: ShoppingCart, groupId: 'operations' },
  { id: 'expense-budgets', label: { en: 'Expense Budgets', he: 'תקציבי הוצאות' }, icon: Target, groupId: 'planning' },
  { id: 'customer-portal-settings', label: { en: 'Customer Portal', he: 'פורטל לקוחות' }, icon: Globe, groupId: 'system' },
  { id: 'time-off-manager', label: { en: 'Time Off (PTO)', he: 'חופשות והיעדרויות' }, icon: Calendar, groupId: 'operations' },
  { id: 'performance-reviews', label: { en: 'Performance Reviews', he: 'הערכות ביצועים' }, icon: Award, groupId: 'operations' },
  { id: 'customer-contracts', label: { en: 'Customer Contracts', he: 'חוזי לקוחות' }, icon: FileSignature, groupId: 'finance' },
  { id: 'lot-tracking', label: { en: 'Lot & Serial Tracking', he: 'מעקב אצוות' }, icon: Package, groupId: 'operations' },
  { id: 'workforce-planning', label: { en: 'Workforce Planning', he: 'תכנון כוח אדם' }, icon: Users, groupId: 'planning' },
  { id: 'subscription-metrics', label: { en: 'SaaS Metrics', he: 'מדדי SaaS' }, icon: TrendingUp, groupId: 'finance' },
  { id: 'fleet-tracking', label: { en: 'Fleet Management', he: 'ניהול ציי רכב' }, icon: Truck, groupId: 'operations' },
  { id: 'it-helpdesk', label: { en: 'IT Helpdesk', he: 'תמיכת IT' }, icon: Headphones, groupId: 'operations' },
  { id: 'blanket-orders', label: { en: 'Blanket POs', he: 'הזמנות מסגרת' }, icon: Handshake, groupId: 'operations' },
  { id: 'deferred-revenue', label: { en: 'Deferred Revenue', he: 'הכנסות נדחות' }, icon: TrendingUp, groupId: 'finance' },
  { id: 'wave-picking', label: { en: 'Wave Picking', he: 'ליקוט גלים' }, icon: Layers, groupId: 'operations' },
  { id: 'cycle-counts', label: { en: 'Cycle Counts', he: 'ספירות מלאי' }, icon: ClipboardCheck, groupId: 'operations' },
  { id: 'bank-matching-rules', label: { en: 'Bank Matching', he: 'כללי התאמה בנקאית' }, icon: GitMerge, groupId: 'finance' },
  { id: 'asset-disposals', label: { en: 'Asset Disposals', he: 'גריטת נכסים' }, icon: Trash2, groupId: 'finance' },
  { id: 'landed-cost-variances', label: { en: 'Landed Cost Variances', he: 'סטיות עלות הובלה' }, icon: Scale, groupId: 'finance' },
  { id: 'serial-number-tracking', label: { en: 'Serial Number Tracking', he: 'מעקב מספרים סידוריים' }, icon: Barcode, groupId: 'operations' },
  { id: 'rma-receipts', label: { en: 'RMA Receipts', he: 'קבלות תשלומים עבור החזרות' }, icon: RotateCcw, groupId: 'operations' },
  { id: 'sales-commissions-rules', label: { en: 'Sales Commissions Rules', he: 'כללי עמלות מכירה' }, icon: Coins, groupId: 'sales' },
  { id: 'subcontractor-management', label: { en: 'Subcontractor Management', he: 'ניהול קבלני משנה' }, icon: HardHat, groupId: 'operations' },
  { id: 'tax-exemption-certificates', label: { en: 'Tax Exemption Certificates', he: 'אישורי פטור ממס' }, icon: ShieldCheck, groupId: 'finance' },
  { id: 'crm-pipeline', label: { en: 'CRM Pipeline', he: 'צנרת מכירות' }, icon: Filter, groupId: 'operations' },
  { id: 'dunning-collections', label: { en: 'Dunning Collections', he: 'גבייה ואכיפה' }, icon: MailWarning, groupId: 'finance' },
  { id: 'customer-statements', label: { en: 'Customer Statements', he: 'דוחות לקוחות' }, icon: FileText, groupId: 'finance' },
  { id: 'inventory-assemblies', label: { en: 'Inventory Assemblies', he: 'הרכבות מלאי' }, icon: Blocks, groupId: 'operations' },
  { id: 'sales-order-fulfillment', label: { en: 'Sales Order Fulfillment', he: 'ליקוט ואריזה להזמנות' }, icon: PackageCheck, groupId: 'operations' },
  { id: 'ecommerce-integrations', label: { en: 'E-commerce Integrations', he: 'אינטגרציות מסחר אלקטרוני' }, icon: ShoppingBag, groupId: 'system' },
  { id: 'time-and-billing', label: { en: 'Time and Billing', he: 'זמן וחיובים' }, icon: Clock, groupId: 'operations' },
  { id: 'vendor-prepayments', label: { en: 'Vendor Prepayments', he: 'מקדמות ספקים' }, icon: Wallet, groupId: 'finance' }
];

export const NAV_GROUPS: Record<string, Record<string, string>> = {
  pulse: { en: 'Dashboard', he: 'ראשי' },
  finance: { en: 'Accounting', he: 'הנהלת חשבונות' },
  operations: { en: 'Business', he: 'עסקים' },
  strategy: { en: 'Intelligence', he: 'בינה' },
  planning: { en: 'Planning', he: 'תכנון' },
  system: { en: 'Settings', he: 'הגדרות' },
  admin: { en: 'Admin Panel', he: 'Admin Panel' }
};

// 3. Helper Functions
export const getVisibleTabs = (lang: string, isOwner: boolean, hiddenTabs?: string[]) => {
  const groups: Record<string, any[]> = Object.keys(NAV_GROUPS).reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {} as Record<string, any[]>);

  // Catch-all for groups not in NAV_GROUPS
  const dynamicGroups: Record<string, any[]> = {};

  APP_TABS.forEach(tab => {
    if (tab.requiresOwner && !isOwner) return;
    if (hiddenTabs && hiddenTabs.includes(tab.id)) return;
    if (tab.groupId === 'hidden') return;
    
    if (groups[tab.groupId]) {
      groups[tab.groupId].push({
        id: tab.id,
        label: tab.label[lang] || tab.label['en'],
        icon: tab.icon
      });
    } else {
      if (!dynamicGroups[tab.groupId]) dynamicGroups[tab.groupId] = [];
      dynamicGroups[tab.groupId].push({
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

// 4. System Vocabulary Glossary (For immediate translation, glossary management, and visual consistency)
export const SYSTEM_GLOSSARY: Record<string, Record<string, string>> = {
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

// 5. System Commands Blueprint (For searchability, command execution mapping, and action dispatching)
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

// 6. Dynamic Dashboard KPI Card Registry
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
  'PNLView': lazy(() => import('../components/reporting/PNLView')),
  'BalanceSheetReportView': lazy(() => import('../components/reporting/BalanceSheetReportView')),
  'CashFlowView': lazy(() => import('../components/reporting/CashFlowView')),
  'BudgetActualView': lazy(() => import('../components/reporting/BudgetActualView')),
  'TrendsView': lazy(() => import('../components/reporting/TrendsView')),
  'ProjectVelocityView': lazy(() => import('../components/reporting/ProjectVelocityView')),
  'TaxReportView': lazy(() => import('../components/reporting/TaxReportView'))
};
export interface ReportTabDefinition {
  id: string;
  label: Record<string, string>;
  icon: any;
  componentName: string;
}

export const REPORT_TABS_REGISTRY: ReportTabDefinition[] = [
  { id: 'pnl', label: { en: 'Profit & Loss', he: 'רווח והפסד' }, icon: TrendingUp, componentName: 'PNLView' },
  { id: 'balance', label: { en: 'Balance Sheet', he: 'מאזן' }, icon: Activity, componentName: 'BalanceSheetReportView' },
  { id: 'cashflow', label: { en: 'Cash Flow', he: 'תזרים מזומנים' }, icon: DollarSign, componentName: 'CashFlowView' },
  { id: 'budget', label: { en: 'Budget vs Actual', he: 'תקציב מול מציאות' }, icon: Target, componentName: 'BudgetActualView' },
  { id: 'trends', label: { en: 'Trends', he: 'מגמות' }, icon: BarChart3, componentName: 'TrendsView' },
  { id: 'projects', label: { en: 'Projects', he: 'פרויקטים' }, icon: LayoutGrid, componentName: 'ProjectVelocityView' },
  { id: 'tax', label: { en: 'Tax Summary', he: 'דו"ח מס' }, icon: ShieldCheck, componentName: 'TaxReportView' }
];

// 8. Analytical Lenses Registry
// 9. Settings Configuration Registry
export interface SettingsTabDefinition {
  id: string;
  label: Record<string, string>;
  icon: any;
  componentName: string; // the sub-component
}

export const SETTINGS_TABS_REGISTRY: SettingsTabDefinition[] = [
  { id: 'billing', label: { en: 'Subscription', he: 'מנויים' }, icon: Target, componentName: 'BillingSettings' },
  { id: 'neural', label: { en: 'Neural', he: 'בינה' }, icon: CpuIcon, componentName: 'NeuralSettings' },
  { id: 'blueprint', label: { en: 'Blueprint Controls', he: 'בקרת קונפיגורציה' }, icon: Sliders, componentName: 'BlueprintSettings' },
  { id: 'developer', label: { en: 'Developer', he: 'מערכת מדור לקוחות' }, icon: TerminalIcon, componentName: 'DeveloperSettings' },
  { id: 'security', label: { en: 'Security', he: 'אבטחה' }, icon: ShieldCheck, componentName: 'SecuritySettings' }
];

export const SETTINGS_COMPONENTS: Record<string, any> = {
  'BillingSettings': lazy(() => import('../components/platform/settings/BillingSettings')),
  'NeuralSettings': lazy(() => import('../components/platform/settings/NeuralSettings')),
  'BlueprintSettings': lazy(() => import('../components/platform/settings/BlueprintSettings')),
  'DeveloperSettings': lazy(() => import('../components/platform/settings/DeveloperSettings')),
  'SecuritySettings': lazy(() => import('../components/platform/settings/SecuritySettings'))
};

// 10. Intelligence Center Tabs Registry
export interface IntelligenceTabDefinition {
  id: string;
  label: Record<string, string>;
  icon: any;
  desc: Record<string, string>;
}

export const INTELLIGENCE_TABS_REGISTRY: IntelligenceTabDefinition[] = [
  { id: 'lenses', label: { en: 'ANALYTICS', he: 'אנליטיקה' }, icon: BarChart3, desc: { en: 'Professional Analysis Suite', he: 'חבילת ניתוח מקצועית' } },
  { id: 'forensics', label: { en: 'AUDIT', he: 'ביקורת' }, icon: ShieldCheck, desc: { en: 'Variance Detection', he: 'מנוע זיהוי חריגות' } },
  { id: 'entities', label: { en: 'ENTITIES', he: 'ישויות' }, icon: Building, desc: { en: 'Group Consolidation', he: 'איחוד קבוצות' } }
];
export interface AnalyticalLensDefinition {
  id: string;
  label: Record<string, string>;
  componentName: string | null;
}

export const ANALYTICAL_LENSES_REGISTRY: AnalyticalLensDefinition[] = [
  { id: 'altmanZScore', label: { en: 'Altman Z Score', he: 'Altman Z Score' }, componentName: 'AltmanZScoreCalculator' },
  { id: 'amortization', label: { en: 'Amortization', he: 'Amortization' }, componentName: 'AmortizationCalculator' },
  { id: 'apy', label: { en: 'Apy', he: 'Apy' }, componentName: 'ApyCalculator' },
  { id: 'assetTurnover', label: { en: 'Asset Turnover', he: 'Asset Turnover' }, componentName: 'AssetTurnoverCalculator' },
  { id: 'autoLoan', label: { en: 'Auto Loan', he: 'Auto Loan' }, componentName: 'AutoLoanCalculator' },
  { id: 'beta', label: { en: 'Beta', he: 'Beta' }, componentName: 'BetaCalculator' },
  { id: 'blackScholes', label: { en: 'Black Scholes', he: 'Black Scholes' }, componentName: 'BlackScholesCalculator' },
  { id: 'bollingerBands', label: { en: 'Bollinger Bands', he: 'Bollinger Bands' }, componentName: 'BollingerBandsCalculator' },
  { id: 'bondPrice', label: { en: 'Bond Price', he: 'Bond Price' }, componentName: 'BondPriceCalculator' },
  { id: 'cacLtv', label: { en: 'Cac Ltv', he: 'Cac Ltv' }, componentName: 'CacLtvCalculator' },
  { id: 'cagr', label: { en: 'Cagr', he: 'Cagr' }, componentName: 'CagrCalculator' },
  { id: 'capitalGains', label: { en: 'Capital Gains', he: 'Capital Gains' }, componentName: 'CapitalGainsCalculator' },
  { id: 'capitalGainsTax', label: { en: 'Capital Gains Tax', he: 'Capital Gains Tax' }, componentName: 'CapitalGainsTaxCalculator' },
  { id: 'capm', label: { en: 'Capm', he: 'Capm' }, componentName: 'CapmCalculator' },
  { id: 'carAffordability', label: { en: 'Car Affordability', he: 'Car Affordability' }, componentName: 'CarAffordabilityCalculator' },
  { id: 'cashOnCash', label: { en: 'Cash On Cash', he: 'Cash On Cash' }, componentName: 'CashOnCashCalculator' },
  { id: 'cashRatio', label: { en: 'Cash Ratio', he: 'Cash Ratio' }, componentName: 'CashRatioCalculator' },
  { id: 'ccc', label: { en: 'Ccc', he: 'Ccc' }, componentName: 'CccCalculator' },
  { id: 'collegeSavings', label: { en: 'College Savings', he: 'College Savings' }, componentName: 'CollegeSavingsCalculator' },
  { id: 'costOfDebt', label: { en: 'Cost Of Debt', he: 'Cost Of Debt' }, componentName: 'CostOfDebtCalculator' },
  { id: 'costOfDelay', label: { en: 'Cost Of Delay', he: 'Cost Of Delay' }, componentName: 'CostOfDelayCalculator' },
  { id: 'dcf', label: { en: 'Dcf', he: 'Dcf' }, componentName: 'DcfCalculator' },
  { id: 'ddm', label: { en: 'Ddm', he: 'Ddm' }, componentName: 'DdmCalculator' },
  { id: 'debtSnowball', label: { en: 'Debt Snowball', he: 'Debt Snowball' }, componentName: 'DebtSnowballCalculator' },
  { id: 'debtToAsset', label: { en: 'Debt To Asset', he: 'Debt To Asset' }, componentName: 'DebtToAssetCalculator' },
  { id: 'debtToCapital', label: { en: 'Debt To Capital', he: 'Debt To Capital' }, componentName: 'DebtToCapitalCalculator' },
  { id: 'debtToEquity', label: { en: 'Debt To Equity', he: 'Debt To Equity' }, componentName: 'DebtToEquityCalculator' },
  { id: 'depreciation', label: { en: 'Depreciation', he: 'Depreciation' }, componentName: 'DepreciationCalculator' },
  { id: 'dfl', label: { en: 'Dfl', he: 'Dfl' }, componentName: 'DflCalculator' },
  { id: 'dio', label: { en: 'Dio', he: 'Dio' }, componentName: 'DioCalculator' },
  { id: 'discount', label: { en: 'Discount', he: 'Discount' }, componentName: 'DiscountCalculator' },
  { id: 'discountYield', label: { en: 'Discount Yield', he: 'Discount Yield' }, componentName: 'DiscountYieldCalculator' },
  { id: 'dividendCoverage', label: { en: 'Dividend Coverage', he: 'Dividend Coverage' }, componentName: 'DividendCoverageCalculator' },
  { id: 'dividendPayout', label: { en: 'Dividend Payout', he: 'Dividend Payout' }, componentName: 'DividendPayoutCalculator' },
  { id: 'dividendYield', label: { en: 'Dividend Yield', he: 'Dividend Yield' }, componentName: 'DividendYieldCalculator' },
  { id: 'dol', label: { en: 'Dol', he: 'Dol' }, componentName: 'DolCalculator' },
  { id: 'dpo', label: { en: 'Dpo', he: 'Dpo' }, componentName: 'DpoCalculator' },
  { id: 'dscr', label: { en: 'Dscr', he: 'Dscr' }, componentName: 'DscrCalculator' },
  { id: 'dso', label: { en: 'Dso', he: 'Dso' }, componentName: 'DsoCalculator' },
  { id: 'dti', label: { en: 'Dti', he: 'Dti' }, componentName: 'DtiCalculator' },
  { id: 'duPontAnalysis', label: { en: 'Du Pont Analysis', he: 'Du Pont Analysis' }, componentName: 'DuPontAnalysisCalculator' },
  { id: 'dupontAnalysis', label: { en: 'Dupont Analysis', he: 'Dupont Analysis' }, componentName: 'DupontAnalysisCalculator' },
  { id: 'earningsYield', label: { en: 'Earnings Yield', he: 'Earnings Yield' }, componentName: 'EarningsYieldCalculator' },
  { id: 'ebitdaValuation', label: { en: 'Ebitda Valuation', he: 'Ebitda Valuation' }, componentName: 'EbitdaValuationCalculator' },
  { id: 'ema', label: { en: 'Ema', he: 'Ema' }, componentName: 'EmaCalculator' },
  { id: 'emergencyFund', label: { en: 'Emergency Fund', he: 'Emergency Fund' }, componentName: 'EmergencyFundCalculator' },
  { id: 'enterpriseValue', label: { en: 'Enterprise Value', he: 'Enterprise Value' }, componentName: 'EnterpriseValueCalculator' },
  { id: 'eps', label: { en: 'Eps', he: 'Eps' }, componentName: 'EpsCalculator' },
  { id: 'epsGrowth', label: { en: 'Eps Growth', he: 'Eps Growth' }, componentName: 'EpsGrowthCalculator' },
  { id: 'equityMultiplier', label: { en: 'Equity Multiplier', he: 'Equity Multiplier' }, componentName: 'EquityMultiplierCalculator' },
  { id: 'equityToAsset', label: { en: 'Equity To Asset', he: 'Equity To Asset' }, componentName: 'EquityToAssetCalculator' },
  { id: 'evEbitda', label: { en: 'Ev Ebitda', he: 'Ev Ebitda' }, componentName: 'EvEbitdaCalculator' },
  { id: 'eva', label: { en: 'Eva', he: 'Eva' }, componentName: 'EvaCalculator' },
  { id: 'expenseRatio', label: { en: 'Expense Ratio', he: 'Expense Ratio' }, componentName: 'ExpenseRatioCalculator' },
  { id: 'fcf', label: { en: 'Fcf', he: 'Fcf' }, componentName: 'FcfCalculator' },
  { id: 'fcfYield', label: { en: 'Fcf Yield', he: 'Fcf Yield' }, componentName: 'FcfYieldCalculator' },
  { id: 'fcfe', label: { en: 'Fcfe', he: 'Fcfe' }, componentName: 'FcfeCalculator' },
  { id: 'fica', label: { en: 'Fica', he: 'Fica' }, componentName: 'FicaCalculator' },
  { id: 'fire', label: { en: 'Fire', he: 'Fire' }, componentName: 'FireCalculator' },
  { id: 'fixedAssetTurnover', label: { en: 'Fixed Asset Turnover', he: 'Fixed Asset Turnover' }, componentName: 'FixedAssetTurnoverCalculator' },
  { id: 'fv', label: { en: 'Fv', he: 'Fv' }, componentName: 'FvCalculator' },
  { id: 'gordonGrowth', label: { en: 'Gordon Growth', he: 'Gordon Growth' }, componentName: 'GordonGrowthCalculator' },
  { id: 'grm', label: { en: 'Grm', he: 'Grm' }, componentName: 'GrmCalculator' },
  { id: 'grossMargin', label: { en: 'Gross Margin', he: 'Gross Margin' }, componentName: 'GrossMarginCalculator' },
  { id: 'houseFlip', label: { en: 'House Flip', he: 'House Flip' }, componentName: 'HouseFlipCalculator' },
  { id: 'inflation', label: { en: 'Inflation', he: 'Inflation' }, componentName: 'InflationCalculator' },
  { id: 'interestCoverage', label: { en: 'Interest Coverage', he: 'Interest Coverage' }, componentName: 'InterestCoverageCalculator' },
  { id: 'inventoryTurnover', label: { en: 'Inventory Turnover', he: 'Inventory Turnover' }, componentName: 'InventoryTurnoverCalculator' },
  { id: 'irr', label: { en: 'Irr', he: 'Irr' }, componentName: 'IrrCalculator' },
  { id: 'leaseVsBuy', label: { en: 'Lease Vs Buy', he: 'Lease Vs Buy' }, componentName: 'LeaseVsBuyCalculator' },
  { id: 'liquidity', label: { en: 'Liquidity', he: 'Liquidity' }, componentName: 'LiquidityCalculator' },
  { id: 'loan', label: { en: 'Loan', he: 'Loan' }, componentName: 'LoanCalculator' },
  { id: 'macaulayDuration', label: { en: 'Macaulay Duration', he: 'Macaulay Duration' }, componentName: 'MacaulayDurationCalculator' },
  { id: 'macd', label: { en: 'Macd', he: 'Macd' }, componentName: 'MacdCalculator' },
  { id: 'marginMarkup', label: { en: 'Margin Markup', he: 'Margin Markup' }, componentName: 'MarginMarkupCalculator' },
  { id: 'marginOfSafety', label: { en: 'Margin Of Safety', he: 'Margin Of Safety' }, componentName: 'MarginOfSafetyCalculator' },
  { id: 'netProfitMargin', label: { en: 'Net Profit Margin', he: 'Net Profit Margin' }, componentName: 'NetProfitMarginCalculator' },
  { id: 'netWorth', label: { en: 'Net Worth', he: 'Net Worth' }, componentName: 'NetWorthCalculator' },
  { id: 'ocfRatio', label: { en: 'Ocf Ratio', he: 'Ocf Ratio' }, componentName: 'OcfRatioCalculator' },
  { id: 'operatingMargin', label: { en: 'Operating Margin', he: 'Operating Margin' }, componentName: 'OperatingMarginCalculator' },
  { id: 'paybackPeriod', label: { en: 'Payback Period', he: 'Payback Period' }, componentName: 'PaybackPeriodCalculator' },
  { id: 'peRatio', label: { en: 'Pe Ratio', he: 'Pe Ratio' }, componentName: 'PeRatioCalculator' },
  { id: 'pegRatio', label: { en: 'Peg Ratio', he: 'Peg Ratio' }, componentName: 'PegRatioCalculator' },
  { id: 'piotroskiFScore', label: { en: 'Piotroski F Score', he: 'Piotroski F Score' }, componentName: 'PiotroskiFScoreCalculator' },
  { id: 'pretaxMargin', label: { en: 'Pretax Margin', he: 'Pretax Margin' }, componentName: 'PretaxMarginCalculator' },
  { id: 'priceToBook', label: { en: 'Price To Book', he: 'Price To Book' }, componentName: 'PriceToBookCalculator' },
  { id: 'priceToCashFlow', label: { en: 'Price To Cash Flow', he: 'Price To Cash Flow' }, componentName: 'PriceToCashFlowCalculator' },
  { id: 'priceToSales', label: { en: 'Price To Sales', he: 'Price To Sales' }, componentName: 'PriceToSalesCalculator' },
  { id: 'profitMargin', label: { en: 'Profit Margin', he: 'Profit Margin' }, componentName: 'ProfitMarginCalculator' },
  { id: 'pv', label: { en: 'Pv', he: 'Pv' }, componentName: 'PvCalculator' },
  { id: 'quickRatio', label: { en: 'Quick Ratio', he: 'Quick Ratio' }, componentName: 'QuickRatioCalculator' },
  { id: 'realInterestRate', label: { en: 'Real Interest Rate', he: 'Real Interest Rate' }, componentName: 'RealInterestRateCalculator' },
  { id: 'rentVsBuy', label: { en: 'Rent Vs Buy', he: 'Rent Vs Buy' }, componentName: 'RentVsBuyCalculator' },
  { id: 'rentalYield', label: { en: 'Rental Yield', he: 'Rental Yield' }, componentName: 'RentalYieldCalculator' },
  { id: 'retentionRatio', label: { en: 'Retention Ratio', he: 'Retention Ratio' }, componentName: 'RetentionRatioCalculator' },
  { id: 'retirement', label: { en: 'Retirement', he: 'Retirement' }, componentName: 'RetirementCalculator' },
  { id: 'rmd', label: { en: 'Rmd', he: 'Rmd' }, componentName: 'RmdCalculator' },
  { id: 'roa', label: { en: 'Roa', he: 'Roa' }, componentName: 'RoaCalculator' },
  { id: 'roe', label: { en: 'Roe', he: 'Roe' }, componentName: 'RoeCalculator' },
  { id: 'roi', label: { en: 'Roi', he: 'Roi' }, componentName: 'RoiCalculator' },
  { id: 'roic', label: { en: 'Roic', he: 'Roic' }, componentName: 'RoicCalculator' },
  { id: 'rsi', label: { en: 'Rsi', he: 'Rsi' }, componentName: 'RsiCalculator' },
  { id: 'ruleOf78', label: { en: 'Rule Of78', he: 'Rule Of78' }, componentName: 'RuleOf78Calculator' },
  { id: 'salaryHourly', label: { en: 'Salary Hourly', he: 'Salary Hourly' }, componentName: 'SalaryHourlyCalculator' },
  { id: 'sharpeRatio', label: { en: 'Sharpe Ratio', he: 'Sharpe Ratio' }, componentName: 'SharpeRatioCalculator' },
  { id: 'sinkingFund', label: { en: 'Sinking Fund', he: 'Sinking Fund' }, componentName: 'SinkingFundCalculator' },
  { id: 'sma', label: { en: 'Sma', he: 'Sma' }, componentName: 'SmaCalculator' },
  { id: 'stockAverage', label: { en: 'Stock Average', he: 'Stock Average' }, componentName: 'StockAverageCalculator' },
  { id: 'sustainableGrowth', label: { en: 'Sustainable Growth', he: 'Sustainable Growth' }, componentName: 'SustainableGrowthCalculator' },
  { id: 'taxEquivalentYield', label: { en: 'Tax Equivalent Yield', he: 'Tax Equivalent Yield' }, componentName: 'TaxEquivalentYieldCalculator' },
  { id: 'tieRatio', label: { en: 'Tie Ratio', he: 'Tie Ratio' }, componentName: 'TieRatioCalculator' },
  { id: 'timesInterestEarned', label: { en: 'Times Interest Earned', he: 'Times Interest Earned' }, componentName: 'TimesInterestEarnedCalculator' },
  { id: 'tip', label: { en: 'Tip', he: 'Tip' }, componentName: 'TipCalculator' },
  { id: 'vat', label: { en: 'Vat', he: 'Vat' }, componentName: 'VatCalculator' },
  { id: 'workingCapital', label: { en: 'Working Capital', he: 'Working Capital' }, componentName: 'WorkingCapitalCalculator' },
  { id: 'ytm', label: { en: 'Ytm', he: 'Ytm' }, componentName: 'YtmCalculator' },
  { id: 'radar', label: { en: 'Metrics Radar', he: 'רדאר בריאות' }, componentName: null },
  { id: 'roi', label: { en: 'ROI Matrix', he: 'מטריצת החזר השקעה' }, componentName: null },
  { id: 'pivot', label: { en: 'Pivot Sheet', he: 'גיליון ציר' }, componentName: 'PivotSheet' },
  { id: 'assets', label: { en: 'Fixed Assets', he: 'רכוש קבוע' }, componentName: 'FixedAssetDepreciation' },
  { id: 'nexus', label: { en: 'Tax Nexus', he: 'מיסוי מקומי' }, componentName: 'SalesTaxNexus' },
  { id: 'ratios', label: { en: 'Financial Ratios', he: 'יחסים פיננסיים' }, componentName: 'FinancialRatios' },
  { id: 'budgets', label: { en: 'Budget Analysis', he: 'ניתוח תקציב' }, componentName: 'BudgetVsActual' },
  { id: 'amortization', label: { en: 'Amortization Tool', he: 'לוח סילוקין' }, componentName: 'AmortizationSchedule' },
  { id: 'currency', label: { en: 'Currency Converter', he: 'המרת מטבעות' }, componentName: 'CurrencyConverter' },
  { id: 'margin', label: { en: 'Margin & Markup', he: 'מחשבון שולי רווח' }, componentName: 'MarginCalculator' },
  { id: 'compound', label: { en: 'Compound Interest', he: 'ריבית דריבית' }, componentName: 'CompoundInterest' },
  { id: 'breakeven', label: { en: 'Break-Even Analysis', he: 'ניתוח נקודת איזון' }, componentName: 'BreakEvenCalculator' },
  { id: 'roas', label: { en: 'ROAS Calculator', he: 'החזר הוצאות פרסום' }, componentName: 'RoasCalculator' },
  { id: 'caprate', label: { en: 'Cap Rate Calculator', he: 'שיעור היוון' }, componentName: 'CapRateCalculator' },
  { id: 'rule72', label: { en: 'Rule of 72', he: 'כלל ה-72' }, componentName: 'RuleOf72Calculator' },
  { id: 'ebitda', label: { en: 'EBITDA Calculator', he: 'מחשבון EBITDA' }, componentName: 'EbitdaCalculator' },
  { id: 'ltv', label: { en: 'LTV Calculator', he: 'מחשבון LTV' }, componentName: 'LtvCalculator' },
  { id: 'npv', label: { en: 'NPV Calculator', he: 'מחשבון NPV' }, componentName: 'NpvCalculator' },
  { id: 'cac', label: { en: 'CAC Calculator', he: 'מחשבון CAC' }, componentName: 'CacCalculator' },
  { id: 'wacc', label: { en: 'WACC Calculator', he: 'מחשבון WACC' }, componentName: 'WaccCalculator' }
];

export const LENS_COMPONENTS: Record<string, any> = {
  'AmortizationCalculator': lazy(() => import('../components/finance/AmortizationCalculator')),
  'ApyCalculator': lazy(() => import('../components/finance/ApyCalculator')),
  'AutoLoanCalculator': lazy(() => import('../components/finance/AutoLoanCalculator')),
  'BlackScholesCalculator': lazy(() => import('../components/finance/BlackScholesCalculator')),
  'CarAffordabilityCalculator': lazy(() => import('../components/finance/CarAffordabilityCalculator')),
  'CashOnCashCalculator': lazy(() => import('../components/finance/CashOnCashCalculator')),
  'CollegeSavingsCalculator': lazy(() => import('../components/finance/CollegeSavingsCalculator')),
  'CostOfDelayCalculator': lazy(() => import('../components/finance/CostOfDelayCalculator')),
  'DdmCalculator': lazy(() => import('../components/finance/DdmCalculator')),
  'DepreciationCalculator': lazy(() => import('../components/finance/DepreciationCalculator')),
  'DiscountCalculator': lazy(() => import('../components/finance/DiscountCalculator')),
  'DtiCalculator': lazy(() => import('../components/finance/DtiCalculator')),
  'EmergencyFundCalculator': lazy(() => import('../components/finance/EmergencyFundCalculator')),
  'ExpenseRatioCalculator': lazy(() => import('../components/finance/ExpenseRatioCalculator')),
  'FicaCalculator': lazy(() => import('../components/finance/FicaCalculator')),
  'FvCalculator': lazy(() => import('../components/finance/FvCalculator')),
  'HouseFlipCalculator': lazy(() => import('../components/finance/HouseFlipCalculator')),
  'InflationCalculator': lazy(() => import('../components/finance/InflationCalculator')),
  'IrrCalculator': lazy(() => import('../components/finance/IrrCalculator')),
  'LeaseVsBuyCalculator': lazy(() => import('../components/finance/LeaseVsBuyCalculator')),
  'LoanCalculator': lazy(() => import('../components/finance/LoanCalculator')),
  'MarginMarkupCalculator': lazy(() => import('../components/finance/MarginMarkupCalculator')),
  'NetWorthCalculator': lazy(() => import('../components/finance/NetWorthCalculator')),
  'PvCalculator': lazy(() => import('../components/finance/PvCalculator')),
  'RentVsBuyCalculator': lazy(() => import('../components/finance/RentVsBuyCalculator')),
  'RentalYieldCalculator': lazy(() => import('../components/finance/RentalYieldCalculator')),
  'RetirementCalculator': lazy(() => import('../components/finance/RetirementCalculator')),
  'RmdCalculator': lazy(() => import('../components/finance/RmdCalculator')),
  'RuleOf78Calculator': lazy(() => import('../components/finance/RuleOf78Calculator')),
  'SalaryHourlyCalculator': lazy(() => import('../components/finance/SalaryHourlyCalculator')),
  'SinkingFundCalculator': lazy(() => import('../components/finance/SinkingFundCalculator')),
  'StockAverageCalculator': lazy(() => import('../components/finance/StockAverageCalculator')),
  'TipCalculator': lazy(() => import('../components/finance/TipCalculator')),
  'VatCalculator': lazy(() => import('../components/finance/VatCalculator')),
  'PivotSheet': lazy(() => import('../components/ledger/PivotSheet')),
  'FixedAssetDepreciation': lazy(() => import('../components/finance/FixedAssetDepreciation')),
  'SalesTaxNexus': lazy(() => import('../components/finance/SalesTaxNexus')),
  'FinancialRatios': lazy(() => import('../components/reporting/FinancialRatios')),
  'BudgetVsActual': lazy(() => import('../components/reporting/BudgetVsActual')),
  'AmortizationSchedule': lazy(() => import('../components/finance/AmortizationSchedule')),
  'CurrencyConverter': lazy(() => import('../components/finance/CurrencyConverter')),
  'MarginCalculator': lazy(() => import('../components/finance/MarginCalculator')),
  'CompoundInterest': lazy(() => import('../components/finance/CompoundInterest')),
  'BreakEvenCalculator': lazy(() => import('../components/finance/BreakEvenCalculator')),
  'RoasCalculator': lazy(() => import('../components/finance/RoasCalculator')),
  'CapRateCalculator': lazy(() => import('../components/finance/CapRateCalculator')),
  'PriceToBookCalculator': lazy(() => import('../components/finance/PriceToBookCalculator')),
  'EnterpriseValueCalculator': lazy(() => import('../components/finance/EnterpriseValueCalculator')),
  'EvEbitdaCalculator': lazy(() => import('../components/finance/EvEbitdaCalculator')),
  'RoicCalculator': lazy(() => import('../components/finance/RoicCalculator')),
  'DividendPayoutCalculator': lazy(() => import('../components/finance/DividendPayoutCalculator')),
  'RuleOf72Calculator': lazy(() => import('../components/finance/RuleOf72Calculator')),
  'WorkingCapitalCalculator': lazy(() => import('../components/finance/WorkingCapitalCalculator')),
  'CapmCalculator': lazy(() => import('../components/finance/CapmCalculator')),
  'RuleOf72Calculator': lazy(() => import('../components/finance/RuleOf72Calculator')),
  'EbitdaCalculator': lazy(() => import('../components/finance/EbitdaCalculator')),
  'LtvCalculator': lazy(() => import('../components/finance/LtvCalculator')),
  'NpvCalculator': lazy(() => import('../components/finance/NpvCalculator')),
  'EbitdaValuationCalculator': lazy(() => import('../components/finance/EbitdaValuationCalculator')),
  'ProfitMarginCalculator': lazy(() => import('../components/finance/ProfitMarginCalculator')),
  'InventoryTurnoverCalculator': lazy(() => import('../components/finance/InventoryTurnoverCalculator')),
  'LiquidityCalculator': lazy(() => import('../components/finance/LiquidityCalculator')),
  'CacLtvCalculator': lazy(() => import('../components/finance/CacLtvCalculator')),
  'DuPontAnalysisCalculator': lazy(() => import('../components/finance/DuPontAnalysisCalculator')),
  'AltmanZScoreCalculator': lazy(() => import('../components/finance/AltmanZScoreCalculator')),
  'PiotroskiFScoreCalculator': lazy(() => import('../components/finance/PiotroskiFScoreCalculator')),
  'DebtToCapitalCalculator': lazy(() => import('../components/finance/DebtToCapitalCalculator')),
  'DscrCalculator': lazy(() => import('../components/finance/DscrCalculator')),
  'EquityToAssetCalculator': lazy(() => import('../components/finance/EquityToAssetCalculator')),
  'CapRateCalculator': lazy(() => import('../components/finance/CapRateCalculator')),
  'TaxEquivalentYieldCalculator': lazy(() => import('../components/finance/TaxEquivalentYieldCalculator')),
  'CapRateCalculator': lazy(() => import('../components/finance/CapRateCalculator')),
  'BondPriceCalculator': lazy(() => import('../components/finance/BondPriceCalculator')),
  'SharpeRatioCalculator': lazy(() => import('../components/finance/SharpeRatioCalculator')),
  'DividendYieldCalculator': lazy(() => import('../components/finance/DividendYieldCalculator')),
  'PeRatioCalculator': lazy(() => import('../components/finance/PeRatioCalculator')),
  'FcfCalculator': lazy(() => import('../components/finance/FcfCalculator')),
  'RoiCalculator': lazy(() => import('../components/finance/RoiCalculator')),
  'PaybackPeriodCalculator': lazy(() => import('../components/finance/PaybackPeriodCalculator')),
  'DebtToEquityCalculator': lazy(() => import('../components/finance/DebtToEquityCalculator')),
  'PriceToBookCalculator': lazy(() => import('../components/finance/PriceToBookCalculator')),
  'WorkingCapitalCalculator': lazy(() => import('../components/finance/WorkingCapitalCalculator')),
  'EvaCalculator': lazy(() => import('../components/finance/EvaCalculator')),
  'DcfCalculator': lazy(() => import('../components/finance/DcfCalculator')),
  'WaccCalculator': lazy(() => import('../components/finance/WaccCalculator')),
  'BreakEvenCalculator': lazy(() => import('../components/finance/BreakEvenCalculator')),
  'RuleOf72Calculator': lazy(() => import('../components/finance/RuleOf72Calculator')),
  'GordonGrowthCalculator': lazy(() => import('../components/finance/GordonGrowthCalculator')),
  'CagrCalculator': lazy(() => import('../components/finance/CagrCalculator')),
  'MarginOfSafetyCalculator': lazy(() => import('../components/finance/MarginOfSafetyCalculator')),
  'PriceToCashFlowCalculator': lazy(() => import('../components/finance/PriceToCashFlowCalculator')),
  'CashRatioCalculator': lazy(() => import('../components/finance/CashRatioCalculator')),
  'GrossMarginCalculator': lazy(() => import('../components/finance/GrossMarginCalculator')),
  'OperatingMarginCalculator': lazy(() => import('../components/finance/OperatingMarginCalculator')),
  'PretaxMarginCalculator': lazy(() => import('../components/finance/PretaxMarginCalculator')),
  'NetProfitMarginCalculator': lazy(() => import('../components/finance/NetProfitMarginCalculator')),
  'DuPontAnalysisCalculator': lazy(() => import('../components/finance/DuPontAnalysisCalculator')),
  'TieRatioCalculator': lazy(() => import('../components/finance/TieRatioCalculator')),
  'EquityMultiplierCalculator': lazy(() => import('../components/finance/EquityMultiplierCalculator')),
  'RetentionRatioCalculator': lazy(() => import('../components/finance/RetentionRatioCalculator')),
  'SustainableGrowthCalculator': lazy(() => import('../components/finance/SustainableGrowthCalculator')),
  'AssetTurnoverCalculator': lazy(() => import('../components/finance/AssetTurnoverCalculator')),
  'InventoryTurnoverCalculator': lazy(() => import('../components/finance/InventoryTurnoverCalculator')),
  'DsoCalculator': lazy(() => import('../components/finance/DsoCalculator')),
  'DioCalculator': lazy(() => import('../components/finance/DioCalculator')),
  'DpoCalculator': lazy(() => import('../components/finance/DpoCalculator')),
  'CccCalculator': lazy(() => import('../components/finance/CccCalculator')),
  'DolCalculator': lazy(() => import('../components/finance/DolCalculator')),
  'DflCalculator': lazy(() => import('../components/finance/DflCalculator')),
  'AltmanZScoreCalculator': lazy(() => import('../components/finance/AltmanZScoreCalculator')),
  'RoeCalculator': lazy(() => import('../components/finance/RoeCalculator')),
  'RoaCalculator': lazy(() => import('../components/finance/RoaCalculator')),
  'CapmCalculator': lazy(() => import('../components/finance/CapmCalculator')),
  'GrossMarginCalculator': lazy(() => import('../components/finance/GrossMarginCalculator')),
  'OperatingMarginCalculator': lazy(() => import('../components/finance/OperatingMarginCalculator')),
  'NetProfitMarginCalculator': lazy(() => import('../components/finance/NetProfitMarginCalculator')),
  'EpsCalculator': lazy(() => import('../components/finance/EpsCalculator')),
  'FcfeCalculator': lazy(() => import('../components/finance/FcfeCalculator')),
  'PegRatioCalculator': lazy(() => import('../components/finance/PegRatioCalculator')),
  'AssetTurnoverCalculator': lazy(() => import('../components/finance/AssetTurnoverCalculator')),
  'InventoryTurnoverCalculator': lazy(() => import('../components/finance/InventoryTurnoverCalculator')),
  'QuickRatioCalculator': lazy(() => import('../components/finance/QuickRatioCalculator')),
  'DebtToAssetCalculator': lazy(() => import('../components/finance/DebtToAssetCalculator')),
  'InterestCoverageCalculator': lazy(() => import('../components/finance/InterestCoverageCalculator')),
  'DscrCalculator': lazy(() => import('../components/finance/DscrCalculator')),
  'TimesInterestEarnedCalculator': lazy(() => import('../components/finance/TimesInterestEarnedCalculator')),
  'EquityMultiplierCalculator': lazy(() => import('../components/finance/EquityMultiplierCalculator')),
  'RetentionRatioCalculator': lazy(() => import('../components/finance/RetentionRatioCalculator')),
  'CapRateCalculator': lazy(() => import('../components/finance/CapRateCalculator')),
  'CccCalculator': lazy(() => import('../components/finance/CccCalculator')),
  'DividendYieldCalculator': lazy(() => import('../components/finance/DividendYieldCalculator')),
  'EarningsYieldCalculator': lazy(() => import('../components/finance/EarningsYieldCalculator')),
  'DupontAnalysisCalculator': lazy(() => import('../components/finance/DupontAnalysisCalculator')),
  'FixedAssetTurnoverCalculator': lazy(() => import('../components/finance/FixedAssetTurnoverCalculator')),
  'GrmCalculator': lazy(() => import('../components/finance/GrmCalculator')),
  'LtvCalculator': lazy(() => import('../components/finance/LtvCalculator')),
  'PriceToBookCalculator': lazy(() => import('../components/finance/PriceToBookCalculator')),
  'PriceToSalesCalculator': lazy(() => import('../components/finance/PriceToSalesCalculator')),
  'YtmCalculator': lazy(() => import('../components/finance/YtmCalculator')),
  'MacaulayDurationCalculator': lazy(() => import('../components/finance/MacaulayDurationCalculator')),
  'RoiCalculator': lazy(() => import('../components/finance/RoiCalculator')),
  'CapitalGainsTaxCalculator': lazy(() => import('../components/finance/CapitalGainsTaxCalculator')),
  'OcfRatioCalculator': lazy(() => import('../components/finance/OcfRatioCalculator')),
  'DiscountYieldCalculator': lazy(() => import('../components/finance/DiscountYieldCalculator')),
  'DividendPayoutCalculator': lazy(() => import('../components/finance/DividendPayoutCalculator')),
  'FcfYieldCalculator': lazy(() => import('../components/finance/FcfYieldCalculator')),
  'SmaCalculator': lazy(() => import('../components/finance/SmaCalculator')),
  'EmaCalculator': lazy(() => import('../components/finance/EmaCalculator')),
  'RsiCalculator': lazy(() => import('../components/finance/RsiCalculator')),
  'DividendCoverageCalculator': lazy(() => import('../components/finance/DividendCoverageCalculator')),
  'EpsGrowthCalculator': lazy(() => import('../components/finance/EpsGrowthCalculator')),
  'BetaCalculator': lazy(() => import('../components/finance/BetaCalculator')),
  'MacdCalculator': lazy(() => import('../components/finance/MacdCalculator')),
  'BollingerBandsCalculator': lazy(() => import('../components/finance/BollingerBandsCalculator')),
  'WaccCalculator': lazy(() => import('../components/finance/WaccCalculator')),
  'CapmCalculator': lazy(() => import('../components/finance/CapmCalculator')),
  'CostOfDebtCalculator': lazy(() => import('../components/finance/CostOfDebtCalculator')),
  'GordonGrowthCalculator': lazy(() => import('../components/finance/GordonGrowthCalculator')),
  'RuleOf72Calculator': lazy(() => import('../components/finance/RuleOf72Calculator')),
  'RealInterestRateCalculator': lazy(() => import('../components/finance/RealInterestRateCalculator')),
  'NpvCalculator': lazy(() => import('../components/finance/NpvCalculator')),
  'MarginOfSafetyCalculator': lazy(() => import('../components/finance/MarginOfSafetyCalculator')),
  'CacCalculator': lazy(() => import('../components/finance/CacCalculator')),
  'WaccCalculator': lazy(() => import('../components/finance/WaccCalculator')),
  'RoicCalculator': lazy(() => import('../components/finance/RoicCalculator')),
  'LtvCalculator': lazy(() => import('../components/finance/LtvCalculator')),
  'FireCalculator': lazy(() => import('../components/finance/FireCalculator')),
  'CapitalGainsCalculator': lazy(() => import('../components/finance/CapitalGainsCalculator')),
  'DebtSnowballCalculator': lazy(() => import('../components/finance/DebtSnowballCalculator'))
};