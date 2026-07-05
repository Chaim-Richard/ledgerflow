import React, { useState } from 'react';
import { Network, Search, Filter, Server, Database, Globe, Share2, Shield, Activity, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function NetworkTopology() {
  const [activeTab, setActiveTab] = useState<'nodes' | 'traffic' | 'security'>('nodes');
  const [searchTerm, setSearchTerm] = useState('');

  const mockNodes: any[] = [];

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Network className="w-6 h-6 text-cyan-400" />
            Infrastructure Topology & Diagnostics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time monitoring of distributed network nodes, load balancing, and security policies.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search nodes, IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 h-10 pl-9 pr-4 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-cyan-400 placeholder:text-slate-500"
            />
          </div>
          <button className="h-10 px-4 bg-cyan-500 text-slate-900 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-cyan-400 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Provision Node
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* KPI Dashboard */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Nodes</span>
              <div className="w-8 h-8 rounded-full bg-cyan-50 flex items-center justify-center">
                <Server className="w-4 h-4 text-cyan-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900">42</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Global Traffic</span>
              <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                <Globe className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900">8.4<span className="text-sm text-slate-500 ml-1">TB/s</span></div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Avg Cluster Load</span>
              <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center">
                <Activity className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-slate-900">68%</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm bg-slate-900 text-white">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Security Alerts</span>
              <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-rose-400" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white flex items-center gap-2">
              0 <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">SECURE</span>
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex p-1 bg-white border border-slate-200 rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'nodes', label: 'Node Registry', icon: Server },
            { id: 'traffic', label: 'Traffic Analysis', icon: Activity },
            { id: 'security', label: 'Firewall & Policies', icon: Shield }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                activeTab === tab.id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        {activeTab === 'nodes' && (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <div className="col-span-3">Node Identity</div>
              <div className="col-span-2">Type / Region</div>
              <div className="col-span-2 font-mono">Internal IP</div>
              <div className="col-span-3 text-right">System Load</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            <div className="divide-y divide-slate-200">
              {mockNodes.filter(n => n.name.toLowerCase().includes(searchTerm.toLowerCase()) || n.ip.includes(searchTerm)).map((node) => (
                <div key={node.id} className="grid grid-cols-12 p-4 items-center hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="col-span-3">
                    <div className="font-bold text-slate-900">{node.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{node.id}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                      {node.type === 'Database' ? <Database className="w-3 h-3 text-indigo-500" /> : <Server className="w-3 h-3 text-slate-500" />}
                      {node.type}
                    </div>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mt-0.5">{node.region}</div>
                  </div>
                  <div className="col-span-2 font-mono text-sm text-slate-600">
                    {node.ip}
                  </div>
                  <div className="col-span-3 flex flex-col justify-center items-end pr-8">
                    <div className="flex items-center justify-between w-full max-w-[120px] mb-1">
                      <span className="text-[10px] font-bold text-slate-500">CPU</span>
                      <span className="text-[10px] font-mono font-bold text-slate-900">{node.load}%</span>
                    </div>
                    <div className="w-full max-w-[120px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full transition-all", node.load > 80 ? "bg-rose-500" : node.load > 50 ? "bg-amber-500" : "bg-emerald-500")}
                        style={{ width: `${node.load}%` }}
                      />
                    </div>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5",
                      node.status === 'Online' ? "bg-emerald-50 text-emerald-700" : 
                      node.status === 'Warning' ? "bg-amber-50 text-amber-700" :
                      "bg-rose-50 text-rose-700"
                    )}>
                      {node.status === 'Online' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                      {node.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab !== 'nodes' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <Share2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900">Advanced Diagnostic View</h3>
            <p className="text-slate-500 mt-2 max-w-md mx-auto">
              Select a specific node from the registry to view deep packet inspection, real-time query tracing, and firewall rule configurations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
