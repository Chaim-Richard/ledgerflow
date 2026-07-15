import re

with open('src/components/reporting/ForensicAuditor.tsx', 'r') as f:
    content = f.read()

# Add useLedgerStore import
if "import { useLedgerStore" not in content:
    content = content.replace("import React,", "import React,\n")
    content = content.replace("import { Transaction }", "import { Transaction }\nimport { useLedgerStore } from '../../stores/useLedgerStore';")

content = re.sub(r'interface ForensicAuditorProps \{[\s\S]*?\}', '', content)
content = re.sub(r'export default function ForensicAuditor\(\{ transactions, isEmbedded = false \}: ForensicAuditorProps\) \{', 'export default function ForensicAuditor({ isEmbedded = false }: { isEmbedded?: boolean }) {\n  const { transactions } = useLedgerStore();', content)

with open('src/components/reporting/ForensicAuditor.tsx', 'w') as f:
    f.write(content)

