with open('src/components/ledger/ReconciliationWizard.tsx', 'r') as f:
    content = f.read()

content = content.replace("export default function ReconciliationWizard{ isOpen", "export default function ReconciliationWizard({ isOpen")
content = content.replace("}, [({ selectedAccount, searchTerm]);", "}, [selectedAccount, searchTerm]);")

with open('src/components/ledger/ReconciliationWizard.tsx', 'w') as f:
    f.write(content)
