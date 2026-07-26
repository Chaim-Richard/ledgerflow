const fs = require('fs');
let code = fs.readFileSync('src/config/registry.tsx', 'utf8');

const newTabs = `export const APP_TABS: AppTabDefinition[] = [
  { id: 'dashboard', label: { en: 'Command Center', he: 'לוח בקרה' }, icon: Home, groupId: 'pulse' },
  { id: 'copilot', label: { en: 'AI Co-pilot', he: 'טייס משנה אינטליגנטי' }, icon: Sparkles, groupId: 'pulse' },
  { id: 'ledger', label: { en: 'Ledger & Journal', he: 'ספר ראשי ויומן' }, icon: Database, groupId: 'finance' },
  { id: 'reconciliation', label: { en: 'Smart Matching', he: 'התאמות חכמות' }, icon: RefreshCw, groupId: 'finance' },
  { id: 'sales', label: { en: 'Invoicing & AR', he: 'כסף נכנס' }, icon: ArrowUpRight, groupId: 'operations' },
  { id: 'purchases', label: { en: 'Bills & AP', he: 'כסף יוצא' }, icon: ArrowDownRight, groupId: 'operations' },
  { id: 'projects', label: { en: 'Project Tracking', he: 'פרויקטים' }, icon: FolderKanban, groupId: 'operations' },
  { id: 'inventory', label: { en: 'Inventory', he: 'מלאי' }, icon: FolderKanban, groupId: 'operations' },
  { id: 'reports', label: { en: 'Financial Reports', he: 'דוחות' }, icon: FileText, groupId: 'planning' },
  { id: 'forecaster', label: { en: 'Cash Forecasting', he: 'תחזית תזרים' }, icon: TrendingUp, groupId: 'planning' },
  { id: 'intelligence', label: { en: 'Advanced Intel', he: 'מודיעין מתקדם' }, icon: BarChart3, groupId: 'planning' },
  { id: 'vault', label: { en: 'Documents', he: 'כספת מסמכים' }, icon: ShieldCheck, groupId: 'system' },
  { id: 'settings', label: { en: 'Settings', he: 'הגדרות' }, icon: Settings, groupId: 'system' },
  { id: 'audit-trail', label: { en: 'Audit Trail', he: 'יומן ביקורת מתקדם' }, icon: Search, groupId: 'system' },
  { id: 'api-hub', label: { en: 'API Platform', he: 'ממשק API' }, icon: TerminalIcon, groupId: 'system' },
  { id: 'system-command-center', label: { en: 'Admin Panel', he: 'Admin Panel' }, icon: Building, groupId: 'admin', requiresOwner: true }
];`;

code = code.replace(/export const APP_TABS: AppTabDefinition\[\] = \[[\s\S]*?\];/, newTabs);
fs.writeFileSync('src/config/registry.tsx', code);
