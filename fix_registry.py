import re

with open('src/config/registry.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Just leave the FIRST APP_TABS definition, remove everything after it up to the end of the second APP_TABS definition.
# Wait, actually, let's find the second APP_TABS and remove it.

second_app_tabs_start = content.find('export const APP_TABS: AppTabDefinition[] = [', content.find('export const APP_TABS: AppTabDefinition[] = [') + 10)

if second_app_tabs_start != -1:
    second_app_tabs_end = content.find('];', second_app_tabs_start) + 2
    content = content[:second_app_tabs_start] + content[second_app_tabs_end:]
    
with open('src/config/registry.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
