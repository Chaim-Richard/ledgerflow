import React, { useState } from 'react';
import { Building, Key, Wrench, FileText, Plus, Search, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function PropertyManager() {
  const [activeTab, setActiveTab] = useState<'properties' | 'leases' | 'maintenance'>('properties');
  
  
  const properties: any[] = []; 
  const leases: any[] = [];

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Building className="text-emerald-600 w-8 h-8" />
            Property Management
          </h1>
          <p className="text-slate-500 mt-2">Manage commercial real estate, active lease agreements, and facility maintenance.</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-xl">
          <button onClick={() => setActiveTab('properties')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'properties' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>Portfolio</button>
          <button onClick={() => setActiveTab('leases')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'leases' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>Leases</button>
          <button onClick={() => setActiveTab('maintenance')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'maintenance' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>Facilities</button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'properties' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {properties.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                  <Building className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Empty Real Estate Portfolio</h3>
                <p className="text-slate-500 max-w-md">You have not added any properties to your management portfolio yet. Add a building to start tracking leases and occupancy.</p>
                <button className="mt-6 bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors">
                  Add Property
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {/* Render properties here */}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
