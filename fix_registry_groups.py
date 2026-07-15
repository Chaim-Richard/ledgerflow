import re

with open('src/config/registry.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('export const APP_TABS: AppTabDefinition[] = [')
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

def replace_group_id(match):
    full_line = match.group(0)
    id_match = re.search(r"id:\s*'([^']+)'", full_line)
    if not id_match:
        return full_line
        
    tab_id = id_match.group(1)
    if tab_id not in core_tabs:
        full_line = re.sub(r"groupId:\s*'[^']+'", "groupId: 'hidden'", full_line)
    return full_line

lines = app_tabs_block.split('\n')
new_lines = []
for line in lines:
    if "id: " in line and "groupId: " in line:
        line = replace_group_id(re.match(r".*", line))
    new_lines.append(line)
    
new_app_tabs_block = '\n'.join(new_lines)
new_app_tabs_block = new_app_tabs_block.replace("id: 'intelligence', label: { en: 'Advanced Intel', he: 'מודיעין מתקדם' }, icon: BarChart3, groupId: 'strategy'", "id: 'intelligence', label: { en: 'Advanced Intel', he: 'מודיעין מתקדם' }, icon: BarChart3, groupId: 'planning'")
new_app_tabs_block = new_app_tabs_block.replace("id: 'vault', label: { en: 'Documents', he: 'כספת מסמכים' }, icon: ShieldCheck, groupId: 'hidden'", "id: 'vault', label: { en: 'Documents', he: 'כספת מסמכים' }, icon: ShieldCheck, groupId: 'system'")
new_app_tabs_block = new_app_tabs_block.replace("id: 'payroll', label: { en: 'Payroll Center', he: 'שכר מרוכז' }, icon: Users, groupId: 'hidden'", "id: 'payroll', label: { en: 'Payroll Center', he: 'שכר מרוכז' }, icon: Users, groupId: 'operations'")
new_app_tabs_block = new_app_tabs_block.replace("id: 'budgeting', label: { en: 'Budgeting & Planning', he: 'תקציב ותכנון' }, icon: Target, groupId: 'hidden'", "id: 'budgeting', label: { en: 'Budgeting & Planning', he: 'תקציב ותכנון' }, icon: Target, groupId: 'planning'")
new_app_tabs_block = new_app_tabs_block.replace("id: 'forecaster', label: { en: 'Cash Forecasting', he: 'תחזית תזרים' }, icon: TrendingUp, groupId: 'hidden'", "id: 'forecaster', label: { en: 'Cash Forecasting', he: 'תחזית תזרים' }, icon: TrendingUp, groupId: 'planning'")
new_app_tabs_block = new_app_tabs_block.replace("id: 'reports', label: { en: 'Financial Reports', he: 'דוחות' }, icon: FileText, groupId: 'hidden'", "id: 'reports', label: { en: 'Financial Reports', he: 'דוחות' }, icon: FileText, groupId: 'planning'")

content = content[:start] + new_app_tabs_block + content[end+2:]

# Now replace NAV_GROUPS if it wasn't replaced yet
nav_groups_block = """export const NAV_GROUPS: Record<string, Record<string, string>> = {
  pulse: { en: 'Dashboard', he: 'ראשי' },
  finance: { en: 'Accounting', he: 'הנהלת חשבונות' },
  operations: { en: 'Business Ops', he: 'תפעול עסקי' },
  planning: { en: 'Reports & Intel', he: 'דוחות ובינה' },
  system: { en: 'Settings & Tools', he: 'הגדרות וכלים' },
  admin: { en: 'Admin Panel', he: 'Admin Panel' }
};"""

nav_start = content.find('export const NAV_GROUPS: Record<string, Record<string, string>> = {')
nav_end = content.find('};', nav_start) + 2
content = content[:nav_start] + nav_groups_block + content[nav_end:]

with open('src/config/registry.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

