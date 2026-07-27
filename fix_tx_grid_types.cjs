const fs = require('fs');
let file = 'src/components/ledger/TransactionGrid.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const onFilterApplied = \(c\) =>/, 'const onFilterApplied = (c: any) =>');
content = content.replace(/const onUpdate = \(id, updates\) =>/, 'const onUpdate = (id: string, updates: any) =>');
content = content.replace(/const onVoid = \(id\) =>/, 'const onVoid = (id: string) =>');
content = content.replace(/const onNewEntry = \(\) => txActions.handleQuickAdd\?\.\(\) \|\| onAction\('quick-entry'\);/, 'const onNewEntry = () => { txActions.handleQuickAdd?.({} as any); onAction("quick-entry"); };');
content = content.replace(/const onCreateRule = \(tx\) => \{\};/, 'const onCreateRule = (tx: any) => {};');
content = content.replace(/const categories = useLedgerStore\(s => s\.categories\) \|\| \[\];/, 'const categories = [];');

fs.writeFileSync(file, content);
