with open('src/components/ledger/ReconciliationWizard.tsx', 'r') as f:
    content = f.read()

content = content.replace("({ isOpen, onClose,({ accounts, onComplete, formatCurrency }", "{ isOpen, onClose, accounts, onComplete, formatCurrency }")

content = content.replace("}: ReconciliationWizardProps) {", "}: ReconciliationWizardProps) {\n  const transactions = useLedgerStore(state => state.transactions || []);")

with open('src/components/ledger/ReconciliationWizard.tsx', 'w') as f:
    f.write(content)
