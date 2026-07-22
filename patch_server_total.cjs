const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `totalAmountCents: transactionLines.filter((l: any) => (l.amountCents || 0) > 0).reduce((acc: number, l: any) => acc + (l.amountCents || 0), 0),`;
const rep = `totalAmountCents: TruthEngine.deriveSignedTotal(transactionLines, accounts),`;

code = code.replace(target, rep);
fs.writeFileSync('server.ts', code);
console.log("Patched server.ts totalAmountCents!");
