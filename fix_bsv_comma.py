with open('src/components/ledger/BalanceSheetView.tsx', 'r') as f:
    content = f.read()

content = content.replace("}, [accounts,({ journalEntries, asOfDate, priorDate, isComparative]);", "}, [accounts, journalEntries, asOfDate, priorDate, isComparative]);")

with open('src/components/ledger/BalanceSheetView.tsx', 'w') as f:
    f.write(content)
