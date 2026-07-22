import os

with open('src/components/Dashboard.tsx', 'r') as f:
    code = f.read()

target = """            description: g.description,
            tags: []
          },
          {
            accountId: isExpense ? 'asset-acc' : 'revenue-acc',
            accountName: isExpense ? 'Operating Asset' : 'Operating Revenue',
            amountCents: isExpense ? -g.amountCents : g.amountCents,
            description: g.description,
            tags: []
          }"""

replacement = """            description: g.description,
            tags: [] as string[]
          },
          {
            accountId: isExpense ? 'asset-acc' : 'revenue-acc',
            accountName: isExpense ? 'Operating Asset' : 'Operating Revenue',
            amountCents: isExpense ? -g.amountCents : g.amountCents,
            description: g.description,
            tags: [] as string[]
          }"""

code = code.replace(target, replacement)

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(code)
