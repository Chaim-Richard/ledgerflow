import React, { useState } from 'react';
import { LucideIcon, Database } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { toast } from 'sonner';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  id?: string;
  showDemoButton?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  id = 'empty-state-container',
  showDemoButton = true
}) => {
  const currentWorkspaceId = useAuthStore(s => s.currentWorkspaceId);
  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeed = async () => {
    if (!currentWorkspaceId) return;
    setIsSeeding(true);
    try {
      const token = await useAuthStore.getState().user?.getIdToken();
      const res = await fetch(`/api/v1/workspaces/${currentWorkspaceId}/seed`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to seed');
      toast.success('Demo data loaded successfully!');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      toast.error('Failed to load demo data', { description: err.message });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div id={id} className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 my-6">
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4 text-slate-500 dark:text-slate-400">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">{description}</p>
      
      <div className="flex items-center gap-3">
        {actionLabel && onAction && (
          <button
            id={`${id}-action-btn`}
            onClick={onAction}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            {actionLabel}
          </button>
        )}
        
        {showDemoButton && currentWorkspaceId && (
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <Database size={16} />
            {isSeeding ? 'Loading...' : 'Load Demo Data'}
          </button>
        )}
      </div>
    </div>
  );
};
