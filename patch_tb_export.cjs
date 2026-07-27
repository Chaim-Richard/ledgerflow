const fs = require('fs');
const file = 'src/components/ledger/TrialBalanceView.tsx';
let content = fs.readFileSync(file, 'utf8');

const exportFunc = `
  const handleExportCSV = () => {
    const headers = ['Account Code', 'Account Name', 'Type', 'Debit', 'Credit'];
    const rows = trialBalance.lines.map(line => [
      line.id,
      line.name,
      line.type,
      (line.debit / 100).toFixed(2),
      (line.credit / 100).toFixed(2)
    ]);
    rows.push(['TOTAL', '', '', (trialBalance.totalDebits / 100).toFixed(2), (trialBalance.totalCredits / 100).toFixed(2)]);
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", \`trial_balance_export_\${new Date().toISOString().split('T')[0]}.csv\`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
`;

if (!content.includes('handleExportCSV')) {
  content = content.replace('export default function TrialBalanceView({ accounts, formatCurrency, onDrillDown }: TrialBalanceViewProps) {', 
                            'import { Download } from "lucide-react";\nexport default function TrialBalanceView({ accounts, formatCurrency, onDrillDown }: TrialBalanceViewProps) {');
  content = content.replace('return (', exportFunc + '\n  return (');
  
  content = content.replace(
    '<div className="flex items-center gap-2">',
    `<div className="flex items-center gap-2">
            <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface)] text-[var(--muted)] border border-[var(--line)] rounded-lg text-[9px] font-bold uppercase tracking-wider hover:text-[var(--text)] transition-all cursor-pointer">
              <Download size={12} /> Export CSV
            </button>`
  );
  
  fs.writeFileSync(file, content);
  console.log("Patched TB");
}
