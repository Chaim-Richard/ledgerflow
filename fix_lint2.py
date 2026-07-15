import re

def fix_file(filepath, component_names):
    with open(filepath, 'r') as f:
        content = f.read()

    for comp in component_names:
        # Match function ComponentName({ ... }) or const ComponentName = ({ ... }) =>
        # and insert transactions
        pattern1 = r'(function\s+' + comp + r'\s*\([^{]*?\{[^}]*?\}\s*(?::\s*[A-Za-z]+)?\s*\)\s*\{)'
        pattern2 = r'(const\s+' + comp + r'\s*=\s*(?:React\.memo\()?[\s\S]*?\([^{]*?\{[^}]*?\}\s*(?::\s*[A-Za-z]+)?\s*\)\s*=>\s*\{)'
        
        replacement = r'\1\n  const transactions = useLedgerStore(state => state.transactions || []);'
        
        content = re.sub(pattern1, replacement, content)
        content = re.sub(pattern2, replacement, content)

    with open(filepath, 'w') as f:
        f.write(content)

fix_file('src/components/finance/TaxManager.tsx', ['TaxManager', 'TaxFilingReporter'])
fix_file('src/components/ledger/ReconciliationWizard.tsx', ['ReconciliationWizard'])
fix_file('src/components/projects/ProjectPipeline.tsx', ['ProjectPipeline'])

# BalanceSheetView
with open('src/components/ledger/BalanceSheetView.tsx', 'r') as f:
    content = f.read()
if "useLedgerStore" not in content:
    content = content.replace("import React,", "import React,\nimport { useLedgerStore } from '../../stores/useLedgerStore';\n")
content = re.sub(r'\btransactions\??\s*:\s*Transaction\[\]\s*;', '', content)
pattern = r'(function\s+BalanceSheetView\s*\([^{]*?\{[^}]*?\}\s*(?::\s*[A-Za-z]+)?\s*\)\s*\{)'
content = re.sub(pattern, r'\1\n  const transactions = useLedgerStore(state => state.transactions || []);', content)
with open('src/components/ledger/BalanceSheetView.tsx', 'w') as f:
    f.write(content)

