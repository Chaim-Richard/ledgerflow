import re

with open('src/components/platform/settings/ShortcutSettings.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "{tab.label[language] || tab.label['en']}",
    "{(tab.label && (tab.label[language] || tab.label['en'])) || (tab as any).name || tab.id}"
)

content = content.replace(
    "{tab ? (tab.label[language] || tab.label['en']) : tabId}",
    "{tab ? ((tab.label && (tab.label[language] || tab.label['en'])) || (tab as any).name || tab.id) : tabId}"
)

with open('src/components/platform/settings/ShortcutSettings.tsx', 'w') as f:
    f.write(content)

