with open('src/config/registry.tsx', 'r') as f:
    content = f.read()

content = content.replace("} Tool, Tag,\n} from 'lucide-react';", ", Tool, Tag } from 'lucide-react';")

with open('src/config/registry.tsx', 'w') as f:
    f.write(content)
