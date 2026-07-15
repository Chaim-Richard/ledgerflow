import re

with open('src/config/registry.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the APP_TABS definition
start = content.find('export const APP_TABS: AppTab[] = [')
end = content.find('];', start)

app_tabs_block = content[start:end+2]

core_tabs = [
    'dashboard', 'copilot', 
    'transactions', 'ledger', 'banking-hub', 'reconciliation', 'taxes', 'assets',
    'sales', 'purchases', 'projects', 'inventory', 'payroll',
    'reports', 'forecaster', 'budgeting', 'intelligence',
    'vault', 'automation', 'settings', 'audit-trail',
    'system-command-center', 'api-hub'
]

# We want to replace groupId: 'xxx' with groupId: 'hidden' if the id is not in core_tabs

def replace_group_id(match):
    full_line = match.group(0)
    id_match = re.search(r"id:\s*'([^']+)'", full_line)
    if not id_match:
        return full_line
        
    tab_id = id_match.group(1)
    if tab_id not in core_tabs:
        # replace groupId: 'whatever' with groupId: 'hidden'
        full_line = re.sub(r"groupId:\s*'[^']+'", "groupId: 'hidden'", full_line)
    return full_line

# Split into lines or use a regex to match each object
lines = app_tabs_block.split('\n')
new_lines = []
for line in lines:
    if "id: " in line and "groupId: " in line:
        line = replace_group_id(re.match(r".*", line))
    new_lines.append(line)
    
new_app_tabs_block = '\n'.join(new_lines)

# Also let's simplify NAV_GROUPS
nav_groups_block = """export const NAV_GROUPS: Record<string, Record<string, string>> = {
  pulse: { en: 'Dashboard', he: 'ראשי' },
  finance: { en: 'Accounting', he: 'הנהלת חשבונות' },
  operations: { en: 'Business Ops', he: 'תפעול עסקי' },
  planning: { en: 'Reports & Intel', he: 'דוחות ובינה' },
  system: { en: 'Settings & Tools', he: 'הגדרות וכלים' },
  admin: { en: 'Admin Panel', he: 'Admin Panel' }
};"""

# We need to replace the old NAV_GROUPS
nav_start = content.find('export const NAV_GROUPS: Record<string, Record<string, string>> = {')
nav_end = content.find('};', nav_start) + 2
content = content[:nav_start] + nav_groups_block + content[nav_end:]

# Now replace APP_TABS
# Wait, let's re-find APP_TABS after string changed
start = content.find('export const APP_TABS: AppTab[] = [')
end = content.find('];', start) + 2
content = content[:start] + new_app_tabs_block + content[end:]

# Let's fix some groups inside core_tabs to match our new NAV_GROUPS
# 'intelligence' -> groupId: 'planning'
# 'reports' -> groupId: 'planning'
# 'forecaster' -> groupId: 'planning'
# 'budgeting' -> groupId: 'planning'
content = re.sub(r"id: 'intelligence'[^}]+groupId:\s*'[^']+'", lambda m: m.group(0).replace(re.search(r"groupId:\s*'[^']+'", m.group(0)).group(0), "groupId: 'planning'"), content)
content = re.sub(r"id: 'vault'[^}]+groupId:\s*'[^']+'", lambda m: m.group(0).replace(re.search(r"groupId:\s*'[^']+'", m.group(0)).group(0), "groupId: 'system'"), content)
content = re.sub(r"id: 'payroll'[^}]+groupId:\s*'[^']+'", lambda m: m.group(0).replace(re.search(r"groupId:\s*'[^']+'", m.group(0)).group(0), "groupId: 'operations'"), content)

with open('src/config/registry.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

