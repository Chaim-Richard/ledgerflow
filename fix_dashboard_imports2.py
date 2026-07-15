import re

with open('src/components/Dashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r"import \{ useAuthStore \}import \{ useUIStore \} from '\.\./stores/useAuthStore';", "import { useAuthStore } from '../stores/useAuthStore';\nimport { useUIStore } from '../stores/useUIStore';", content)
content = re.sub(r"import \{ useAuthStore \}\nimport \{ useUIStore \} from '\.\./stores/useAuthStore';", "import { useAuthStore } from '../stores/useAuthStore';\nimport { useUIStore } from '../stores/useUIStore';", content)

with open('src/components/Dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
