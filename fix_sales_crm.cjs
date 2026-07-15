const fs = require('fs');
let code = fs.readFileSync('src/components/operations/SalesCRM.tsx', 'utf8');
code = code.replace(
  /const \[deals, setDeals\] = useState<any\[\]>\(\[[\s\S]*?\]\);/,
  "const [deals, setDeals] = useState<any[]>([]);"
);
fs.writeFileSync('src/components/operations/SalesCRM.tsx', code);
