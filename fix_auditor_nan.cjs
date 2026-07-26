const fs = require('fs');
const path = require('path');
let p = path.join(__dirname, 'src/services/auditor.ts');
let c = fs.readFileSync(p, 'utf8');
c = c.replace(
  `entryDebit += Math.round(line.debit * 100);`,
  `entryDebit += typeof line.debit === 'number' ? Math.round(line.debit * 100) : 0;`
).replace(
  `entryCredit += Math.round(line.credit * 100);`,
  `entryCredit += typeof line.credit === 'number' ? Math.round(line.credit * 100) : 0;`
);
fs.writeFileSync(p, c);
