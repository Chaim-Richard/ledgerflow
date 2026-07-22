const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `totalAmountCents: Math.max(...transactionLines.map((l: any) => Math.abs(l.amountCents || 0))),`;
const replacement = `totalAmountCents: transactionLines.filter((l: any) => (l.amountCents || 0) > 0).reduce((acc: number, l: any) => acc + (l.amountCents || 0), 0),`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
