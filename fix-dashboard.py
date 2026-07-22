import os

with open('src/components/Dashboard.tsx', 'r') as f:
    code = f.read()

target_import = "import { useLedgerStore } from '../stores/useLedgerStore';"
replacement_import = """import { useLedgerStore } from '../stores/useLedgerStore';
import { useScenarioStore } from '../lib/scenarioStore';"""

target_state = """  const transactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);"""

replacement_state = """  const rawTransactions = useLedgerStore(s => s.transactions);
  const accounts = useLedgerStore(s => s.accounts);
  const scenarios = useScenarioStore(s => s.scenarios);
  const activeScenarioId = useScenarioStore(s => s.activeScenarioId);
  
  const transactions = useMemo(() => {
    const activeScenario = Array.isArray(scenarios) ? scenarios.find(s => s.id === activeScenarioId) : null;
    if (!activeScenario || !activeScenario.ghosts.length) return rawTransactions;
    
    const materializedGhosts = activeScenario.ghosts.filter(g => g.isActive).map(g => {
      const isExpense = g.type === 'expense';
      return {
        id: `ghost-${g.id}`,
        uid: 'ghost-user',
        workspaceId: 'ghost-workspace',
        date: g.date,
        description: g.description,
        totalAmountCents: g.amountCents,
        currency: 'USD',
        status: 'completed',
        type: 'forecast',
        schemaVersion: '1.1',
        lines: [
          {
            accountId: isExpense ? 'expense-acc' : 'asset-acc',
            accountName: isExpense ? 'Operating Expense' : 'Operating Asset',
            amountCents: isExpense ? g.amountCents : -g.amountCents,
            description: g.description
          },
          {
            accountId: isExpense ? 'asset-acc' : 'revenue-acc',
            accountName: isExpense ? 'Operating Asset' : 'Operating Revenue',
            amountCents: isExpense ? -g.amountCents : g.amountCents,
            description: g.description
          }
        ]
      };
    });
    return [...rawTransactions, ...materializedGhosts];
  }, [rawTransactions, scenarios, activeScenarioId]);"""

code = code.replace(target_import, replacement_import)
code = code.replace(target_state, replacement_state)

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(code)
