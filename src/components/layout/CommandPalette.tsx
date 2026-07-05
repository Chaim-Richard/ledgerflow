import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { SYSTEM_COMMANDS, ANALYTICAL_LENSES_REGISTRY } from '../../config/registry';
import { useUIStore } from '../../stores/useUIStore';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onAction?: (action: string, details?: any) => void;
  onQuery?: (q: string) => Promise<any>;
  recentQueries?: string[];
}

export default function CommandPalette({ isOpen, onClose, onAction }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const language = useUIStore(state => state.language);

  // Map commands to the currently active UI language
  const localizedCommands = React.useMemo(() => {
    const base = SYSTEM_COMMANDS.map(cmd => ({
      id: cmd.id,
      label: cmd.label[language] || cmd.label['en'],
      category: cmd.category,
      actionId: cmd.actionId,
      payload: cmd.payload
    }));

    const lenses = ANALYTICAL_LENSES_REGISTRY.map(lens => ({
      id: `lens-${lens.id}`,
      label: `Open: ${lens.label[language] || lens.label['en']}`,
      category: 'Calculators & Analytics',
      actionId: 'switch-tab',
      payload: { tab: 'intelligence', channel: lens.id } // Intelligence center needs to parse this channel if provided
    }));

    return [...base, ...lenses];
  }, [language]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          onAction?.('open-command-palette');
        }
      }
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isOpen, onClose, onAction]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setIsExecuting(false);
    }
  }, [isOpen]);

  const filteredCommands = query
    ? localizedCommands.filter((command) =>
        command.label.toLowerCase().includes(query.toLowerCase())
      )
    : localizedCommands;

  const handleSelect = async (command: any) => {
    setIsExecuting(true);
    await new Promise(r => setTimeout(r, 400));
    
    // Core Application Action Mappings (safely checked and dynamically dispatched)
    if (onAction && command.actionId) {
      onAction(command.actionId, command.payload);
    }

    toast.success(`${command.label} dispatched`);
    setIsExecuting(false);
    onClose();
  };


  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-gray-900/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed z-[201] top-[10%] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden border border-gray-200"
          >
            <div className="flex items-center px-4 py-3 border-b border-gray-100">
              <Search className="text-gray-400 mr-3" size={20} />
              <input
                autoFocus
                className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-400 text-lg"
                placeholder="Type a command or search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={isExecuting}
              />
              <div className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-[10px] font-mono uppercase tracking-widest hidden sm:block">
                ESC to close
              </div>
            </div>
            
            <div className="max-h-[60dvh] overflow-y-auto">
              {isExecuting ? (
                <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                  <Loader2 className="animate-spin mb-4" size={24} />
                  <p className="text-sm font-medium">Executing command...</p>
                </div>
              ) : filteredCommands.length > 0 ? (
                <div className="p-2 space-y-1">
                  {filteredCommands.map((command, index) => (
                    <button
                      key={command.id}
                      onClick={() => handleSelect(command)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 rounded-xl transition-colors group text-left"
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{command.label}</p>
                        <p className="text-xs text-gray-500">{command.category}</p>
                      </div>
                      <ArrowRight size={16} className="text-gray-300 group-hover:text-gray-900 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-gray-500 text-sm">
                  No commands found.
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
