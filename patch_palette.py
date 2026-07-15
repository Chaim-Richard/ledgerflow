with open('src/components/layout/CommandPalette.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "label: `Open: ${lens.label[language] || lens.label['en']}`,",
    "label: `Open: ${(lens.label && lens.label[language]) || (lens.label && lens.label['en']) || lens.name || lens.id}`,"
)

with open('src/components/layout/CommandPalette.tsx', 'w') as f:
    f.write(content)
