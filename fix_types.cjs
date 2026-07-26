const fs = require('fs');
const path = require('path');

let typesPath = path.join(__dirname, 'src/types.ts');
let types = fs.readFileSync(typesPath, 'utf8');
types = types.replace(
  "type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';",
  "type: 'asset' | 'liability' | 'equity' | 'income' | 'expense' | 'cost_of_goods' | 'revenue';"
);
fs.writeFileSync(typesPath, types);

let auditorPath = path.join(__dirname, 'src/services/auditor.ts');
let auditor = fs.readFileSync(auditorPath, 'utf8');
auditor = auditor.replace(
  `.sort((a, b) => { if (a.time !== b.time) return a.time - b.time; return a.t ? a.t.id.localeCompare(b.t.id) : (a.tx ? a.tx.id.localeCompare(b.tx.id) : 0); })`,
  `.sort((a, b) => { if (a.time !== b.time) return a.time - b.time; return a.t ? a.t.id.localeCompare(b.t.id) : 0; })`
);
auditor = auditor.replace(
  `.sort((a, b) => { if (a.time !== b.time) return a.time - b.time; return a.t ? a.t.id.localeCompare(b.t.id) : (a.tx ? a.tx.id.localeCompare(b.tx.id) : 0); })`,
  `.sort((a, b) => { if (a.time !== b.time) return a.time - b.time; return a.tx ? a.tx.id.localeCompare(b.tx.id) : 0; })`
);
fs.writeFileSync(auditorPath, auditor);
console.log("Fixed types and auditor.");
