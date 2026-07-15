import re

# IntelligenceCenter
try:
    with open('src/components/intelligence/IntelligenceCenter.tsx', 'r') as f:
        content = f.read()
    
    # fix the typescript error for activeChannelDef.name by casting to any
    content = content.replace(
        "|| activeChannelDef.name || activeChannelDef.id;",
        "|| (activeChannelDef as any).name || activeChannelDef.id;"
    )

    with open('src/components/intelligence/IntelligenceCenter.tsx', 'w') as f:
        f.write(content)
except Exception as e:
    print(f"Error updating IntelligenceCenter: {e}")


# ShortcutOverlay
try:
    with open('src/components/layout/ShortcutOverlay.tsx', 'r') as f:
        content = f.read()

    content = content.replace(
        "{(tab?.label[language] || tab?.label['en'] || tabId).charAt(0)}",
        "{((tab?.label && (tab?.label[language] || tab?.label['en'])) || (tab as any)?.name || tabId).charAt(0)}"
    )

    content = content.replace(
        "{tab ? (tab.label[language] || tab.label['en']) : tabId}",
        "{tab ? ((tab.label && (tab.label[language] || tab.label['en'])) || (tab as any).name || tab.id) : tabId}"
    )

    with open('src/components/layout/ShortcutOverlay.tsx', 'w') as f:
        f.write(content)
except Exception as e:
    print(f"Error updating ShortcutOverlay: {e}")

