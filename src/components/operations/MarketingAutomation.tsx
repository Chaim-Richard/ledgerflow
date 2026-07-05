import React, { useState } from 'react';
import { Mail, MessageSquare, Send, Users, Activity, Plus, Search, Filter, PieChart, BarChart3, Target, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export default function MarketingAutomation() {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'audiences' | 'roi'>('campaigns');
  
  const mockCampaigns: any[] = [];

  const totalSpent = mockCampaigns.reduce((sum, c) => sum + c.spentCents, 0);
  const activeCount = mockCampaigns.filter(c => c.status === 'Active').length;
  const totalAudience = mockCampaigns.filter(c => c.status !== 'Draft').reduce((sum, c) => sum + c.audience, 0);

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-white border-b border-[#E5E5E5] flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] flex items-center gap-3">
            <Send className="w-6 h-6 text-violet-600" />
            Marketing & Growth Automation
          </h1>
          <p className="text-sm text-[#525252] mt-1">
            Build campaigns, segment audiences, and measure marketing ROI directly against ledger expenses.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#A3A3A3] absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search campaigns..."
              className="w-64 h-10 pl-9 pr-4 bg-[#FAFAFA] border border-[#E5E5E5] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
            />
          </div>
          <button className="h-10 px-4 bg-[#0A0A0A] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#1A1A1A] transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Create Campaign
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* KPI Dashboard */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Active Campaigns</span>
              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                <Send className="w-4 h-4 text-violet-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">{activeCount}</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Total Reached</span>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">{totalAudience.toLocaleString()}</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Total Ad Spend</span>
              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                <Activity className="w-4 h-4 text-rose-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">${(totalSpent / 100).toLocaleString()}</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm bg-violet-900 text-white">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-violet-300 uppercase tracking-wider">Est. Marketing ROI</span>
              <div className="w-8 h-8 rounded-full bg-violet-800 flex items-center justify-center border border-violet-700">
                <Target className="w-4 h-4 text-violet-200" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white">345%</div>
            <div className="text-[10px] font-medium text-violet-300 mt-2">Based on closed-won attribution</div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex p-1 bg-white border border-[#E5E5E5] rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'campaigns', label: 'Campaigns', icon: Mail },
            { id: 'audiences', label: 'Audience Segments', icon: Users },
            { id: 'roi', label: 'ROI Analysis', icon: BarChart3 }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
                activeTab === tab.id ? "bg-[#0A0A0A] text-white" : "text-[#525252] hover:bg-[#F5F5F5]"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        {activeTab === 'campaigns' && (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 p-4 bg-[#FAFAFA] border-b border-[#E5E5E5] text-[10px] font-bold text-[#525252] uppercase tracking-wider">
              <div className="col-span-4">Campaign Name</div>
              <div className="col-span-2 text-right">Audience</div>
              <div className="col-span-2 text-right">Open Rate</div>
              <div className="col-span-2 text-right">Spend</div>
              <div className="col-span-2 text-right">Status</div>
            </div>
            <div className="divide-y divide-[#E5E5E5]">
              {mockCampaigns.map((camp) => (
                <div key={camp.id} className="grid grid-cols-12 p-4 items-center hover:bg-[#FAFAFA] transition-colors cursor-pointer group">
                  <div className="col-span-4">
                    <div className="font-bold text-[#0A0A0A]">{camp.name}</div>
                    <div className="text-[10px] font-mono text-[#A3A3A3] mt-0.5">{camp.id}</div>
                  </div>
                  <div className="col-span-2 text-right font-mono text-sm text-[#525252]">
                    {camp.audience > 0 ? camp.audience.toLocaleString() : '-'}
                  </div>
                  <div className="col-span-2 text-right">
                    {camp.openRate > 0 ? (
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-sm font-bold text-[#0A0A0A]">{camp.openRate}%</span>
                        <span className="text-[10px] text-[#A3A3A3]">Click: {camp.clickRate}%</span>
                      </div>
                    ) : (
                      <span className="text-sm text-[#A3A3A3]">-</span>
                    )}
                  </div>
                  <div className="col-span-2 text-right font-mono text-sm font-bold text-[#0A0A0A]">
                    ${(camp.spentCents / 100).toLocaleString()}
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <span className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1",
                      camp.status === 'Active' ? "bg-emerald-100 text-emerald-700" : 
                      camp.status === 'Draft' ? "bg-[#F5F5F5] text-[#525252] border border-[#E5E5E5]" :
                      "bg-blue-100 text-blue-700"
                    )}>
                      {camp.status === 'Active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />}
                      {camp.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab !== 'campaigns' && (
          <div className="bg-white border border-[#E5E5E5] rounded-2xl p-12 text-center shadow-sm">
            <PieChart className="w-12 h-12 text-[#A3A3A3] mx-auto mb-4" />
            <h3 className="text-xl font-bold text-[#0A0A0A]">Advanced Analytics</h3>
            <p className="text-[#525252] mt-2 max-w-md mx-auto">
              This module correlates marketing spend in the general ledger with generated sales pipeline to calculate true ROAS.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
