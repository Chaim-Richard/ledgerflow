import re

with open('src/components/reporting/ForensicAuditor.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { Transaction }\nimport { useLedgerStore } from '../../stores/useLedgerStore'; from '../../types';", "import { Transaction } from '../../types';\nimport { useLedgerStore } from '../../stores/useLedgerStore';")

with open('src/components/reporting/ForensicAuditor.tsx', 'w') as f:
    f.write(content)

