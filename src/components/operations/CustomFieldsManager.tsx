import React, { useState, useMemo } from 'react';
import { Tag, Database, Sliders, Hash, CheckCircle2, Search, Calendar, ToggleLeft, Plus, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase';



export default function CustomFieldsManager() {
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');
  const [fields, setFields] = useState<any[]>([]);
  React.useEffect(() => {
    const unsub = onSnapshot(collection(db, 'fields'), (snap) => {
      if (!snap.empty) {
        setFields(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        setFields([]);
      }
    });
    return unsub;
  }, []);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFields = useMemo(() => {
    let filtered = fields.filter(f => 
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      f.entity.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (activeTab === 'active') {
      filtered = filtered.filter(f => f.active);
    } else {
      filtered = filtered.filter(f => !f.active);
    }
    return filtered;
  }, [fields, searchTerm, activeTab]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'Text': return <Tag className="w-4 h-4 text-slate-400" />;
      case 'Number': return <Hash className="w-4 h-4 text-slate-400" />;
      case 'Dropdown': return <Database className="w-4 h-4 text-slate-400" />;
      case 'Date': return <Calendar className="w-4 h-4 text-slate-400" />;
      case 'Boolean': return <ToggleLeft className="w-4 h-4 text-slate-400" />;
      default: return <Tag className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-8 py-6 bg-slate-900 text-white flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Sliders className="w-6 h-6 text-indigo-400" />
            Custom Fields Manager
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Extend system objects with custom data points for tailored reporting.
          </p>
        </div>
        <div className="flex items-center gap-4">
           <button className="h-10 px-4 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm">
             <Plus className="w-4 h-4" /> Create Field
           </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 md:p-8">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div className="flex space-x-1 p-1 bg-slate-100 rounded-lg w-max">
               {['active', 'inactive'].map(tab => (
                 <button 
                   key={tab}
                   onClick={() => setActiveTab(tab as any)}
                   className={cn(
                     "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                     activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                   )}
                 >
                   {tab === 'active' ? 'Active Fields' : 'Inactive'}
                 </button>
               ))}
             </div>
             
             <div className="relative max-w-sm w-full">
               <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search fields or entities..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
               />
             </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider min-w-[700px]">
              <div className="col-span-4">Field Name / ID</div>
              <div className="col-span-3">Target Entity</div>
              <div className="col-span-3">Data Type</div>
              <div className="col-span-2 text-right">Validation</div>
            </div>
            
            <div className="divide-y divide-slate-100 min-w-[700px]">
              <AnimatePresence>
                {filteredFields.map((f, i) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={f.id} 
                    className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors group cursor-pointer"
                  >
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                         <Settings size={18} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                      </div>
                      <div className="truncate pr-4">
                        <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{f.name}</div>
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">{f.id}</div>
                      </div>
                    </div>
                    
                    <div className="col-span-3 text-sm font-bold text-slate-600 bg-slate-100 py-1 px-2 rounded-md mx-2 text-center truncate">
                      {f.entity}
                    </div>
                    
                    <div className="col-span-3 flex items-center gap-2">
                       <div className="p-1.5 bg-white border border-slate-200 rounded-md shadow-sm">
                         {getIcon(f.type)}
                       </div>
                       <span className="text-sm font-bold text-slate-700">{f.type}</span>
                    </div>
                    
                    <div className="col-span-2 flex justify-end">
                      <span className={cn(
                        "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                        f.required ? "bg-rose-50 text-rose-700 border-rose-200" :
                        "bg-slate-50 text-slate-600 border-slate-200"
                      )}>
                        {f.required ? 'Required' : 'Optional'}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {filteredFields.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <Sliders size={32} className="mx-auto mb-3 text-slate-300" />
                  No {activeTab} custom fields found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
