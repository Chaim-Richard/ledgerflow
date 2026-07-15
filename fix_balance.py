import re

files = [
    'src/components/reporting/ProfitAndLossView.tsx',
    'src/components/reporting/TrialBalanceView.tsx'
]

for file in files:
    try:
        with open(file, 'r') as f:
            content = f.read()
        
        content = re.sub(r'\s*transactions={transactions}', '', content)
        content = re.sub(r'transactions: Transaction\[\];', 'transactions?: Transaction[];', content)
        
        with open(file, 'w') as f:
            f.write(content)
    except Exception as e:
        pass

