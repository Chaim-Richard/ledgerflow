import re

with open('src/config/registry.tsx', 'r') as f:
    content = f.read()

# Add to VIEW_COMPONENTS
content = content.replace("'dashboard': lazy(() => import('../components/Dashboard')),", "'dashboard': lazy(() => import('../components/Dashboard')),\n  'architecture': lazy(() => import('../components/system/ArchitectureViewer')),")

# Add to APP_TABS
# find export const APP_TABS
content = content.replace("{ id: 'dashboard', label: { en: 'Dashboard', he: 'לוח בקרה' }, icon: LayoutGrid, groupId: 'core' },", "{ id: 'dashboard', label: { en: 'Dashboard', he: 'לוח בקרה' }, icon: LayoutGrid, groupId: 'core' },\n  { id: 'architecture', label: { en: 'Architecture Map', he: 'מפת מערכת' }, icon: Network, groupId: 'core' },")

with open('src/config/registry.tsx', 'w') as f:
    f.write(content)
