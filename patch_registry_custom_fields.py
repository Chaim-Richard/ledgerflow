import re

with open('src/config/registry.tsx', 'r') as f:
    content = f.read()

view_components_add = """
  'custom-fields': lazy(() => import('../components/operations/CustomFieldsManager')),
"""
content = content.replace("  'dashboard': lazy(() => import('../components/Dashboard')),", "  'dashboard': lazy(() => import('../components/Dashboard'))," + view_components_add)

app_tabs_add = """
  { id: 'custom-fields', label: { en: 'Custom Fields & Data', he: 'שדות מותאמים' }, icon: Blocks, groupId: 'system' },
"""

content = content.replace(
    "{ id: 'api-hub', label: { en: 'API Platform', he: 'ממשק API' }, icon: TerminalIcon, groupId: 'system' },",
    "{ id: 'api-hub', label: { en: 'API Platform', he: 'ממשק API' }, icon: TerminalIcon, groupId: 'system' },\n" + app_tabs_add
)

with open('src/config/registry.tsx', 'w') as f:
    f.write(content)
