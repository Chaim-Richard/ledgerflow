with open('src/components/finance/TaxManager.tsx', 'r') as f:
    content = f.read()

content = content.replace("<TaxFilingReporter\n            accounts={accounts}", "<TaxFilingReporter\n            transactions={transactions}\n            accounts={accounts}")

with open('src/components/finance/TaxManager.tsx', 'w') as f:
    f.write(content)
