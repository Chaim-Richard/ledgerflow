const fs = require('fs');
let file = fs.readFileSync('src/components/finance/PayrollHub.tsx', 'utf8');

const badBlock = `            <button 
              onClick={handleSeedDefaults}
              disabled={isSubmitting}
              className="px-8 py-4 bg-indigo-600 text-white font-black uppercase tracking-wider text-xs rounded-[32px] hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Initialize Standard Team Profiles
            </button>`;

file = file.replace(badBlock, "");
const otherBadBlock = `  // Auto-seed handler to populate default employees in database securely\n        </div>\n      </div>`;
const goodBlock = `  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Users className="w-6 h-6 text-indigo-400" />
            Payroll & Workforce Hub
          </h1>
          <p className="text-sm text-slate-400 mt-1">Manage global workforce profiles, automated tax tables, and period pay runs.</p>
        </div>
      </div>`;
file = file.replace(otherBadBlock, goodBlock);
fs.writeFileSync('src/components/finance/PayrollHub.tsx', file);
