import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { useUIStore } from '../../stores/useUIStore';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { onSnapshotsInSync } from 'firebase/firestore';
import { db } from '../../firebase';

export default function ConnectivityMonitor() {
  const isOnline = useUIStore(s => s.isOnline);
  const setIsOnline = useUIStore(s => s.setIsOnline);
  const isSyncing = useUIStore(s => s.isSyncing);
  const setIsSyncing = useUIStore(s => s.setIsSyncing);

  useEffect(() => {
    // Real-time synchronization tracking via Firestore
    const unsubscribeSync = onSnapshotsInSync(db, () => {
      // Fires when all snapshots currently being listened to have been synchronized 
      // with the backend.
      setIsSyncing(false);
    });

    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Rule link established. Synchronizing...', {
        icon: <Wifi className="text-emerald-500" size={16} />,
        duration: 3000
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Working offline. Data physics preserved via local cache.', {
        icon: <WifiOff className="text-rose-500" size={16} />,
        duration: 5000
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeSync();
    };
  }, [setIsOnline, setIsSyncing]);

  if (!isOnline) {
    return (
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-3 px-6 py-3 bg-rose-500 text-[var(--panel)] rounded-full shadow-2xl border border-white/20">
          <WifiOff size={16} />
          <span className="text-xs font-medium uppercase tracking-wider">System Offline</span>
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--surface)] animate-pulse" />
        </div>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center gap-3 px-6 py-3 bg-[var(--ink)] text-[var(--panel)] rounded-full shadow-2xl border border-white/10">
          <Loader2 size={16} className="animate-spin text-indigo-600" />
          <span className="text-xs font-medium uppercase tracking-wider">Rule Syncing...</span>
        </div>
      </div>
    );
  }

  return null;
}
