import React, { useState } from 'react';
import { Tag, Plus, X } from 'lucide-react';
import { useLedgerStore } from '../../stores/useLedgerStore';

export default function CustomFieldsManager() {
  const { customFields: fields, setCustomFields: setFields } = useLedgerStore();

  const [newField, setNewField] = useState({ name: '', type: 'Text', showOnSales: true, showOnExpenses: true });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newField.name.trim()) return;
    setFields([...fields, newField]);
    setNewField({ name: '', type: 'Text', showOnSales: true, showOnExpenses: true });
  };

  const handleRemove = (name: string) => {
    setFields(fields.filter(f => f.name !== name));
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 h-full overflow-y-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-[32px] bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-lg">
          <Tag size={24} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900">Custom Tracking Fields</h1>
          <p className="text-sm font-medium text-slate-500">Extend transactions with arbitrary label mappings beyond the standard chart of accounts.</p>
        </div>
      </div>

      <div className="p-6 md:p-8 bg-white border border-slate-200 rounded-[32px] space-y-8 shadow-sm">
        
        <form onSubmit={handleAdd} className="p-6 bg-slate-50 rounded-[32px] border border-slate-200 space-y-4">
          <h3 className="font-bold text-xs uppercase tracking-widest text-slate-500">Define New Scalar Dimension</h3>
          <div className="flex flex-wrap md:flex-nowrap gap-4">
            <input 
              type="text" 
              placeholder="Field Label (e.g., 'PO Number')"
              value={newField.name}
              onChange={e => setNewField({...newField, name: e.target.value})}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-600 transition-all font-bold text-sm"
            />
            <select
              value={newField.type}
              onChange={e => setNewField({...newField, type: e.target.value})}
              className="w-full md:w-40 px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-600 transition-all font-bold text-sm"
            >
              <option value="Text">Text Input</option>
              <option value="Date">Date Select</option>
              <option value="Number">Numeric Value</option>
              <option value="Dropdown">Dropdown</option>
            </select>
            <button type="submit" className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-black transition-all">
              <Plus size={18} />
            </button>
          </div>
          
          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={newField.showOnSales} onChange={e => setNewField({...newField, showOnSales: e.target.checked})} className="rounded border-zinc-300 text-slate-900 focus:ring-indigo-600" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Map to Sales Forms</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={newField.showOnExpenses} onChange={e => setNewField({...newField, showOnExpenses: e.target.checked})} className="rounded border-zinc-300 text-slate-900 focus:ring-indigo-600" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Map to Bills/Expenses</span>
            </label>
          </div>
        </form>

        <div className="space-y-4">
          <h3 className="font-bold text-xs uppercase tracking-widest text-slate-500 px-2">Active Field Schema</h3>
          <div className="border border-slate-200 rounded-[32px] overflow-hidden">
             {fields.map((field, i) => (
                <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white border-b border-slate-200 last:border-b-0 hover:bg-slate-50 transition-all group">
                  <div className="flex items-center gap-3 mb-2 md:mb-0">
                    <Tag size={16} className="text-slate-500" />
                    <span className="font-bold text-sm text-slate-900">{field.name}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-500">{field.type}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex gap-3">
                      {field.showOnSales && <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-widest">Sales</span>}
                      {field.showOnExpenses && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase tracking-widest">Expenses</span>}
                    </div>
                    <button onClick={() => handleRemove(field.name)} className="p-2 text-slate-500 hover:text-rose-600 rounded-lg transition-all opacity-0 group-hover:opacity-100 flex items-center gap-2">
                      <X size={16} />
                    </button>
                  </div>
                </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}
