const fs = require('fs');
let file2 = 'src/components/planning/BudgetManager.tsx';
let bm = fs.readFileSync(file2, 'utf8');

bm = bm.replace(/b => b.id ===/g, '(b: any) => b.id ===');
bm = bm.replace(/acc => acc.id/g, '(acc: any) => acc.id');

fs.writeFileSync(file2, bm);
