import re

with open('src/config/registry.tsx', 'r') as f:
    content = f.read()

view_components_add = """
  'field-service': lazy(() => import('../components/operations/FieldService')),
  'quality-control': lazy(() => import('../components/operations/QualityControl')),
  'property-manager': lazy(() => import('../components/operations/PropertyManager')),
  'pricing-engine': lazy(() => import('../components/sales/PricingEngine')),
"""

content = content.replace("  'dashboard': lazy(() => import('../components/Dashboard')),", "  'dashboard': lazy(() => import('../components/Dashboard'))," + view_components_add)

app_tabs_add = """
  { id: 'field-service', label: { en: 'Field Service (FSM)', he: 'שירות שטח' }, icon: Tool, groupId: 'operations' },
  { id: 'quality-control', label: { en: 'Quality Control (QA)', he: 'בקרת איכות' }, icon: ShieldCheck, groupId: 'operations' },
  { id: 'property-manager', label: { en: 'Property Manager', he: 'ניהול נכסים' }, icon: Building, groupId: 'operations' },
  { id: 'pricing-engine', label: { en: 'Advanced Pricing', he: 'תמחור מתקדם' }, icon: Tag, groupId: 'operations' },
"""

content = content.replace(
    "{ id: 'api-hub', label: { en: 'API Platform', he: 'ממשק API' }, icon: TerminalIcon, groupId: 'system' },",
    "{ id: 'api-hub', label: { en: 'API Platform', he: 'ממשק API' }, icon: TerminalIcon, groupId: 'system' },\n" + app_tabs_add
)

content = content.replace("from 'lucide-react';", "Tool, Tag,\n} from 'lucide-react';")

with open('src/config/registry.tsx', 'w') as f:
    f.write(content)
