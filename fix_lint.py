import re
import os

def fix_file(filepath):
    if not os.path.exists(filepath):
        print(f"Skipping {filepath} (does not exist)")
        return
        
    with open(filepath, 'r') as f:
        content = f.read()

    # Add useLedgerStore import if not present
    if "useLedgerStore" not in content:
        content = content.replace("import React,", "import React,\n")
        content = content.replace("import { ", "import { useLedgerStore } from '../../stores/useLedgerStore';\nimport { ")

    # Remove transactions from interface
    content = re.sub(r'\btransactions\??\s*:\s*Transaction\[\]\s*;', '', content)
    
    # Inject const transactions = useLedgerStore(state => state.transactions || []); inside component
    
    with open(filepath, 'w') as f:
        f.write(content)

fix_file('src/components/finance/TaxManager.tsx')
fix_file('src/components/reporting/BalanceSheetView.tsx')
fix_file('src/components/ledger/ReconciliationWizard.tsx')
fix_file('src/components/projects/ProjectPipeline.tsx')

