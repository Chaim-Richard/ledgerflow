import React, { useState } from 'react';
import { Settings, Wrench, Boxes, Plus, Play, Pause, CheckCircle2, AlertTriangle, ArrowRight, Activity, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ManufacturingBOM() {
  const [activeTab, setActiveTab] = useState<'boms' | 'work_orders' | 'work_centers'>('boms');
  
  const boms: any[] = [];

  const workOrders: any[] = [];

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Cpu className="text-indigo-600 w-8 h-8" />
            Manufacturing & MRP
          </h1>
          <p className="text-slate-500 mt-2">Manage Bills of Materials (BOMs), Work Orders, and Production Routing.</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-xl">
          <button onClick={() => setActiveTab('boms')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'boms' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>Bills of Materials</button>
          <button onClick={() => setActiveTab('work_orders')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'work_orders' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>Work Orders</button>
          <button onClick={() => setActiveTab('work_centers')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'work_centers' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}>Work Centers</button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'boms' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">Active BOMs</h2>
              <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700">
                <Plus size={16} /> Create BOM
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {boms.map(bom => (
                <div key={bom.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900">{bom.product}</h3>
                      <p className="text-xs font-mono text-slate-400 mt-1">{bom.id} • {bom.version}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${bom.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {bom.status}
                    </span>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Standard Cost</div>
                      <div className="font-bold text-slate-700">${bom.cost.toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Components</div>
                      <div className="font-bold text-slate-700 flex items-center justify-end gap-1">
                        <Boxes size={14} className="text-indigo-400" /> {bom.components}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'work_orders' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-bold">
                    <th className="p-4">Work Order</th>
                    <th className="p-4">Product BOM</th>
                    <th className="p-4">Quantity</th>
                    <th className="p-4">Work Center</th>
                    <th className="p-4">Progress</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {workOrders.map((wo, i) => (
                    <tr key={wo.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-4 font-mono font-medium text-indigo-600">{wo.id}</td>
                      <td className="p-4 text-slate-700">{wo.bom}</td>
                      <td className="p-4 font-medium text-slate-900">{wo.qty} Units</td>
                      <td className="p-4 text-slate-500">{wo.center}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${wo.progress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${wo.progress}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-600 w-8">{wo.progress}%</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                          wo.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                          wo.status === 'In Progress' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {wo.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          {wo.status === 'Planned' && <button className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100"><Play size={14} /></button>}
                          {wo.status === 'In Progress' && <button className="p-1.5 bg-amber-50 text-amber-600 rounded hover:bg-amber-100"><Pause size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
