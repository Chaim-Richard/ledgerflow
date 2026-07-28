const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const importStatement = `import PublicInvoicePage from './components/sales/PublicInvoicePage';\n`;
if (!code.includes('PublicInvoicePage')) {
  code = code.replace(/import { ErrorBoundary } from '.\/components\/ErrorBoundary';/, "import { ErrorBoundary } from './components/ErrorBoundary';\n" + importStatement);
}

const checkLogic = `
  const isPublicInvoice = window.location.pathname.startsWith('/i/');
  if (isPublicInvoice) {
    return <PublicInvoicePage />;
  }
`;

if (!code.includes('isPublicInvoice')) {
  code = code.replace(/if \(isInitializing\) {/, checkLogic + "\n  if (isInitializing) {");
  fs.writeFileSync('src/App.tsx', code);
}
