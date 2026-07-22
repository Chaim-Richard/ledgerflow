import os

with open('src/components/Dashboard.tsx', 'r') as f:
    code = f.read()

target = """    const materializedGhosts = activeScenario.ghosts.filter(g => g.isActive).map(g => {
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
    });"""

replacement = """    const materializedGhosts = activeScenario.ghosts.filter(g => g.isActive).map(g => {
      const isExpense = g.type === 'expense';
      return {
        id: `ghost-${g.id}`,
        uid: 'ghost-user',
        workspaceId: 'ghost-workspace',
        date: g.date,
        description: g.description,
        totalAmountCents: g.amountCents,
        currency: 'USD',
        status: 'completed' as const,
        type: 'forecast' as const,
        schemaVersion: '1.1',
        tags: ['scenario', 'ghost'],
        lines: [
          {
            accountId: isExpense ? 'expense-acc' : 'asset-acc',
            accountName: isExpense ? 'Operating Expense' : 'Operating Asset',
            amountCents: isExpense ? g.amountCents : -g.amountCents,
            description: g.description,
            tags: []
          },
          {
            accountId: isExpense ? 'asset-acc' : 'revenue-acc',
            accountName: isExpense ? 'Operating Asset' : 'Operating Revenue',
            amountCents: isExpense ? -g.amountCents : g.amountCents,
            description: g.description,
            tags: []
          }
        ]
      };
    });"""

code = code.replace(target, replacement)

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(code)
