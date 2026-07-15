import re

with open('src/components/forensics/ForensicAudit.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { format } from 'date-fns';", "import { format } from 'date-fns';\nimport { useLedgerStore } from '../../stores/useLedgerStore';")
content = content.replace("(sum, l) => sum + (l.amountCents as number || 0)", "(sum: number, l: any) => sum + (l.amountCents as number || 0)")
content = content.replace("(sum, l) => sum + (l.amountCents || 0)", "(sum: number, l: any) => sum + (l.amountCents as number || 0)")

with open('src/components/forensics/ForensicAudit.tsx', 'w') as f:
    f.write(content)

