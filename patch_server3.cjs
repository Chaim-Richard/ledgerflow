const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const importRouter = `import { invoiceEmailRouter } from "./src/server/routes/invoiceEmailRoutes";\n`;
if (!code.includes('invoiceEmailRoutes')) {
  code = importRouter + code;
}

if (!code.includes('app.use("/api/v1/invoices"')) {
  code = code.replace('// --- API Hub: Standard Endpoints ---', '// --- API Hub: Standard Endpoints ---\n  app.use("/api/v1/invoices", invoiceEmailRouter);');
}

fs.writeFileSync('server.ts', code);
