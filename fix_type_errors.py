import re

def replace_in_file(filepath, old, new):
    with open(filepath, 'r') as f:
        content = f.read()
    content = content.replace(old, new)
    with open(filepath, 'w') as f:
        f.write(content)

# TaxManager.tsx
# line 49: 'transactions' is possibly 'undefined'.
# -> We changed it to transactions?: Transaction[]; earlier.
# -> we can just inject `const txs = transactions || [];`
with open('src/components/finance/TaxManager.tsx', 'r') as f:
    content = f.read()
content = content.replace("transactions.filter(", "(transactions || []).filter(")
content = content.replace("transactions.map(", "(transactions || []).map(")
content = content.replace("transactions.forEach(", "(transactions || []).forEach(")
content = content.replace("transactions={transactions}", "")
with open('src/components/finance/TaxManager.tsx', 'w') as f:
    f.write(content)


with open('src/components/ledger/ReconciliationWizard.tsx', 'r') as f:
    content = f.read()
content = content.replace("transactions.filter(", "(transactions || []).filter(")
content = content.replace("transactions.map(", "(transactions || []).map(")
content = content.replace("transactions.forEach(", "(transactions || []).forEach(")
with open('src/components/ledger/ReconciliationWizard.tsx', 'w') as f:
    f.write(content)

with open('src/components/projects/ProjectPipeline.tsx', 'r') as f:
    content = f.read()
content = content.replace("transactions.filter(", "(transactions || []).filter(")
content = content.replace("transactions.map(", "(transactions || []).map(")
content = content.replace("transactions.forEach(", "(transactions || []).forEach(")
with open('src/components/projects/ProjectPipeline.tsx', 'w') as f:
    f.write(content)

