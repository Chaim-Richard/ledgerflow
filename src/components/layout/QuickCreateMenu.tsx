import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, FileText, Users, ShoppingCart, UserCheck, RefreshCw, Calculator, FileSpreadsheet } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';

export default function QuickCreateMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const setActiveTab = useUIStore(state => state.setActiveTab);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleAction = (tab: any, action?: string) => {
    setActiveTab(tab);
    setIsOpen(false);
    // Ideally we would trigger a specific 'create' modal here. 
    // For now, switching to the tab where the user can create it is a huge friction reducer.
  };

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="hidden md:flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
      >
        <Plus size={16} />
        <span className="hidden lg:inline">New</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden z-50"
          >
            <div className="p-2 space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 pt-2 pb-1">Customers</div>
              <button onClick={() => handleAction('sales')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-xl transition-colors text-left">
                <FileText size={16} className="text-indigo-500" /> Invoice
              </button>
              <button onClick={() => handleAction('sales')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-xl transition-colors text-left">
                <Users size={16} className="text-emerald-500" /> Customer
              </button>
              
              <div className="h-px bg-slate-100 my-1"></div>
              
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 pt-2 pb-1">Vendors</div>
              <button onClick={() => handleAction('purchases')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-xl transition-colors text-left">
                <FileSpreadsheet size={16} className="text-rose-500" /> Bill
              </button>
              <button onClick={() => handleAction('purchases')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-xl transition-colors text-left">
                <UserCheck size={16} className="text-amber-500" /> Vendor
              </button>

              <div className="h-px bg-slate-100 my-1"></div>

              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 pt-2 pb-1">Other</div>
              <button onClick={() => handleAction('ledger')} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-xl transition-colors text-left">
                <Calculator size={16} className="text-slate-500" /> Journal Entry
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
