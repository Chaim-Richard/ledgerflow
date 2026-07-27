const fs = require('fs');
let file = 'src/components/ledger/TwoLensesLedger.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/export default function TwoLensesLedger\(props: any\) \{/, 'export default function TwoLensesLedger() {');
content = content.replace(/<Ledger \{\.\.\.props\} \/>/, '<Ledger />');

fs.writeFileSync(file, content);
