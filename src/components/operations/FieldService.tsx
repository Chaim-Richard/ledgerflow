import React, { useState } from 'react';
import { MapPin, PenTool as Tool, Calendar, Clock, CheckCircle2, AlertTriangle, Users, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function FieldService() {
  const [activeTab, setActiveTab] = useState<'dispatch' | 'jobs' | 'technicians'>('dispatch');
  
  
  const activeJobs: any[] = []; 
  const technicians: any[] = [];

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Tool className="text-orange-500 w-8 h-8" />
            Field Service Management
          </h1>
          <p className="text-slate-500 mt-2">Dispatch technicians, track on-site jobs, and manage field operations.</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-xl">
          <button onClick={() => setActiveTab('dispatch')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'dispatch' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500'}`}>Dispatch Board</button>
          <button onClick={() => setActiveTab('jobs')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'jobs' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500'}`}>Work Orders</button>
          <button onClick={() => setActiveTab('technicians')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'technicians' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500'}`}>Technicians</button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'dispatch' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {activeJobs.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mb-6">
                  <Navigation className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">No Active Field Jobs</h3>
                <p className="text-slate-500 max-w-md">There are currently no active dispatch orders. Create a work order from the CRM or Helpdesk to route a technician.</p>
                <button className="mt-6 bg-orange-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-orange-600 transition-colors">
                  Create Work Order
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Render jobs here when data exists */}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
