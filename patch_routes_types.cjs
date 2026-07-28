const fs = require('fs');
let code = fs.readFileSync('src/server/routes/invoiceEmailRoutes.ts', 'utf8');

code = code.replace(/const invoice = doc\.data\(\);/g, 'const invoice = doc.data() || {};');

fs.writeFileSync('src/server/routes/invoiceEmailRoutes.ts', code);
