with open('src/config/registry.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("lazy(() => import('../components/settings/UnifiedSettingsHub'))", "lazy(() => import('../components/platform/Settings'))")

with open('src/config/registry.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
