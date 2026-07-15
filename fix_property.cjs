const fs = require('fs');
let code = fs.readFileSync('src/components/operations/PropertyManager.tsx', 'utf8');

code = code.replace(
  "John Doe {i}",
  "Tenant {i}"
);

fs.writeFileSync('src/components/operations/PropertyManager.tsx', code);
