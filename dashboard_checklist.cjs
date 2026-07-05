const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const target = `{/* Chart Section */}`;
const checklist = `
      {/* Onboarding Checklist */}
      {transactions.length < 10 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-[32px] p-6 lg:p-8 mb-6 shadow-sm">
           <h3 className="text-xl font-bold text-indigo-900 mb-2 flex items-center gap-2">
              <CheckCircle2 size={24} className="text-indigo-600" />
              Welcome to the System
           </h3>
           <p className="text-indigo-700 font-medium mb-6">Complete these steps to get your ERP fully operational.</p>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100 flex items-start gap-3">
                 <div className="p-2 bg-emerald-100 rounded-full text-emerald-600"><CheckCircle2 size={16} /></div>
                 <div>
                    <p className="font-bold text-slate-800 text-sm">Create Workspace</p>
                    <p className="text-xs text-slate-500 mt-1">Your business space is active.</p>
                 </div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100 flex items-start gap-3">
                 <div className="p-2 bg-indigo-100 rounded-full text-indigo-600"><Database size={16} /></div>
                 <div>
                    <p className="font-bold text-slate-800 text-sm">Add Bank Accounts</p>
                    <p className="text-xs text-slate-500 mt-1">Connect or create asset accounts.</p>
                 </div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100 flex items-start gap-3">
                 <div className="p-2 bg-slate-100 rounded-full text-slate-400"><FileText size={16} /></div>
                 <div>
                    <p className="font-bold text-slate-800 text-sm">Create First Invoice</p>
                    <p className="text-xs text-slate-500 mt-1">Get paid by your customers.</p>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Chart Section */}`;

if (content.includes(target)) {
  if (!content.includes('Welcome to the System')) {
    content = content.replace("import { DollarSign, ArrowUpRight, ArrowDownRight, Zap, Loader2, TrendingUp, Activity, CheckCircle2 } from 'lucide-react';", "import { DollarSign, ArrowUpRight, ArrowDownRight, Zap, Loader2, TrendingUp, Activity, CheckCircle2, Database, FileText } from 'lucide-react';");
    content = content.replace(target, checklist);
    fs.writeFileSync('src/components/Dashboard.tsx', content);
    console.log("Added Onboarding Checklist");
  } else {
    console.log("Checklist already exists.");
  }
} else {
  console.log("Target not found.");
}
