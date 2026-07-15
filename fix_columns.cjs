const fs = require('fs');
let code = fs.readFileSync('src/components/operations/SalesCRM.tsx', 'utf8');
code = code.replace(
  "const columns: any[] = [];",
  `const columns = [
    { id: 'new', label: 'New Leads', color: 'border-slate-200 bg-slate-50' },
    { id: 'contacted', label: 'Contacted', color: 'border-blue-200 bg-blue-50' },
    { id: 'proposal', label: 'Proposal Sent', color: 'border-amber-200 bg-amber-50' },
    { id: 'negotiation', label: 'Negotiation', color: 'border-purple-200 bg-purple-50' },
    { id: 'closed', label: 'Closed Won', color: 'border-emerald-200 bg-emerald-50' }
  ];`
);
fs.writeFileSync('src/components/operations/SalesCRM.tsx', code);
