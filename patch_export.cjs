const fs = require('fs');
const file = 'src/hooks/useTransactionActions.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  `  const handleExport = (transactions: Transaction[]) => {
    const headers = ['Date', 'Description', 'Amount', 'Status', 'Category'];
    const rows = transactions.map(t => [
      sanitizeCsvCell(t.date),
      sanitizeCsvCell(t.description),
      sanitizeCsvCell((t.totalAmountCents / 100).toFixed(2)),
      sanitizeCsvCell(t.status),
      sanitizeCsvCell(t.lines?.[0]?.accountName || 'N/A')
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.map(sanitizeCsvCell), ...rows].map(e => e.join(",")).join("\\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", \`ledger_export_\${new Date().toISOString().split('T')[0]}.csv\`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export completed successfully');
  };`,
  `  const handleExport = (transactions: Transaction[]) => {
    const headers = ['Date', 'Transaction ID', 'Description', 'Account ID', 'Account Name', 'Debit', 'Credit', 'Status', 'Project', 'Department'];
    
    const rows: string[][] = [];
    transactions.forEach(t => {
      t.lines.forEach(l => {
        const debit = l.debit ? (l.debit / 100).toFixed(2) : '0.00';
        const credit = l.credit ? (l.credit / 100).toFixed(2) : '0.00';
        rows.push([
          sanitizeCsvCell(t.date),
          sanitizeCsvCell(t.id),
          sanitizeCsvCell(t.description),
          sanitizeCsvCell(l.accountId),
          sanitizeCsvCell(l.accountName),
          sanitizeCsvCell(debit),
          sanitizeCsvCell(credit),
          sanitizeCsvCell(t.status),
          sanitizeCsvCell(t.project || ''),
          sanitizeCsvCell(l.department || '')
        ]);
      });
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.map(sanitizeCsvCell), ...rows].map(e => e.join(",")).join("\\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", \`general_ledger_export_\${new Date().toISOString().split('T')[0]}.csv\`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('General Ledger Export completed successfully');
  };`
);
fs.writeFileSync(file, content);
console.log("Done");
