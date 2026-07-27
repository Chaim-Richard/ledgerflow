const fs = require('fs');
const file = 'src/hooks/useTransactionActions.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "const debit = l.debit ? (l.debit / 100).toFixed(2) : '0.00';",
  "const debit = l.amountCents > 0 ? (l.amountCents / 100).toFixed(2) : '0.00';"
);
content = content.replace(
  "const credit = l.credit ? (l.credit / 100).toFixed(2) : '0.00';",
  "const credit = l.amountCents < 0 ? (Math.abs(l.amountCents) / 100).toFixed(2) : '0.00';"
);

fs.writeFileSync(file, content);
console.log("Patched TX Export");
