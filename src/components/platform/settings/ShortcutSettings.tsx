import React, { useState } from 'react';
import { useUIStore } from '../../../stores/useUIStore';
import { APP_TABS, SETTINGS_TABS_REGISTRY, REPORT_TABS_REGISTRY, INTELLIGENCE_TABS_REGISTRY, ANALYTICAL_LENSES_REGISTRY } from '../../../config/registry';
import { Command, Plus, Trash2, Keyboard } from 'lucide-react';

export default function ShortcutSettings() {
  const language = useUIStore(state => state.language);
  const speedDials = useUIStore(state => state.speedDials);
  const setSpeedDial = useUIStore(state => state.setSpeedDial);
  const removeSpeedDial = useUIStore(state => state.removeSpeedDial);

  const [newKey, setNewKey] = useState('');
  const [selectedTab, setSelectedTab] = useState('');

  
  const ALL_TOOLS = [
    ...APP_TABS,
    ...SETTINGS_TABS_REGISTRY,
    ...REPORT_TABS_REGISTRY,
    ...INTELLIGENCE_TABS_REGISTRY,
    ...ANALYTICAL_LENSES_REGISTRY
  ];
  
  const handleAdd = () => {
    if (newKey && selectedTab) {
      setSpeedDial(newKey.toLowerCase(), selectedTab);
      setNewKey('');
      setSelectedTab('');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-black text-[var(--text)] tracking-tight flex items-center gap-3">
          <Keyboard size={24} className="text-slate-400" />
          Speed Dial Shortcuts
        </h2>
        <p className="text-slate-500 mt-2">
          Assign <code>Alt + [Key]</code> to quickly navigate to any tool or tab.
        </p>
      </div>

      <div className="bg-[var(--ink)] border border-[var(--line)] rounded-2xl p-6">
        <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider mb-4">Add New Speed Dial</h3>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Key (e.g. 1, 2, A)</label>
            <input 
              type="text" 
              maxLength={1}
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="w-full px-4 py-2 border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-slate-900 outline-none bg-[var(--surface)]"
              placeholder="Key"
            />
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Tool</label>
            <select 
              value={selectedTab}
              onChange={(e) => setSelectedTab(e.target.value)}
              className="w-full px-4 py-2 border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-slate-900 outline-none bg-[var(--surface)]"
            >
              <option value="">Select a tool...</option>
              {ALL_TOOLS.map(tab => (
                <option key={tab.id} value={tab.id}>
                  {((tab as any).label?.[language] || (tab as any).label?.['en']) || (tab as any).name || tab.id}
                </option>
              ))}
            </select>
          </div>
          <button 
            onClick={handleAdd}
            disabled={!newKey || !selectedTab}
            className="h-10 px-6 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            <Plus size={16} />
            Add
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider">Active Speed Dials</h3>
        {!speedDials || Object.entries(speedDials).length === 0 ? (
          <div className="p-8 border border-dashed border-[var(--line)] rounded-2xl text-center text-slate-500">
            No speed dials configured.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(speedDials).map(([key, tabId]) => {
              const tab = ALL_TOOLS.find(t => t.id === tabId);
              return (
                <div key={key} className="flex items-center justify-between p-4 bg-[var(--surface)] border border-[var(--line)] rounded-2xl shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 text-[var(--text)] rounded-xl flex items-center justify-center font-mono font-bold">
                      ⌥ {key.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[var(--text)]">
                        {tab ? (((tab as any).label?.[language] || (tab as any).label?.['en']) || (tab as any).name || tab.id) : tabId}
                      </div>
                      <div className="text-xs text-slate-500">Alt + {key.toUpperCase()}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeSpeedDial(key)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
