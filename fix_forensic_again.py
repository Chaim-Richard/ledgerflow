import re

with open('src/components/forensics/ForensicAudit.tsx', 'r') as f:
    content = f.read()

if "import { useLedgerStore } from" not in content:
    content = content.replace("import { format } from 'date-fns';", "import { format } from 'date-fns';\nimport { useLedgerStore } from '../../stores/useLedgerStore';")
    
content = re.sub(r'\(sum, l\) => sum \+ \(l\.amountCents', '(sum: number, l: any) => sum + (l.amountCents', content)

with open('src/components/forensics/ForensicAudit.tsx', 'w') as f:
    f.write(content)

