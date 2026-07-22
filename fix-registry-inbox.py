import os

with open('src/config/registry.tsx', 'r') as f:
    code = f.read()

target_view = """  'budgets': lazy(() => import('../components/planning/BudgetManager')),
  'time-machine': lazy(() => import('../components/ledger/TimeMachine')),"""

replacement_view = """  'budgets': lazy(() => import('../components/planning/BudgetManager')),
  'time-machine': lazy(() => import('../components/ledger/TimeMachine')),
  'inbox': lazy(() => import('../components/ledger/InboxView')),"""

target_tab = """  { id: 'transactions', label: { en: 'Journal Entries', he: 'תנועות' }, icon: Layers, groupId: 'finance' },"""

replacement_tab = """  { id: 'inbox', label: { en: 'AI Inbox', he: 'AI Inbox' }, icon: Zap, groupId: 'finance' },
  { id: 'transactions', label: { en: 'Journal Entries', he: 'תנועות' }, icon: Layers, groupId: 'finance' },"""

code = code.replace(target_view, replacement_view)
code = code.replace(target_tab, replacement_tab)

with open('src/config/registry.tsx', 'w') as f:
    f.write(code)
