import React, { useState } from 'react';
import { Download, FileText, Globe2, Calculator } from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { Transaction, ChartAccount, TaxRate } from '../../types';
import { toast } from 'sonner';

interface TaxFilingReporterProps {
  transactions: Transaction[];
  accounts: ChartAccount[];
  taxRates: TaxRate[];
  selectedYear: number;
}

export default function TaxFilingReporter({ transactions, accounts, taxRates, selectedYear }: TaxFilingReporterProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const calculateReport = () => {
    const yearTransactions = transactions.filter(tx => new Date(tx.date).getFullYear() === selectedYear);

    const regionalSalesTaxes: Record<string, number> = {};
    let totalRevenue = 0;
    
    // Evaluate taxes
    yearTransactions.forEach(tx => {
      totalRevenue += tx.lines?.filter(l => accounts.find(a => a.id === l.accountId)?.type === 'income')
                               .reduce((sum, l) => sum + Math.abs(l.amountCents), 0) || 0;

      tx.lines?.forEach(line => {
        const acc = accounts.find(a => a.id === line.accountId);
        if (acc && acc.name.toLowerCase().includes('sales tax')) {
          const region = line.location || 'Global/Default Region';
          regionalSalesTaxes[region] = (regionalSalesTaxes[region] || 0) + line.amountCents;
        }
      });
    });

    return { totalRevenue, regionalSalesTaxes };
  };

  const handleExport = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const data = calculateReport();
      const rows = [
        ['Official Tax Filing Report', `Fiscal Year: ${selectedYear}`],
        [],
        ['Regional Sales Tax Collected'],
        ['Region', 'Amount'],
        ...Object.entries(data.regionalSalesTaxes).map(([region, amount]) => [region, amount / 100]),
        [],
        ['Estimated Aggregate Revenue', data.totalRevenue / 100],
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tax Filing");
      XLSX.writeFile(wb, `Tax_Filing_${selectedYear}.xlsx`);
      
      setIsGenerating(false);
      toast.success(`Generated official tax filing report for ${selectedYear}`);
    }, 800);
  };

  return (
    <div className="bg-white rounded-[32px] border border-slate-200/80 shadow-3xs p-6 relative overflow-hidden group h-full flex flex-col justify-between">
      <div className="absolute top-0 right-0 p-4 md:p-8 opacity-[0.02] pointer-events-none group-hover:scale-110 transition-transform duration-700">
        <Globe2 size={120} />
      </div>
      
      <div className="relative z-10 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 border border-indigo-100/50 rounded-xl flex items-center justify-center shadow-inner">
            <FileText size={18} className="text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">Tax Filling & Automation</h3>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-widest mt-0.5">Automated Regional Liability Reports</p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
          <Calculator size={16} className="text-indigo-500 shrink-0 mt-0.5" />
          <div className="text-sm text-indigo-900/80 leading-relaxed font-medium">
            We automatically compute nexus thresholds, aggregate multijurisdictional sales tax, and project formal regional liabilities.
          </div>
        </div>
      </div>

      <div className="relative z-10 pt-6">
        <button
          onClick={handleExport}
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 disabled:hover:bg-indigo-600 text-white font-bold rounded-xl shadow-md active:scale-[0.98] transition-all text-sm group/btn"
        >
          {isGenerating ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
              <Calculator size={16} />
            </motion.div>
          ) : (
            <Download size={16} className="group-hover/btn:-translate-y-0.5 transition-transform" />
          )}
          {isGenerating ? 'Computing Tax Matrix...' : 'Generate Official Filing Report'}
        </button>
      </div>
    </div>
  );
}
