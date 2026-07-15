import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Book, X, Sparkles, Search, Keyboard
} from 'lucide-react';

interface InstructionGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InstructionGuide({ isOpen, onClose }: InstructionGuideProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const sections: any[] = [];

  const filteredSections = useMemo(() => {
    if (!searchTerm.trim()) return sections;
    const lower = searchTerm.toLowerCase();
    return sections.map((s: any) => ({
      ...s,
      items: s.items.filter((i: any) => 
        i.label.toLowerCase().includes(lower) || 
        i.detail.toLowerCase().includes(lower) ||
        s.title.toLowerCase().includes(lower)
      )
    })).filter((s: any) => s.items.length > 0);
  }, [searchTerm]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 30 }}
            className="relative w-full max-w-5xl bg-slate-50 rounded-[48px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] border border-slate-200 overflow-hidden flex flex-col max-h-[90dvh]"
          >
            {/* Header */}
            <div className="px-12 pt-12 pb-8 flex flex-col gap-8 bg-slate-50 relative">
               <div className="absolute inset-0 overflow-hidden opacity-5 pointer-events-none">
                  <div className="technical-grid absolute inset-0" />
               </div>
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <div className="flex items-center gap-3 mb-2 text-indigo-600">
                    <Book size={24} />
                    <span className="text-[10px] font-medium uppercase tracking-wider truncate">Intelligence Manual</span>
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter font-display">Command Library</h2>
                </div>
                <button 
                  onClick={onClose}
                  className="w-12 h-12 flex items-center justify-center hover:bg-white/5 rounded-full text-slate-500 transition-all border border-slate-200 shadow-sm"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative z-10">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input 
                  autoFocus
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search and discover how to run your business..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-[32px] pl-16 pr-8 py-5 text-lg font-bold text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all placeholder:text-slate-500/50"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-12 pb-12 bg-slate-50">
              {filteredSections.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                  {filteredSections.map((section: any, idx: number) => (
                    <motion.div 
                      layout
                      key={idx} 
                      className="bg-white p-4 md:p-8 rounded-[36px] border border-slate-200 transition-all group hover:border-indigo-600/40"
                    >
                      <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-slate-50 rounded-[32px] flex items-center justify-center shadow-sm border border-slate-200 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                          {section.icon}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 tracking-tight font-display">{section.title}</h3>
                      </div>
                      <div className="space-y-6">
                        {section.items.map((item: any, i: number) => (
                          <div key={i} className="group/item">
                            <h4 className="text-[10px] font-black text-indigo-600 mb-1.5 uppercase tracking-[0.2em]">{item.label}</h4>
                            <p className="text-[14px] text-slate-500 leading-relaxed font-medium group-hover/item:text-slate-900 transition-colors">
                              {item.detail}
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-32 text-center">
                  <div className="w-20 h-20 bg-white rounded-[32px] mx-auto flex items-center justify-center text-slate-500 mb-6">
                    <Search size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">No intelligence found</h3>
                  <p className="text-slate-500 font-medium">Try searching for 'AI', 'Focus', or 'Audit'.</p>
                </div>
              )}

              {/* Shortcuts Footer */}
              {!searchTerm && (
                <div className="mt-12 p-4 md:p-10 bg-white border border-slate-200 text-white rounded-[40px] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 md:p-8 opacity-5 pointer-events-none text-indigo-600">
                    <Keyboard size={120} />
                  </div>
                  <h4 className="text-2xl font-black mb-8 flex items-center gap-3 font-display text-slate-900">
                    <Sparkles className="text-indigo-600" />
                    System Shortcuts
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-8 relative z-10">
                    {[
                      { k: 'Cmd+K', l: 'Analytical Console' },
                      { k: 'Cmd+Shift+F', l: 'Global Search' },
                      { k: 'Cmd+F', l: 'Toggle Focus Mode' },
                      { k: 'Cmd+Q', l: 'Quick Entry' },
                      { k: '1/2/3', l: 'View Switching' },
                      { k: '/', l: 'Focus Search' },
                      { k: 'ESC', l: 'Reset State' },
                      { k: 'ALT+S', l: 'Toggle Sandbox' }
                    ].map((s: any) => (
                      <div key={s.k}>
                        <kbd className="px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono text-[10px] font-bold text-indigo-600 mb-2 inline-block shadow-sm">
                          {s.k}
                        </kbd>
                        <p className="text-[9px] font-medium uppercase tracking-wider text-slate-500">{s.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Bar */}
            <div className="px-12 py-8 border-t border-slate-200 bg-slate-50/30 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                System Core 3.0 • Manual Synchronized
              </div>
              <button 
                onClick={onClose}
                className="btn-primary !px-10 !py-4 font-bold"
              >
                Return to Command
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
