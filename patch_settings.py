import re

# BlueprintSettings
try:
    with open('src/components/platform/settings/BlueprintSettings.tsx', 'r') as f:
        content = f.read()

    content = content.replace(
        "{tab.label[language] || tab.label['en']}",
        "{(tab.label && (tab.label[language] || tab.label['en'])) || (tab as any).name || tab.id}"
    )

    with open('src/components/platform/settings/BlueprintSettings.tsx', 'w') as f:
        f.write(content)
except Exception as e:
    print(f"Error updating BlueprintSettings: {e}")

# Settings
try:
    with open('src/components/platform/Settings.tsx', 'r') as f:
        content = f.read()

    content = content.replace(
        "{tab.label[language] || tab.label['en']}",
        "{(tab.label && (tab.label[language] || tab.label['en'])) || (tab as any).name || tab.id}"
    )

    with open('src/components/platform/Settings.tsx', 'w') as f:
        f.write(content)
except Exception as e:
    print(f"Error updating Settings: {e}")

