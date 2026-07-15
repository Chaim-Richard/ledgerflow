with open('src/config/registry.tsx', 'r') as f:
    content = f.read()

content = content.replace("} , PieChart", ", PieChart")
content = content.replace("Receipt ,", "Receipt,")
content = content.replace("Tag } ,", "Tag,")
content = content.replace("} PieChart, Wrench", ", PieChart, Wrench")

with open('src/config/registry.tsx', 'w') as f:
    f.write(content)
