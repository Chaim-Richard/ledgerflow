import React, { useState, useEffect } from 'react';
import { ShieldAlert, Download, X } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useUIStore } from '../../stores/useUIStore';
import { getBackupHealth, BackupHealth } from '../../lib/ledgerBackupHealth';

export const LedgerBackupReminder: React.FC = () => {
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const setActiveTab = useUIStore(s => s.setActiveTab);
  const [health, setHealth] = useState<BackupHealth>(() => getBackupHealth(currentWorkspaceId));
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setHealth(getBackupHealth(currentWorkspaceId));
    setIsDismissed(false);

    const handleBackupDone = () => {
      setHealth(getBackupHealth(currentWorkspaceId));
    };

    window.addEventListener('ledgerflow:backup_completed', handleBackupDone);
    return () => window.removeEventListener('ledgerflow:backup_completed', handleBackupDone);
  }, [currentWorkspaceId]);

  if (!health.isDue || isDismissed) {
    return null;
  }

  const handleGoToBackup = () => {
    setActiveTab('settings' as unknown as string);
  };

  return (
    <div 
      role="status"
      id="ledger-backup-reminder-banner"
      className="bg-amber-500/10 border-b border-amber-500/20 text-amber-900 dark:text-amber-300 px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm font-medium transition-colors"
    >
      <div className="flex items-center gap-2.5 overflow-hidden">
        <ShieldAlert className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {health.status === 'never'
            ? "You've never exported a backup. Export an immutable snapshot to protect your ledger data."
            : `Last backup was ${health.daysSinceLastBackup} days ago. We recommend exporting an updated ledger backup every 30 days.`}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-3">
        <button
          onClick={handleGoToBackup}
          id="btn-backup-reminder-export"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 border border-amber-500/30 rounded text-xs font-semibold transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Backup</span>
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          id="btn-backup-reminder-dismiss"
          aria-label="Dismiss backup reminder"
          className="p-1 hover:bg-amber-500/20 rounded text-amber-800 dark:text-amber-400/80 hover:text-amber-950 dark:hover:text-amber-200 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default LedgerBackupReminder;
