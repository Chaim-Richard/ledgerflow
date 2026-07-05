import React, { useState } from 'react';
import { Tag, MapPin, Search, Plus, ListFilter } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function ClassLocationManager() {
  const [activeTab, setActiveTab] = useState<'classes' | 'locations'>('classes');

  const classes = [
    { id: 'CLS-01', name: 'Software Sales', status: 'Active', parent: 'None' },
    { id: 'CLS-02', name: 'Hardware Sales', status: 'Active', parent: 'None' },
    { id: 'CLS-03', name: 'Consulting', status: 'Active', parent: 'Services' },
  ];

  const locations = [
    { id: 'LOC-NY', name: 'New York HQ', status: 'Active', region: 'North America' },
    { id: 'LOC-LDN', name: 'London Office', status: 'Active', region: 'EMEA' },
  ];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Tag className="w-6 h-6 text-pink-400" />
            Class & Location Tracking
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Segment your income and expenses by department, project line, or physical location.
          </p>
        </div>
        <button className="h-10 px-4 bg-pink-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-pink-400 transition-colors">
           <Plus className="w-4 h-4" /> Add Record
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'classes', label: 'Classes (Departments)', icon: Tag },
            { id: 'locations', label: 'Locations', icon: MapPin }
          ].map(tab => (
             <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                   "px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                   activeTab === tab.id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
                )}
             >
                <tab.icon className="w-4 h-4" /> {tab.label}
             </button>
          ))}
        </div>

        {activeTab === 'classes' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-4">Class Name</div>
              <div className="col-span-4">Parent Class</div>
              <div className="col-span-4 text-right">Status</div>
            </div>
            <div className="divide-y divide-slate-200">
              {classes.map(c => (
                <div key={c.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-4">
                    <div className="font-bold text-slate-900">{c.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{c.id}</div>
                  </div>
                  <div className="col-span-4 text-sm text-slate-600">
                    {c.parent}
                  </div>
                  <div className="col-span-4 flex justify-end">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'locations' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-4">Location Name</div>
              <div className="col-span-4">Region</div>
              <div className="col-span-4 text-right">Status</div>
            </div>
            <div className="divide-y divide-slate-200">
              {locations.map(loc => (
                <div key={loc.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-4">
                    <div className="font-bold text-slate-900">{loc.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{loc.id}</div>
                  </div>
                  <div className="col-span-4 text-sm text-slate-600">
                    {loc.region}
                  </div>
                  <div className="col-span-4 flex justify-end">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {loc.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
