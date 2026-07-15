import os

files_to_patch = [
    'src/components/platform/Settings.tsx',
    'src/components/platform/settings/BlueprintSettings.tsx',
    'src/components/platform/settings/ShortcutSettings.tsx',
    'src/components/layout/ShortcutOverlay.tsx',
    'src/components/intelligence/IntelligenceCenter.tsx',
]

for filepath in files_to_patch:
    try:
        with open(filepath, 'r') as f:
            content = f.read()

        # Fix tab.label possibly undefined
        content = content.replace(
            "(tab.label && (tab.label[language] || tab.label['en'])) || (tab as any).name",
            "((tab as any).label?.[language] || (tab as any).label?.['en']) || (tab as any).name"
        )
        
        # In ShortcutOverlay we had some weird replacements
        content = content.replace(
            "((tab?.label && (tab?.label[language] || tab?.label['en'])) || (tab as any)?.name || tabId)",
            "(((tab as any)?.label?.[language] || (tab as any)?.label?.['en']) || (tab as any)?.name || tabId)"
        )
        
        # In IntelligenceCenter we had item.label and item.desc
        content = content.replace(
            "(item.label && (item.label[language] || item.label['en'])) || item.name",
            "((item as any).label?.[language] || (item as any).label?.['en']) || (item as any).name"
        )
        content = content.replace(
            "(item.desc && (item.desc[language] || item.desc['en']))",
            "((item as any).desc?.[language] || (item as any).desc?.['en'])"
        )

        with open(filepath, 'w') as f:
            f.write(content)
            
    except Exception as e:
        print(f"Error updating {filepath}: {e}")

