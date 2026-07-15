with open('src/config/registry.tsx', 'r') as f:
    content = f.read()

content = content.replace("} Store,\n} Receipt,\n} from 'lucide-react';", ", Store, Receipt } from 'lucide-react';")

with open('src/config/registry.tsx', 'w') as f:
    f.write(content)
