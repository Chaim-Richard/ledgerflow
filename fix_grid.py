with open('src/components/ledger/TransactionGrid.tsx', 'r') as f:
  c = f.read()

c = c.replace('searchTerm={data.searchTerm}', 'searchTerm={data.searchTerm}\n        onDuplicate={data.handleDuplicateTransaction}')

with open('src/components/ledger/TransactionGrid.tsx', 'w') as f:
  f.write(c)
