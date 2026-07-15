import re

with open('src/config/registry.tsx', 'r') as f:
    content = f.read()

view_components_add = """
  'treasury': lazy(() => import('../components/finance/TreasuryHub')),
  'wealth': lazy(() => import('../components/finance/WealthHub')),
  'tax-nexus': lazy(() => import('../components/finance/SalesTaxNexus')),
"""
content = content.replace("  'dashboard': lazy(() => import('../components/Dashboard')),", "  'dashboard': lazy(() => import('../components/Dashboard'))," + view_components_add)

app_tabs_add = """
  { id: 'treasury', label: { en: 'Corporate Treasury', he: 'גזברות' }, icon: Coins, groupId: 'finance' },
  { id: 'wealth', label: { en: 'Wealth & Portfolio', he: 'ניהול הון' }, icon: Wallet, groupId: 'finance' },
  { id: 'tax-nexus', label: { en: 'Global Tax Nexus', he: 'מס גלובלי' }, icon: Globe, groupId: 'finance' },
"""

content = content.replace(
    "{ id: 'currency-hub', label: { en: 'Multi-Currency', he: 'ריבוי מטבעות' }, icon: Globe, groupId: 'finance' },",
    "{ id: 'currency-hub', label: { en: 'Multi-Currency', he: 'ריבוי מטבעות' }, icon: Globe, groupId: 'finance' },\n" + app_tabs_add
)

with open('src/config/registry.tsx', 'w') as f:
    f.write(content)
