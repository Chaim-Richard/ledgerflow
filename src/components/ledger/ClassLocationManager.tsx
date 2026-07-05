import React, { useState } from 'react';
import { Layers, MapPin, Briefcase, Plus, X, Search, Edit2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLedgerStore } from '../../stores/useLedgerStore';

export default function ClassLocationManager() {
  const [activeTab, setActiveTab] = useState<'class' | 'location' | 'project'>('class');
  
  const { classes, locations, projects, setClasses, setLocations, setProjects } = useLedgerStore();
  
  const projectNames = projects.map(p => p.name);

  const getItems = () => {
    switch (activeTab) {
      case 'class': return classes;
      case 'location': return locations;
      case 'project': return projectNames;
    }
  };

  const currentItems = getItems();
  const [newItem, setNewItem] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    
    if (activeTab === 'class') {
      setClasses([...classes, newItem.trim()]);
    } else if (activeTab === 'location') {
      setLocations([...locations, newItem.trim()]);
    } else {
      setProjects([...projects, {
        id: `prj_${Date.now()}`,
        uid: 'demo',
        workspaceId: 'demo',
        name: newItem.trim(),
        type: 'general',
        status: 'active',
        budgetCents: 0,
        dimensions: [],
        createdAt: new Date().toISOString()
      }]);
    }
    setNewItem('');
  };

  const handleRemove = (item: string) => {
    const { transactions, setTransactions } = useLedgerStore.getState();
    const updateTransactions = (type: 'class' | 'location' | 'project') => {
      const updated = transactions.map(tx => {
        let changed = false;
        const newLines = tx.lines.map(line => {
          if (type === 'class' && line.class === item) { changed = true; return { ...line, class: '' }; }
          if (type === 'location' && line.location === item) { changed = true; return { ...line, location: '' }; }
          if (type === 'project' && line.project === item) { changed = true; return { ...line, project: '' }; }
          return line;
        });
        return changed ? { ...tx, lines: newLines } : tx;
      });
      setTransactions(updated);
    };

    if (activeTab === 'class') {
      setClasses(classes.filter(i => i !== item));
      updateTransactions('class');
    } else if (activeTab === 'location') {
      setLocations(locations.filter(i => i !== item));
      updateTransactions('location');
    } else {
      setProjects(projects.filter(p => p.name !== item));
      updateTransactions('project');
    }
  };

  const startEdit = (item: string) => {
    setEditingItem(item);
    setEditValue(item);
  };

  const saveEdit = (oldItem: string) => {
    if (!editValue.trim() || editValue.trim() === oldItem) {
      setEditingItem(null);
      return;
    }

    const newValue = editValue.trim();
    const { transactions, setTransactions } = useLedgerStore.getState();
    const updateTransactions = (type: 'class' | 'location' | 'project') => {
      const updated = transactions.map(tx => {
        let changed = false;
        const newLines = tx.lines.map(line => {
          if (type === 'class' && line.class === oldItem) { changed = true; return { ...line, class: newValue }; }
          if (type === 'location' && line.location === oldItem) { changed = true; return { ...line, location: newValue }; }
          if (type === 'project' && line.project === oldItem) { changed = true; return { ...line, project: newValue }; }
          return line;
        });
        return changed ? { ...tx, lines: newLines } : tx;
      });
      setTransactions(updated);
    };

    if (activeTab === 'class') {
      setClasses(classes.map(i => i === oldItem ? newValue : i));
      updateTransactions('class');
    } else if (activeTab === 'location') {
      setLocations(locations.map(i => i === oldItem ? newValue : i));
      updateTransactions('location');
    } else {
      setProjects(projects.map(p => p.name === oldItem ? { ...p, name: newValue } : p));
      updateTransactions('project');
    }
    setEditingItem(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 h-full overflow-y-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-[32px] bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-lg">
          <Layers size={24} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900">Advanced Segmentation</h1>
          <p className="text-sm font-medium text-slate-500">Manage Classes, Locations, and Projects for multidimensional ledger tracking.</p>
        </div>
      </div>

      <div className="p-6 md:p-8 bg-white border border-slate-200 rounded-[32px] space-y-8 shadow-sm">
        <div className="flex items-center p-1 bg-slate-50 rounded-xl w-full">
          <button 
            onClick={() => setActiveTab('class')}
            className={cn("flex-1 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all", activeTab === 'class' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900")}
          >
            Class / Department
          </button>
          <button 
            onClick={() => setActiveTab('location')}
            className={cn("flex-1 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all", activeTab === 'location' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900")}
          >
            Locations / Stores
          </button>
          <button 
            onClick={() => setActiveTab('project')}
            className={cn("flex-1 px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all", activeTab === 'project' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-900")}
          >
            Job / Project
          </button>
        </div>

        <form onSubmit={handleAdd} className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input 
              type="text" 
              placeholder={`Add new ${activeTab}...`}
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 transition-all font-bold text-sm"
            />
          </div>
          <button type="submit" className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest hover:bg-black transition-all">
            <Plus size={18} />
          </button>
        </form>

        <div className="space-y-2">
          {currentItems.map((item, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-transparent hover:border-slate-200 transition-all group">
              <div className="flex items-center gap-3 flex-1 mr-4">
                {activeTab === 'class' ? <Layers size={18} className="text-emerald-500 shrink-0" /> : activeTab === 'location' ? <MapPin size={18} className="text-blue-500 shrink-0" /> : <Briefcase size={18} className="text-purple-500 shrink-0" />}
                
                {editingItem === item ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => saveEdit(item)}
                    onKeyDown={e => e.key === 'Enter' && saveEdit(item)}
                    autoFocus
                    className="w-full px-3 py-1.5 rounded-lg border border-indigo-600/50 bg-white focus:ring-2 focus:ring-indigo-600 transition-all font-bold text-sm"
                  />
                ) : (
                  <span className="font-bold text-sm text-slate-900">{item}</span>
                )}
              </div>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {editingItem !== item && (
                  <button onClick={() => startEdit(item)} className="p-2 bg-white text-slate-900 hover:text-indigo-600 hover:border-indigo-600 border border-slate-200 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                    <Edit2 size={14} /> Edit
                  </button>
                )}
                <button onClick={() => handleRemove(item)} className="p-2 bg-white text-slate-500 hover:text-rose-600 border border-slate-200 rounded-lg transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                  <X size={14} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
