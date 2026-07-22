const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `amountCents: TruthEngine.parseAmountToCents(r[amountKey || ""] || "0"),`;
const replacement = `amountCents: TruthEngine.parseAmountToCents(r[amountKey || ""]),`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
console.log("Patched server.ts CSV parser!");
