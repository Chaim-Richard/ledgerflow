const fs = require('fs');
const path = require('path');

let auditorPath = path.join(__dirname, 'src/services/auditor.ts');
let auditor = fs.readFileSync(auditorPath, 'utf8');

auditor = auditor.replace(
  `.sort((a, b) => { if (a.time !== b.time) return a.time - b.time; return a.t ? a.t.id.localeCompare(b.t.id) : 0; })`,
  `.sort((a, b) => { if (a.time !== b.time) return a.time - b.time; return (a.t && b.t && a.t.id && b.t.id) ? a.t.id.localeCompare(b.t.id) : 0; })`
);

auditor = auditor.replace(
  `.sort((a, b) => { if (a.time !== b.time) return a.time - b.time; return a.tx ? a.tx.id.localeCompare(b.tx.id) : 0; })`,
  `.sort((a, b) => { if (a.time !== b.time) return a.time - b.time; return (a.tx && b.tx && a.tx.id && b.tx.id) ? a.tx.id.localeCompare(b.tx.id) : 0; })`
);

fs.writeFileSync(auditorPath, auditor);
console.log("Fixed auditor.ts compilation errors.");
