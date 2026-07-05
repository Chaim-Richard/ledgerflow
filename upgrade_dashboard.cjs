const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

if (!content.includes('Quick Actions')) {
  const replaceTarget = `{/* The 3 Core Numbers */}`;
  const quickActions = `
      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <button className="p-4 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-colors rounded-2xl flex flex-col items-center justify-center gap-2 text-indigo-700 font-medium">
          <div className="p-2 bg-white rounded-full shadow-sm"><DollarSign size={18} className="text-indigo-600" /></div>
          Create Invoice
        </button>
        <button className="p-4 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-colors rounded-2xl flex flex-col items-center justify-center gap-2 text-emerald-700 font-medium">
          <div className="p-2 bg-white rounded-full shadow-sm"><ArrowUpRight size={18} className="text-emerald-600" /></div>
          Record Receipt
        </button>
        <button className="p-4 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors rounded-2xl flex flex-col items-center justify-center gap-2 text-rose-700 font-medium">
          <div className="p-2 bg-white rounded-full shadow-sm"><ArrowDownRight size={18} className="text-rose-600" /></div>
          Add Bill
        </button>
        <button className="p-4 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-700 font-medium">
          <div className="p-2 bg-white rounded-full shadow-sm"><Activity size={18} className="text-slate-600" /></div>
          Reconcile
        </button>
      </div>
      
      {/* The 3 Core Numbers */}`;
  
  content = content.replace(replaceTarget, quickActions);
  fs.writeFileSync('src/components/Dashboard.tsx', content);
  console.log("Upgraded Dashboard");
}
