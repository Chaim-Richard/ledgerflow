import React, { useState } from 'react';
import { Tag, Percent, Users, Calendar, Filter, Plus, Zap, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function PricingEngine() {
  const [activeTab, setActiveTab] = useState<'rules' | 'groups' | 'promotions'>('rules');
  
  
  const pricingRules: any[] = []; 
  const customerGroups: any[] = [];

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Tag className="text-blue-600 w-8 h-8" />
            Advanced Pricing Engine
          </h1>
          <p className="text-slate-500 mt-2">Manage dynamic pricing matrices, volume discounts, and customer-specific price lists.</p>
        </div>
        <div className="flex gap-2 bg-slate-100 p-1.5 rounded-xl">
          <button onClick={() => setActiveTab('rules')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'rules' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>Price Rules</button>
          <button onClick={() => setActiveTab('groups')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'groups' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>Customer Groups</button>
          <button onClick={() => setActiveTab('promotions')} className={`px-4 py-2 rounded-lg text-sm font-bold ${activeTab === 'promotions' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>Time-based Promos</button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'rules' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {pricingRules.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-6">
                  <Zap className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">No Active Pricing Rules</h3>
                <p className="text-slate-500 max-w-md">The ledger is currently using base product prices. Create a dynamic rule to configure volume tiers or B2B discounts.</p>
                <button className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors">
                  Create Price Rule
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {/* Render pricing rules here */}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
