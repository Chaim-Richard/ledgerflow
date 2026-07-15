import re

with open('src/config/registry.tsx', 'r') as f:
    content = f.read()

view_components_add = """
  'cap-table': lazy(() => import('../components/finance/CapTableManager')),
  'factoring': lazy(() => import('../components/finance/FactoringManager')),
  'dms': lazy(() => import('../components/operations/DocumentManager')),
  'subscription-billing': lazy(() => import('../components/sales/SubscriptionBilling')),
  'maintenance': lazy(() => import('../components/operations/MaintenanceManager')),
"""

content = content.replace("  'dashboard': lazy(() => import('../components/Dashboard')),", "  'dashboard': lazy(() => import('../components/Dashboard'))," + view_components_add)


app_tabs_add = """
  { id: 'cap-table', label: { en: 'Cap Table & Equity', he: 'טבלת הון' }, icon: PieChart, groupId: 'finance' },
  { id: 'factoring', label: { en: 'A/R Factoring', he: 'ניכיון כרטיסים' }, icon: Coins, groupId: 'finance' },
  { id: 'subscription-billing', label: { en: 'Recurring Billing', he: 'חיובים חוזרים' }, icon: RefreshCw, groupId: 'operations' },
  { id: 'dms', label: { en: 'Document Manager (DMS)', he: 'מסמכים' }, icon: FileText, groupId: 'operations' },
  { id: 'maintenance', label: { en: 'Maintenance & EAM', he: 'תחזוקה' }, icon: Wrench, groupId: 'operations' },
"""

content = content.replace(
    "{ id: 'api-hub', label: { en: 'API Platform', he: 'ממשק API' }, icon: TerminalIcon, groupId: 'system' },",
    "{ id: 'api-hub', label: { en: 'API Platform', he: 'ממשק API' }, icon: TerminalIcon, groupId: 'system' },\n" + app_tabs_add
)

content = content.replace("from 'lucide-react';", "PieChart, Wrench,\n} from 'lucide-react';")

with open('src/config/registry.tsx', 'w') as f:
    f.write(content)

