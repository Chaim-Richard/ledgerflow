import React, { useState } from 'react';
import { Truck, Map, Settings, AlertTriangle, Battery, Navigation, PenTool as Tool, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function FleetLogistics() {
  const fleet: any[] = [];

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Truck className="text-blue-600 w-8 h-8" />
            Fleet & Logistics
          </h1>
          <p className="text-slate-500 mt-2">Manage vehicle assets, route tracking, maintenance schedules, and driver assignments.</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700">
          <Map size={16} /> Route Optimizer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Vehicles', value: '14', icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'In Transit', value: '8', icon: Navigation, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Needs Maintenance', value: '2', icon: Tool, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Avg Fuel Efficiency', value: '18 MPG', icon: Battery, color: 'text-slate-700', bg: 'bg-slate-100' },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg} ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{stat.value}</div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {fleet.map((v, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg transition-shadow group">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{v.vehicle}</h3>
                <p className="text-xs font-mono text-slate-400 mt-1">{v.id}</p>
              </div>
              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                v.status === 'In Transit' ? 'bg-emerald-50 text-emerald-700' :
                v.status === 'Maintenance' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'
              }`}>
                {v.status}
              </span>
            </div>
            
            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Driver</span>
                <span className="font-medium text-slate-900">{v.driver}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Location</span>
                <span className="font-medium text-slate-900 truncate max-w-[120px]">{v.location}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div>
                <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400 mb-1">
                  <span>Fuel Level</span>
                  <span>{v.fuel}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${v.fuel > 20 ? 'bg-emerald-400' : 'bg-rose-400'}`} style={{ width: `${v.fuel}%` }} />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {v.maintenance === 'Good' ? (
                  <CheckCircle2 size={14} className="text-emerald-500" />
                ) : (
                  <AlertTriangle size={14} className="text-rose-500" />
                )}
                <span className={`text-xs font-bold ${v.maintenance === 'Good' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {v.maintenance}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
