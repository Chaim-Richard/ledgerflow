import os

with open('src/config/registry.tsx', 'r') as f:
    code = f.read()

target1 = """  'budgets': lazy(() => import('../components/planning/BudgetManager')),"""

replacement1 = """  'budgets': lazy(() => import('../components/planning/BudgetManager')),
  'time-machine': lazy(() => import('../components/ledger/TimeMachine')),"""

target2 = """  { id: 'vault', label: { en: 'Documents', he: 'כספת מסמכים' }, icon: ShieldCheck, groupId: 'system' },"""

replacement2 = """  { id: 'time-machine', label: { en: 'Time Machine', he: 'Time Machine' }, icon: GitMerge, groupId: 'finance' },
  { id: 'vault', label: { en: 'Documents', he: 'כספת מסמכים' }, icon: ShieldCheck, groupId: 'system' },"""

code = code.replace(target1, replacement1)
code = code.replace(target2, replacement2)

with open('src/config/registry.tsx', 'w') as f:
    f.write(code)
