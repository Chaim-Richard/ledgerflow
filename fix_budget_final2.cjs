const fs = require('fs');
let file2 = 'src/components/planning/BudgetManager.tsx';
let bm = fs.readFileSync(file2, 'utf8');

bm = bm.replace(/budgets\.map\(budget => \{/g, 'budgets.map((budget: any) => {');
bm = bm.replace(/budgetAnalysis\.map\(\(b\) => \{/g, 'budgetAnalysis.map((b: any) => {');

fs.writeFileSync(file2, bm);
