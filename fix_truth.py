import re

with open('src/components/intelligence/AlgorithmicTruth.tsx', 'r') as f:
    content = f.read()

# Add useLedgerStore import
content = content.replace(
    "import { mean, standardDeviation",
    "import { useLedgerStore } from '../../stores/useLedgerStore';\nimport { mean, standardDeviation"
)

new_txs_logic = """  const ledgerTransactions = useLedgerStore(state => state.transactions || []);
  
  const transactions = useMemo(() => {
    return ledgerTransactions.map(t => {
      let amt = 0;
      t.lines?.forEach(l => { amt += Math.abs(l.amountCents / 100); });
      return {
          id: t.id,
          date: t.date,
          account: 'Mixed', // Simplified
          amount: amt,
          vendor: t.payee || 'Unknown'
      };
    });
  }, [ledgerTransactions]);"""

content = re.sub(r'  const transactions = useMemo\(\(\) => \{[\s\S]*?return txns;\n  \}, \[\]\);', new_txs_logic, content)

with open('src/components/intelligence/AlgorithmicTruth.tsx', 'w') as f:
    f.write(content)

