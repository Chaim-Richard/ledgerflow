const fs = require('fs');
const file = 'src/lib/printInvoice.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "map(item =>",
  "map((item: any) =>"
);

fs.writeFileSync(file, content);
console.log("Patched printInvoice any");
