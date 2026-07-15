with open('src/components/finance/TaxManager.tsx', 'r') as f:
    content = f.read()

content = content.replace("}, [({ selectedYear, accounts, taxRates]);", "}, [selectedYear, accounts, taxRates]);")

with open('src/components/finance/TaxManager.tsx', 'w') as f:
    f.write(content)
