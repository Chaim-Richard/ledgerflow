with open('src/components/intelligence/IntelligenceCenter.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "const activeChannelName = activeChannelDef.label[language] || activeChannelDef.label['en'];",
    "const activeChannelName = (activeChannelDef.label && (activeChannelDef.label[language] || activeChannelDef.label['en'])) || activeChannelDef.name || activeChannelDef.id;"
)

content = content.replace(
    "{item.label[language] || item.label['en']}",
    "{(item.label && (item.label[language] || item.label['en'])) || item.name || item.id}"
)

content = content.replace(
    "{item.desc[language] || item.desc['en']}",
    "{(item.desc && (item.desc[language] || item.desc['en'])) || item.description || ''}"
)

content = content.replace(
    "<span>{item.label[language] || item.label['en']}</span>",
    "<span>{(item.label && (item.label[language] || item.label['en'])) || item.name || item.id}</span>"
)


with open('src/components/intelligence/IntelligenceCenter.tsx', 'w') as f:
    f.write(content)
