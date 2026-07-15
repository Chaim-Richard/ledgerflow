import re

with open('src/config/registry.tsx', 'r') as f:
    content = f.read()

view_components_add = """
  'leave-management': lazy(() => import('../components/operations/LeaveManagement')),
  'multi-warehouse': lazy(() => import('../components/operations/MultiWarehouse')),
  'expense-claims': lazy(() => import('../components/operations/ExpenseClaims')),
  'ecommerce-integrations': lazy(() => import('../components/operations/EcommerceIntegrations')),
"""
content = content.replace("  'dashboard': lazy(() => import('../components/Dashboard')),", "  'dashboard': lazy(() => import('../components/Dashboard'))," + view_components_add)

app_tabs_add = """
  { id: 'leave-management', label: { en: 'HR & Leaves', he: 'חופשות ומשאבי אנוש' }, icon: Users, groupId: 'operations' },
  { id: 'multi-warehouse', label: { en: 'Multi-Warehouse', he: 'ניהול מחסנים' }, icon: Package, groupId: 'operations' },
  { id: 'expense-claims', label: { en: 'Expense Claims', he: 'החזרי הוצאות' }, icon: Receipt, groupId: 'operations' },
  { id: 'ecommerce-integrations', label: { en: 'E-Commerce Hub', he: 'מסחר אלקטרוני' }, icon: ShoppingBag, groupId: 'operations' },
"""

content = content.replace(
    "{ id: 'payroll', label: { en: 'Payroll Center', he: 'שכר מרוכז' }, icon: Users, groupId: 'operations' },",
    "{ id: 'payroll', label: { en: 'Payroll Center', he: 'שכר מרוכז' }, icon: Users, groupId: 'operations' },\n" + app_tabs_add
)

content = content.replace("from 'lucide-react';", "Receipt,\n} from 'lucide-react';")

with open('src/config/registry.tsx', 'w') as f:
    f.write(content)
