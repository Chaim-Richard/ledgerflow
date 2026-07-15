const fs = require('fs');

let monitor = fs.readFileSync('src/components/platform/ArchitectureMonitor.tsx', 'utf8');

// We want to insert the DAL card right before the "Data Flow Line"
monitor = monitor.replace(
  '{/* Data Flow Line */}',
  `
        {/* Data Access Layer (DAL) */}
        <div className="w-px h-8 bg-gradient-to-b from-slate-300 to-slate-200 relative">
           <motion.div 
             animate={{ y: [0, 32] }}
             transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
             className="absolute top-0 -left-1 w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.6)]"
           />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-sm"
        >
          <div className="p-6 bg-white border border-slate-200 rounded-[32px] shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-all">
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 flex items-center justify-center mb-4 shadow-inner">
                <Database size={24} />
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500 mb-1">Data Access Layer (DAL)</h4>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Abstract Storage Provider</h3>
              <p className="text-xs text-slate-500 mt-2">Currently mapped to FirebaseAdapter. Ready to swap to SupabaseAdapter with zero UI changes.</p>
            </div>
          </div>
        </motion.div>

        {/* Data Flow Line 2 */}
  `
);

fs.writeFileSync('src/components/platform/ArchitectureMonitor.tsx', monitor);
