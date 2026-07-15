with open('src/config/registry.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "{ id: 'dashboard', label: { en: 'Command Center', he: 'לוח בקרה' }, icon: Home, groupId: 'pulse' },",
    "{ id: 'dashboard', label: { en: 'Command Center', he: 'לוח בקרה' }, icon: Home, groupId: 'pulse' },\n  { id: 'architecture', label: { en: 'Dev Hub', he: 'מפת מערכת' }, icon: Network, groupId: 'pulse' },"
)

with open('src/config/registry.tsx', 'w') as f:
    f.write(content)
