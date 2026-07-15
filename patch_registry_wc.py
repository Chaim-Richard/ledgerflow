import re

with open('src/config/registry.tsx', 'r') as f:
    content = f.read()

# Import the new component
import_statement = "import WorkCenterRouting from '../components/operations/WorkCenterRouting';\n"
content = import_statement + content

# Add to VIEW_COMPONENTS
view_addition = "  WorkCenterRouting,\n"
content = content.replace("export const VIEW_COMPONENTS = {", "export const VIEW_COMPONENTS = {\n" + view_addition)

# Add to APP_TABS inside the 'Operations' module
operations_idx = content.find("id: 'operations'")
if operations_idx != -1:
    children_idx = content.find("children: [", operations_idx)
    if children_idx != -1:
        insert_idx = children_idx + len("children: [\n")
        lens_addition = """      { id: 'work_centers', label: 'Work Centers & OEE', view: 'WorkCenterRouting' },\n"""
        content = content[:insert_idx] + lens_addition + content[insert_idx:]

with open('src/config/registry.tsx', 'w') as f:
    f.write(content)
