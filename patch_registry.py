import re

with open('src/config/registry.tsx', 'r') as f:
    content = f.read()

new_lenses = """  { id: 'erp_0', label: { en: 'Economic Order Quantity (EOQ)', he: 'כמות הזמנה כלכלית' }, componentName: 'ToolSandbox' },
  { id: 'erp_1', label: { en: 'WACC Calculator', he: 'מחשבון WACC' }, componentName: 'ToolSandbox' },
  { id: 'erp_2', label: { en: 'Black-Scholes Options Pricing', he: 'תמחור אופציות' }, componentName: 'ToolSandbox' },
  { id: 'erp_3', label: { en: 'Customer Lifetime Value (CLV)', he: 'ערך חיי לקוח' }, componentName: 'ToolSandbox' },
"""

content = content.replace(
    "export const ANALYTICAL_LENSES_REGISTRY = [",
    "export const ANALYTICAL_LENSES_REGISTRY = [\n" + new_lenses
)

with open('src/config/registry.tsx', 'w') as f:
    f.write(content)
