const fs = require('fs');
const file = 'src/components/sales/Sales.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import { printInvoice }')) {
  content = content.replace(
    "import { useEntityOperations } from '../../hooks/useEntityOperations';",
    "import { useEntityOperations } from '../../hooks/useEntityOperations';\nimport { printInvoice } from '../../lib/printInvoice';"
  );
  
  content = content.replace(
    "onClick={(e) => { e.stopPropagation(); setTimeout(()=>window.print(), 200); }}",
    "onClick={(e) => { e.stopPropagation(); const cust = customers.find(c => c.id === inv.customerId); printInvoice(inv, cust); }}"
  );
  
  fs.writeFileSync(file, content);
  console.log("Patched Sales Print");
}
