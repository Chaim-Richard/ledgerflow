const fs = require('fs');

let crmCode = fs.readFileSync('src/components/sales/CrmPipeline.tsx', 'utf8');

const modalCode = `
      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-xl border border-slate-200 p-6 w-full max-w-md"
          >
            <h2 className="text-xl font-bold text-slate-900 mb-4">New Deal</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Client Name</label>
                <input type="text" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="Enter client name" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Amount ($)</label>
                <input type="number" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="0.00" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Probability (%)</label>
                  <input type="number" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" placeholder="50" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Close Date</label>
                  <input type="date" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button 
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors"
              >
                Create Deal
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
`;

crmCode = crmCode.replace(/    <\/div>\n  \);\n}/, modalCode + '}');
fs.writeFileSync('src/components/sales/CrmPipeline.tsx', crmCode);
