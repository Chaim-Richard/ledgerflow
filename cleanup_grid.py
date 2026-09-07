with open('src/components/ledger/TransactionGrid.tsx', 'r') as f:
  c = f.read()

c = c.replace('}      {isEditing &&', '>      {isEditing &&')
c = c.replace('pointer-events-none"}', 'pointer-events-none">')
c = c.replace('pointer-events-auto"}', 'pointer-events-auto">')
c = c.replace('onSave={(v) =}', 'onSave={(v) =>}')

with open('src/components/ledger/TransactionGrid.tsx', 'w') as f:
  f.write(c)
