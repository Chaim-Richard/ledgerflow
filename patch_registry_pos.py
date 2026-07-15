import re

with open('src/config/registry.tsx', 'r') as f:
    content = f.read()

view_components_add = """
  'pos': lazy(() => import('../components/sales/PosTerminal')),
"""
content = content.replace("  'dashboard': lazy(() => import('../components/Dashboard')),", "  'dashboard': lazy(() => import('../components/Dashboard'))," + view_components_add)

app_tabs_add = """
  { id: 'pos', label: { en: 'Point of Sale (POS)', he: 'נקודת מכירה' }, icon: Store, groupId: 'operations' },
"""

content = content.replace(
    "{ id: 'sales', label: { en: 'Invoicing & AR', he: 'כסף נכנס' }, icon: ArrowUpRight, groupId: 'operations' },",
    "{ id: 'sales', label: { en: 'Invoicing & AR', he: 'כסף נכנס' }, icon: ArrowUpRight, groupId: 'operations' },\n" + app_tabs_add
)

# Also need to import Store from lucide-react
content = content.replace("from 'lucide-react';", "Store,\n} from 'lucide-react';")

with open('src/config/registry.tsx', 'w') as f:
    f.write(content)
