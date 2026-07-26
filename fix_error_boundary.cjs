const fs = require('fs');
const path = require('path');

let ebPath = path.join(__dirname, 'src/components/ErrorBoundary.tsx');
let eb = fs.readFileSync(ebPath, 'utf8');

eb = eb.replace(
  `console.error('Uncaught error:', error, errorInfo);`,
  `console.error('Uncaught error:', error, errorInfo);
    console.log("CRASH_DUMP:", error.stack || error.message);`
);

fs.writeFileSync(ebPath, eb);
