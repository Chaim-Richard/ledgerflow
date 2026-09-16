import React from 'react';
import { Database, Plus } from 'lucide-react';
import AsyncButton from './AsyncButton';
import { useAuthStore } from '../../stores/useAuthStore';
import { useTransactionActions } from '../../hooks/useTransactionActions';
import { toast } from 'sonner';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  showSeedData?: boolean;
}

export function EmptyState({ title, description, actionLabel, onAction, showSeedData = false }: EmptyStateProps) {
  const txActions = useTransactionActions();
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);

  const handleSeedData = async () => {
    if (!currentWorkspaceId) return;
    try {
      // Simulate generating 20 invoices/bills/transactions
      const seedRes = await fetch(`/api/v1/workspaces/${currentWorkspaceId}/seed`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await useAuthStore.getState().user?.getIdToken()}`
        }
      });
      if (!seedRes.ok) throw new Error(await seedRes.text());
      toast.success('Demo data seeded successfully!');
    } catch (e: any) {
      toast.error('Failed to seed data: ' + e.message);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-[var(--line)] rounded-[32px] bg-[var(--ink)]">
      <div className="w-16 h-16 bg-[var(--surface)] border border-[var(--line)] rounded-2xl flex items-center justify-center text-[var(--muted)] mb-6 shadow-sm">
        <Database size={32} />
      </div>
      <h3 className="text-xl font-black text-[var(--text)] tracking-tight mb-2 uppercase">{title}</h3>
      <p className="text-sm font-semibold text-[var(--muted)] max-w-md mb-8">{description}</p>
      
      <div className="flex items-center gap-4">
        {onAction && actionLabel && (
          <button 
            onClick={onAction}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--text)] text-[var(--surface)] rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-800 transition-colors shadow-md"
          >
            <Plus size={16} />
            {actionLabel}
          </button>
        )}
        
        {showSeedData && (
          <AsyncButton 
            onClick={handleSeedData}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--surface)] text-[var(--text)] border border-[var(--line)] rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[var(--ink)] transition-colors"
          >
            SEED DEMO DATA
          </AsyncButton>
        )}
      </div>
    </div>
  );
}
