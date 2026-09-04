import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  UploadCloud, 
  Settings, 
  RefreshCw, 
  Trash2,
  Lock
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { AppTab } from '../../types';

interface ContextualToolbeltProps {
  activeTab: AppTab;
  currentWorkspaceId: string | null;
  onAction: (action: string, details?: any) => void;
  isPrivacyMode: boolean;
  onTogglePrivacy: () => void;
  onTriggerReconcile: () => void;
  isConsistent: boolean;
}

export default function ContextualToolbelt({
  activeTab,
  currentWorkspaceId,
  onAction,
  isPrivacyMode,
  onTogglePrivacy,
  onTriggerReconcile,
  isConsistent
}: ContextualToolbeltProps) {
  
  if (!currentWorkspaceId) return null;

  // Compile context-aware operational tools
  const getContextTools = () => {
    switch (activeTab) {
      case 'dashboard':
      case 'transactions':
      case 'ledger':
        return [
          {
            id: 'quick-entry',
            label: 'New Entry',
            icon: Plus,
            action: () => onAction('quick-entry'),
            tooltip: 'Add standard manual transaction'
          },
          {
            id: 'paste-statement',
            label: 'Import Data',
            icon: UploadCloud,
            action: () => onAction('paste-statement'),
            tooltip: 'Import CSV or QBO files'
          }
        ];
      default:
        return [];
    }
  };

  const tools = getContextTools();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ type: 'spring', stiffness: 260, damping: 25 }}
        className="w-full shrink-0 flex overflow-x-auto justify-start items-center gap-2 px-4 md:px-6 py-2.5 bg-[#fbfbfc] border-b border-[var(--line)] text-[var(--text)] relative z-[40] transition-all"
      >
        <div className="flex items-center gap-1.5 pr-4 border-r border-[var(--line)] shrink-0">
           
           {/* Privacy Toggle Button inside Toolbelt */}
           <button
             onClick={onTogglePrivacy}
             className={cn(
               "p-1.5 rounded-md transition-colors text-slate-500 hover:text-[var(--text)] hover:bg-slate-100 bg-transparent",
               isPrivacyMode && "text-emerald-600 bg-emerald-50"
             )}
             title={isPrivacyMode ? "Toggle visible figures" : "Mask sensitive financials"}
            aria-label="isPrivacyMode ?">
             <Lock size={14} />
           </button>

           {/* Core balance trigger inside Toolbelt */}
           <button
             onClick={onTriggerReconcile}
             className={cn(
               "p-1.5 rounded-md transition-colors text-slate-500 hover:text-[var(--text)] hover:bg-slate-100 bg-transparent",
               !isConsistent && "text-rose-600 bg-rose-50"
             )}
             title="Recalculate dual equilibrium balance validation"
            aria-label="Recalculate dual equilibrium balance validation">
             <RefreshCw size={14} className={cn(!isConsistent && "animate-spin")} />
           </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={tool.action}
              className="whitespace-nowrap shrink-0 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--surface)] hover:bg-[var(--ink)] active:bg-slate-100 border border-[var(--line)] text-slate-700 shadow-sm hover:text-[var(--text)] flex items-center gap-1.5 transition-all group"
              title={tool.tooltip}
             aria-label="tool.tooltip">
              <tool.icon size={14} className="text-slate-500 group-hover:text-[var(--text)] transition-colors" />
              <span>{tool.label}</span>
            </button>
          ))}
        </div>

        {/* Workspace Quick actions */}
        <div className="flex items-center gap-1 pl-4 border-l border-[var(--line)] shrink-0 ml-auto">
          <button
            onClick={() => onAction('reset-workspace')}
            className="p-1.5 rounded-full text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Wipe workspace data"
          >
            <Trash2 size={13} />
          </button>
          <button
            onClick={() => onAction('select-architecture')}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-800 hover:bg-gray-50 transition-colors"
            title="Setup business templates"
          >
            <Settings size={13} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
