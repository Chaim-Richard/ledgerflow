import re

with open('src/components/forensics/ForensicAudit.tsx', 'r') as f:
    content = f.read()

# Add useLedgerStore import
if "import { useLedgerStore" not in content:
    content = content.replace("import React,", "import React,\n")
    content = content.replace("import { motion", "import { useLedgerStore } from '../../stores/useLedgerStore';\nimport { motion")

# Remove props from ForensicAudit
content = re.sub(r'interface ForensicAuditProps \{[\s\S]*?\}', '', content)
content = re.sub(r'const ForensicAudit = React.memo\(\(\{ transactions, accounts \}: ForensicAuditProps\) => \{', 'const ForensicAudit = React.memo(() => {\n  const { transactions, accounts } = useLedgerStore();', content)

with open('src/components/forensics/ForensicAudit.tsx', 'w') as f:
    f.write(content)

