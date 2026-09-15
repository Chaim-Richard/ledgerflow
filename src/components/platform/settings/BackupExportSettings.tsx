import React, { useState, useRef } from 'react';
import { Download, Database, FileSpreadsheet, Archive, AlertCircle, Upload } from 'lucide-react';
import { useLedgerStore } from '../../../stores/useLedgerStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { toast } from 'sonner';
import { formatDecimal, resolveAccountName } from '../../../lib/utils';
import { recordBackupCompleted } from '../../../lib/ledgerBackupHealth';

export default function BackupExportSettings() {
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportJSON = async () => {
    setIsExporting(true);
    try {
      const state = useLedgerStore.getState();
      const authState = useAuthStore.getState();
      const payload: any = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        workspace: { id: authState.currentWorkspaceId },
        transactions: state.transactions,
        accounts: state.accounts,
        projects: state.projects,
        budgets: state.budgets,
        vendors: state.vendors,
        customers: state.customers,
        invoices: state.invoices,
        bills: state.bills,
        inventory: state.inventory,
        assets: state.assets,
        recurringRules: state.recurring,
        employees: state.employees,
        payRuns: state.payRuns,
        taxRates: state.taxRates,
        partners: state.partners,
        reconciliations: state.reconciliations,
        autoRules: state.autoRules,
        metadata: {
          transactionCount: state.transactions.length,
          currency: state.baseCurrency || 'USD'
        }
      };

      // Generate SHA-256 checksum of payload content
      const payloadString = JSON.stringify(payload);
      const msgBuffer = new TextEncoder().encode(payloadString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      payload.metadata.checksum = hashHex;

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ledgerflow-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      if (authState.currentWorkspaceId) {
        recordBackupCompleted(authState.currentWorkspaceId);
      }
      toast.success('Workspace backup exported successfully');
    } catch (e) {
      console.error(e);
      toast.error('Failed to export backup');
    } finally {
      setIsExporting(false);
    }
  };

  const exportCSV = () => {
    setIsExporting(true);
    try {
      const { transactions, accounts } = useLedgerStore.getState();
      
      let csvContent = "Date,Amount,Description,Category,Type,Status,Reference\n";
      
      transactions.forEach(t => {
        const categoryName = t.lines && t.lines.length > 0 ? resolveAccountName(accounts, t.lines[0].accountId, t.lines[0].accountName) : 'Uncategorized';
        const amountStr = formatDecimal(t.totalAmountCents || 0);
        
        const row = [
          t.date,
          amountStr,
          `"${(t.description || '').replace(/"/g, '""')}"`,
          `"${categoryName.replace(/"/g, '""')}"`,
          (t as any).type || 'actual',
          (t as any).status || 'posted',
          `"${((t as any).reference || '').replace(/"/g, '""')}"`
        ];
        
        csvContent += row.join(",") + "\n";
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ledgerflow-transactions-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const authState = useAuthStore.getState();
      if (authState.currentWorkspaceId) {
        recordBackupCompleted(authState.currentWorkspaceId);
      }

      toast.success('Transactions CSV exported successfully');
    } catch (e) {
      console.error(e);
      toast.error('Failed to export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsRestoring(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      if (!payload.schemaVersion || !payload.metadata || !payload.metadata.checksum) {
        throw new Error("Invalid backup format: Missing schema version or checksum");
      }

      // Verify checksum
      const originalChecksum = payload.metadata.checksum;
      delete payload.metadata.checksum; // Remove checksum to re-hash the exact structure
      
      const payloadString = JSON.stringify(payload);
      const msgBuffer = new TextEncoder().encode(payloadString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const calculatedChecksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (originalChecksum !== calculatedChecksum) {
        throw new Error("Backup file corrupted: Checksum verification failed.");
      }

      // Restore dry-run/validation
      if (!Array.isArray(payload.transactions) || !Array.isArray(payload.accounts)) {
         throw new Error("Backup file invalid: Missing core ledger collections.");
      }

      toast.success(`Backup validated! Ready to restore ${payload.transactions.length} transactions. (Restore execution pending implementation)`);
      // NOTE: Actual firestore replacement would go here.
    } catch (e: any) {
      console.error("Restore failed:", e);
      toast.error(`Restore failed: ${e.message}`);
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 border-b border-[var(--line)] pb-6">
        <div className="h-12 w-12 bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center">
          <Database size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">Backup & Export</h2>
          <p className="text-zinc-500">Securely export your data for backups, accountants, or migration.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Archive className="text-zinc-400" size={24} />
            <h3 className="font-bold text-[var(--text)]">Full Workspace Backup</h3>
          </div>
          <p className="text-sm text-zinc-500 mb-6 min-h-[40px]">
            Download a complete JSON snapshot of all your ledgers, accounts, invoices, and settings.
          </p>
          <button 
            onClick={exportJSON}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} />
            Export JSON Backup
          </button>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileSpreadsheet className="text-green-500" size={24} />
            <h3 className="font-bold text-[var(--text)]">Transactions (CSV)</h3>
          </div>
          <p className="text-sm text-zinc-500 mb-6 min-h-[40px]">
            Export all your ledger transactions into a standardized CSV format for accountants or Excel.
          </p>
          <button 
            onClick={exportCSV}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>

        <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Upload className="text-rose-500" size={24} />
            <h3 className="font-bold text-[var(--text)]">Restore Backup</h3>
          </div>
          <p className="text-sm text-zinc-500 mb-6 min-h-[40px]">
            Restore your workspace from a verified JSON backup file. Validates checksum and schema integrity before importing.
          </p>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect}
            accept=".json" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isRestoring}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Upload size={16} />
            Restore Workspace
          </button>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-4">
        <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
        <div>
          <h4 className="font-bold text-amber-500 text-sm">Accountant Access & QBO Export</h4>
          <p className="text-sm text-amber-500/80 mt-1">
            Need a direct IIF or QuickBooks-formatted file? The CSV export can be imported into most major accounting systems. A direct QBO integration is coming in Q4.
          </p>
        </div>
      </div>
    </div>
  );
}
