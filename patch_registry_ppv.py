import re

with open('src/config/registry.tsx', 'r') as f:
    content = f.read()

# Import the new component
import_statement = "import VendorPriceVariance from '../components/finance/VendorPriceVariance';\n"
content = import_statement + content

# Add to VIEW_COMPONENTS
view_addition = "  VendorPriceVariance,\n"
content = content.replace("export const VIEW_COMPONENTS = {", "export const VIEW_COMPONENTS = {\n" + view_addition)

# Add to APP_TABS inside the 'Analytics' module (or Finance)
operations_idx = content.find("id: 'analytics'")
if operations_idx != -1:
    children_idx = content.find("children: [", operations_idx)
    if children_idx != -1:
        insert_idx = children_idx + len("children: [\n")
        lens_addition = """      { id: 'ppv', label: 'Vendor Price Variance', view: 'VendorPriceVariance' },\n"""
        content = content[:insert_idx] + lens_addition + content[insert_idx:]

with open('src/config/registry.tsx', 'w') as f:
    f.write(content)
