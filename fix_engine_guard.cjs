const fs = require('fs');
const path = require('path');

let enginePath = path.join(__dirname, 'src/kernel/ledger/LedgerEngine.ts');
let engine = fs.readFileSync(enginePath, 'utf8');

engine = engine.replace(
  `for (const line of lines) {`,
  `for (const line of lines) {
        if (!line || typeof line !== 'object') continue;`
);
fs.writeFileSync(enginePath, engine);
console.log("Guarded lines");
