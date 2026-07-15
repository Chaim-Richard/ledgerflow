import re

with open('src/config/registry.tsx', 'r') as f:
    content = f.read()

# Delete the specific lines that conflict with my additions
conflicts = [
    r"^\s*'helpdesk': lazy.*?\n",
    r"^\s*'procurement': lazy.*?\n",
    r"^\s*'crm': lazy.*?\n",
    r"^\s*'mrp': lazy.*?\n",
    r"^\s*'fleet': lazy.*?\n",
    r"^\s*'revrec': lazy.*?\n",
    r"^\s*'currency-hub': lazy.*?\n",
    r"^\s*'tax-nexus': lazy.*?\n",
    r"^\s*'treasury': lazy.*?\n",
    r"^\s*'wealth': lazy.*?\n",
    r"^\s*'custom-fields': lazy.*?\n",
    r"^\s*'pos': lazy.*?\n",
    r"^\s*'leave-management': lazy.*?\n",
    r"^\s*'multi-warehouse': lazy.*?\n",
    r"^\s*'expense-claims': lazy.*?\n",
    r"^\s*'ecommerce-integrations': lazy.*?\n",
    r"^\s*'forensics': lazy.*?\n",
    r"^\s*'recruiting': lazy.*?\n"
]

for conflict in conflicts:
    content = re.sub(conflict, '', content, flags=re.MULTILINE)

# Now I'll add my own mappings at the top of VIEW_COMPONENTS
view_components_add = """
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
"""

content = content.replace("  'dashboard': lazy(() => import('../components/Dashboard')),", "  'dashboard': lazy(() => import('../components/Dashboard'))," + view_components_add)


with open('src/config/registry.tsx', 'w') as f:
    f.write(content)
