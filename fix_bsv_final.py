with open('src/components/ledger/BalanceSheetView.tsx', 'r') as f:
    content = f.read()

content = content.replace("({ accounts}= [], journalEntries = [], formatCurrency }", "({ accounts = [], journalEntries = [], formatCurrency }")

content = content.replace("}: BalanceSheetViewProps) {", "}: BalanceSheetViewProps) {\n  const transactions = useLedgerStore(state => state.transactions || []);")

with open('src/components/ledger/BalanceSheetView.tsx', 'w') as f:
    f.write(content)
