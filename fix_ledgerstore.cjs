const fs = require('fs');
let code = fs.readFileSync('src/stores/useLedgerStore.ts', 'utf8');

code = code.replace(
  "classes: ['Overhead', 'Marketing', 'Sales', 'Engineering', 'Executive'],",
  "classes: [],"
);

code = code.replace(
  "locations: ['Seattle', 'New York', 'London', 'Remote', 'Berlin'],",
  "locations: [],"
);

code = code.replace(
  /customFields: \[\s*\{[\s\S]*?\}\s*\],/,
  "customFields: [],"
);

fs.writeFileSync('src/stores/useLedgerStore.ts', code);
