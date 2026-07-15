const fs = require('fs');
const path = './src/components/layout/BottomNav.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/const navGroups: any\[\] = \[.*?\];/s, `const navGroups: any[] = [
    { id: 'pulse', label: 'Home', icon: Home, firstTab: 'dashboard' },
    { id: 'finance', label: 'Accounting', icon: Database, firstTab: 'ledger' },
    { id: 'operations', label: 'Business', icon: ArrowUpRight, firstTab: 'sales' },
    { id: 'planning', label: 'Reports', icon: FileText, firstTab: 'reports' },
    { id: 'menu', label: 'Menu', icon: Menu, isAction: true }
  ];`);
fs.writeFileSync(path, code);
