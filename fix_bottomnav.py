import re

with open('src/components/layout/BottomNav.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """  const navGroups: any[] = [
    { id: 'pulse', label: 'Home', icon: APP_TABS.find(t=>t.id==='dashboard')?.icon, firstTab: 'dashboard' },
    { id: 'finance', label: 'Accounting', icon: APP_TABS.find(t=>t.id==='ledger')?.icon, firstTab: 'ledger' },
    { id: 'operations', label: 'Business', icon: APP_TABS.find(t=>t.id==='sales')?.icon, firstTab: 'sales' },
    { id: 'planning', label: 'Reports', icon: APP_TABS.find(t=>t.id==='reports')?.icon, firstTab: 'reports' },
    { id: 'menu', label: 'Menu', icon: APP_TABS.find(t=>t.id==='settings')?.icon, isAction: true }
  ];"""

content = content.replace("const navGroups: any[] = [];", replacement)

# Need to import lucide icons if missing? Not needed since APP_TABS has icons.

with open('src/components/layout/BottomNav.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
