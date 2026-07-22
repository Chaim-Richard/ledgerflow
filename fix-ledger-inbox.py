import os

with open('src/components/ledger/Ledger.tsx', 'r') as f:
    code = f.read()

target = """            <InboxView 
              accounts={accounts} 
              onCategorize={onBulkCategorize}
              formatCurrency={formatCurrency}
              onParseReceipt={onParseReceipt}
            />"""

replacement = """            <InboxView 
              transactions={transactions}
              accounts={accounts} 
              onCategorize={onBulkCategorize}
              formatCurrency={formatCurrency}
              onParseReceipt={onParseReceipt}
            />"""

code = code.replace(target, replacement)

with open('src/components/ledger/Ledger.tsx', 'w') as f:
    f.write(code)
