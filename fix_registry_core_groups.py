import re

with open('src/config/registry.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('export const APP_TABS: AppTabDefinition[] = [')
end = content.find('];', start)
app_tabs_block = content[start:end+2]

# Ensure taxes is in finance
app_tabs_block = re.sub(r"id: 'taxes'[^}]+groupId:\s*'[^']+'", lambda m: m.group(0).replace(re.search(r"groupId:\s*'[^']+'", m.group(0)).group(0), "groupId: 'finance'"), app_tabs_block)

content = content[:start] + app_tabs_block + content[end+2:]

with open('src/config/registry.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
