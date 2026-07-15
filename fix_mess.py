import re

files = [
    'src/components/finance/TaxManager.tsx',
    'src/components/ledger/BalanceSheetView.tsx',
    'src/components/ledger/ReconciliationWizard.tsx',
    'src/components/projects/ProjectPipeline.tsx'
]

for file in files:
    with open(file, 'r') as f:
        content = f.read()

    # Clean up duplicate imports of useLedgerStore
    content = re.sub(r"import \{ useLedgerStore \} from '\.\./\.\./stores/useLedgerStore';\n", "", content)
    
    # Put it back EXACTLY ONCE at the top
    content = "import { useLedgerStore } from '../../stores/useLedgerStore';\n" + content

    # The interface problem:
    # TaxManagerProps doesn't have transactions, but the function signature still has it
    content = re.sub(r'\(?\{?\s*transactions\s*,', '({', content)
    content = re.sub(r',\s*transactions\s*\}?\)?', '}', content)
    content = re.sub(r'const transactions = useLedgerStore\(state => state\.transactions \|\| \[\]\);', '', content)
    
    # We will inject the hook right after the component declaration
    # function Component({ ... }) {
    # const Component = ({ ... }) => {
    
    with open(file, 'w') as f:
        f.write(content)

