import re

files = [
    'src/components/finance/TaxManager.tsx',
    'src/components/ledger/Ledger.tsx',
    'src/components/projects/Projects.tsx'
]

for file in files:
    with open(file, 'r') as f:
        content = f.read()
    
    content = re.sub(r'\s*transactions={transactions}', '', content)
    
    with open(file, 'w') as f:
        f.write(content)

