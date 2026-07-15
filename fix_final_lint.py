import re

# Fix lucide imports
with open('src/components/operations/FieldService.tsx', 'r') as f:
    c = f.read()
    c = c.replace('Tool,', 'PenTool as Tool,')
with open('src/components/operations/FieldService.tsx', 'w') as f:
    f.write(c)

with open('src/components/sales/PricingEngine.tsx', 'r') as f:
    c = f.read()
    c = c.replace('Percentage,', 'Percent,')
with open('src/components/sales/PricingEngine.tsx', 'w') as f:
    f.write(c)

with open('src/config/registry.tsx', 'r') as f:
    c = f.read()
    c = c.replace(', Tool,', ', PenTool as Tool,')
    
    # Remove specific object literal duplicates if any are left
    # The error says duplicates at lines 146, 162, 164... I will just run my duplicate remover again
    
    conflicts = [
        r"^\s*'cap-table': lazy.*?\n",
        r"^\s*'factoring': lazy.*?\n",
        r"^\s*'dms': lazy.*?\n",
        r"^\s*'subscription-billing': lazy.*?\n",
        r"^\s*'maintenance': lazy.*?\n",
        r"^\s*'field-service': lazy.*?\n",
        r"^\s*'quality-control': lazy.*?\n",
        r"^\s*'property-manager': lazy.*?\n",
        r"^\s*'pricing-engine': lazy.*?\n",
    ]
    for conflict in conflicts:
        c = re.sub(conflict, '', c, flags=re.MULTILINE)
        
    view_components_add = """
  'cap-table': lazy(() => import('../components/finance/CapTableManager')),
  'factoring': lazy(() => import('../components/finance/FactoringManager')),
  'dms': lazy(() => import('../components/operations/DocumentManager')),
  'subscription-billing': lazy(() => import('../components/sales/SubscriptionBilling')),
  'maintenance': lazy(() => import('../components/operations/MaintenanceManager')),
  'field-service': lazy(() => import('../components/operations/FieldService')),
  'quality-control': lazy(() => import('../components/operations/QualityControl')),
  'property-manager': lazy(() => import('../components/operations/PropertyManager')),
  'pricing-engine': lazy(() => import('../components/sales/PricingEngine')),
"""

    c = c.replace("  'dashboard': lazy(() => import('../components/Dashboard')),", "  'dashboard': lazy(() => import('../components/Dashboard'))," + view_components_add)

with open('src/config/registry.tsx', 'w') as f:
    f.write(c)
