import React from 'react';
import { useCollaborators } from '../../hooks/useCollaborators';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export default function Collaborators() {
  const collaborators = useCollaborators();

  return (
    <div className="flex items-center -space-x-2">
      <AnimatePresence>
        {collaborators.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, x: 10, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="relative group shrink-0"
            style={{ zIndex: 10 - i }}
          >
            <div 
              className={cn(
                "w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-sm transition-transform group-hover:-translate-y-1",
              )}
              style={{ backgroundColor: c.color }}
            >
              {(c.name?.[0] || '?').toUpperCase()}
            </div>
            
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-slate-900 text-white text-[9px] font-black rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl border border-white/10 italic">
              {c.name}
            </div>
            
            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
