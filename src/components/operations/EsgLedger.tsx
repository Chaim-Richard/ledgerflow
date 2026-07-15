import React from 'react';
import { Leaf, FileText, BarChart3, Cloud, Wind, Zap } from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function EsgLedger() {
  const transactions = useLedgerStore(state => state.transactions);

  // Mock calculation of ESG based on transactions
  // Real implementation would extract exact values from metadata
  const totalEmissions = transactions.length * 45.2; 
  
  const data: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA] dark:bg-[#0c0d0e]">
      <div className="px-8 py-6 bg-emerald-950 text-white flex justify-between items-start border-b border-emerald-900">
        <div>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
            <Leaf className="w-6 h-6 text-emerald-400" />
            ESG & Carbon Ledger
          </h1>
          <p className="text-sm text-emerald-400/80 mt-1 uppercase tracking-widest font-bold">
            Automated Environmental Impact Tracking & OCR Extraction
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 space-y-8 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-[#161718] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2"><Cloud className="w-4 h-4"/> YTD Carbon (CO2e)</h3>
            <p className="text-4xl font-black italic tracking-tighter text-slate-900 dark:text-white">
              {Math.round(totalEmissions).toLocaleString()} <span className="text-lg text-slate-500">kg</span>
            </p>
          </div>
          <div className="bg-white dark:bg-[#161718] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2"><Zap className="w-4 h-4"/> Energy (Electricity)</h3>
            <p className="text-4xl font-black italic tracking-tighter text-slate-900 dark:text-white">
              42.5 <span className="text-lg text-slate-500">MWh</span>
            </p>
          </div>
          <div className="bg-white dark:bg-[#161718] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2"><Wind className="w-4 h-4"/> Gas & Travel</h3>
            <p className="text-4xl font-black italic tracking-tighter text-slate-900 dark:text-white">
              1,240 <span className="text-lg text-slate-500">Therms</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-[#161718] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white mb-6">Emissions Trajectory</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" />
                  <XAxis dataKey="month" stroke="#666" fontSize={10} tickLine={false} />
                  <YAxis stroke="#666" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#111', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Bar dataKey="co2" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-white dark:bg-[#161718] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white mb-6">Recent OCR Extractions</h3>
            <div className="flex-1 space-y-4">
              {[
                { vendor: 'Pacific Gas & Electric', co2: '+412 kg CO2e', source: '1050 kWh' },
                { vendor: 'Delta Airlines', co2: '+850 kg CO2e', source: '2300 Miles' },
                { vendor: 'Amazon Web Services', co2: '+120 kg CO2e', source: 'Data Center' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{item.vendor}</p>
                    <p className="text-xs text-slate-500">{item.source}</p>
                  </div>
                  <div className="text-sm font-black text-emerald-500">{item.co2}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6">
           <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-2 mb-2">
             <FileText className="w-4 h-4" /> Integrated Compliance Protocol
           </h4>
           <p className="text-sm text-emerald-800 dark:text-emerald-500 leading-relaxed max-w-3xl">
             LedgerFlow’s expense capture mechanism extracts environmental volume metrics (kWh, therms, miles) directly from vendor invoices. These values are mapped against regional emissions factors and stored as dimensional metadata inside the transaction line, establishing an audit-ready single source of truth for corporate ESG reporting.
           </p>
        </div>
      </div>
    </div>
  );
}
