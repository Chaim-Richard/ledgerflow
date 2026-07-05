const fs = require('fs');

function replaceInFile(path, replacements) {
  try {
    let content = fs.readFileSync(path, 'utf8');
    for (const r of replacements) {
      content = content.replace(r.search, r.replace);
    }
    fs.writeFileSync(path, content);
  } catch (e) {}
}

replaceInFile('src/components/sales/Sales.tsx', [
  { search: /Revenue Capture Pipeline/g, replace: 'Sales & Customers' },
  { search: /Inflow Matrix/g, replace: 'Sales Hub' },
  { search: /Real-time resolution of accounts receivable and customer lifecycle value./g, replace: 'Manage invoices, estimates, and customer relationships.' },
]);

replaceInFile('src/components/ledger/Ledger.tsx', [
  { search: /Omniscient/g, replace: 'Ledger' },
  { search: /OMNISCIENT/g, replace: 'LEDGER' }
]);

replaceInFile('src/components/Dashboard.tsx', [
  { search: /"Don't build complicated charts. Just make more money."/g, replace: "Your business at a glance." },
  { search: /Oxygen \(Cash\)/g, replace: 'Cash Balance' },
  { search: /Cash Flow Velocity/g, replace: 'Cash Flow' }
]);

console.log("Fixed labels");
