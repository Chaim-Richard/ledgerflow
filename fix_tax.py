with open('src/components/finance/TaxManager.tsx', 'r') as f:
    content = f.read()

content = content.replace("workspaceId,({", "workspaceId,")
content = content.replace("import React,\n { useState", "import React, { useState")

content = content.replace("}: TaxManagerProps) {", "}: TaxManagerProps) {\n  const transactions = useLedgerStore(state => state.transactions || []);")

with open('src/components/finance/TaxManager.tsx', 'w') as f:
    f.write(content)
