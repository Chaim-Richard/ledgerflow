import React, { useState } from 'react';
import { ShieldCheck, Target, Search, AlertOctagon, CheckSquare, BarChart, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function QualityControl() {
  const [activeTab, setActiveTab] = useState<'inspections' | 'ncr' | 'metrics'>('inspections');
  
  
  const inspections: any[] = []; 
  const ncrs: any[] = []; // Non-Conformance Reports

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <ShieldCheck className="text-teal-600 w-8 h-8" />
            Quality Control (QA/QC)
          </h1>
          <p className="text-slate-500 mt-2">Manage quality inspections, non-conformance reports, and compliance auditing.</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-xl">
          <button onClick={() => setActiveTab('inspections')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'inspections' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}>Inspections</button>
          <button onClick={() => setActiveTab('ncr')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'ncr' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}>Non-Conformance (NCR)</button>
          <button onClick={() => setActiveTab('metrics')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'metrics' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}>Quality Metrics</button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'inspections' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {inspections.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mb-6">
                  <CheckSquare className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">No Pending Inspections</h3>
                <p className="text-slate-500 max-w-md">All manufacturing batches and received shipments have passed quality gates. Create an inspection template to start a new QA cycle.</p>
                <button className="mt-6 bg-teal-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-teal-700 transition-colors">
                  Create QA Template
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {/* Render QA lists here */}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
