const fs = require('fs');
let file = fs.readFileSync('src/components/finance/DunningCollections.tsx', 'utf8');

file = file.replace(
  "  const accounts = useLedgerStore(state => state.accounts);",
  "  const accounts = useLedgerStore(state => state.accounts);\n  const invoices = useLedgerStore(state => state.invoices);\n  const customers = useLedgerStore(state => state.customers);"
);

const fakeInvoicesBlock = `  // Fake overdue data extracted from AR
  const arAccount = accounts.find(a => a.name.includes('Accounts Receivable') || a.id === '1200');
  const outstandingInvoices = [
    { id: 'INV-4029', customer: 'Acme Corp', amount: 14500, daysOverdue: 45, status: 'Level 2 Escalation', lastContact: '2023-10-15', probability: 'High Risk' },
    { id: 'INV-4102', customer: 'Global Tech LLC', amount: 8200, daysOverdue: 12, status: 'Friendly Reminder', lastContact: '2023-10-28', probability: 'Low Risk' },
    { id: 'INV-3982', customer: 'Stark Industries', amount: 45000, daysOverdue: 92, status: 'Collection Agency', lastContact: '2023-09-01', probability: 'Critical Risk' },
    { id: 'INV-4155', customer: 'Wayne Enterprises', amount: 3200, daysOverdue: 5, status: 'Initial Notice', lastContact: '-', probability: 'Low Risk' }
  ];`;

const realInvoicesBlock = `  const arAccount = accounts.find(a => a.name.includes('Accounts Receivable') || a.id === '1200');
  
  const outstandingInvoices = invoices
    .filter(inv => inv.status !== 'paid' && new Date(inv.dueDate) < new Date())
    .map(inv => {
      const daysOverdue = Math.floor((new Date().getTime() - new Date(inv.dueDate).getTime()) / (1000 * 3600 * 24));
      const customer = customers.find(c => c.id === inv.customerId)?.name || 'Unknown';
      let status = 'Initial Notice';
      let probability = 'Low Risk';
      
      if (daysOverdue > 90) { status = 'Collection Agency'; probability = 'Critical Risk'; }
      else if (daysOverdue > 60) { status = 'Final Warning'; probability = 'High Risk'; }
      else if (daysOverdue > 30) { status = 'Level 2 Escalation'; probability = 'Medium Risk'; }
      else if (daysOverdue > 5) { status = 'Friendly Reminder'; probability = 'Low Risk'; }

      return {
        id: inv.id,
        customer,
        amount: inv.total,
        daysOverdue,
        status,
        lastContact: '-',
        probability
      };
    });`;

file = file.replace(fakeInvoicesBlock, realInvoicesBlock);
fs.writeFileSync('src/components/finance/DunningCollections.tsx', file);
