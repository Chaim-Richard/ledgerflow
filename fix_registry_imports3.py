with open('src/config/registry.tsx', 'r') as f:
    content = f.read()

content = content.replace("} PieChart, Wrench,\n} from 'lucide-react';", ", PieChart, Wrench } from 'lucide-react';")
content = content.replace(", PenTool as Tool, Tag } , PieChart", ", PenTool as Tool, Tag, PieChart")

with open('src/config/registry.tsx', 'w') as f:
    f.write(content)
