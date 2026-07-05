import React, { useState } from 'react';
import { ShoppingCart, Globe, CreditCard, Tag, ArrowRight, TrendingUp, Filter, Search, Plus, Store } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

export default function ECommerceIntegration() {
  const [activeTab, setActiveTab] = useState<'channels' | 'orders'>('channels');

  const mockChannels: any[] = [];

  const totalGMV = mockChannels.reduce((sum, c) => sum + c.gmv, 0);
  const totalOrders = mockChannels.reduce((sum, c) => sum + c.orders, 0);

  return (
    <div className="h-full flex flex-col bg-[#FAFAFA]">
      <div className="px-8 py-6 bg-white border-b border-[#E5E5E5] flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#0A0A0A] flex items-center gap-3">
            <ShoppingCart className="w-6 h-6 text-emerald-600" />
            E-Commerce & Omnichannel
          </h1>
          <p className="text-sm text-[#525252] mt-1">
            Connect online sales channels to your general ledger for real-time gross volume tracking and inventory sync.
          </p>
        </div>
        <button className="h-10 px-4 bg-[#0A0A0A] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#1A1A1A] transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Connect Channel
        </button>
      </div>

      <div className="flex-1 overflow-auto p-8">
        {/* KPI Dashboard */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Gross Merchandise Volume (GMV)</span>
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">${(totalGMV / 100).toLocaleString()}</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Total Orders</span>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Tag className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">{totalOrders.toLocaleString()}</div>
          </div>

          <div className="p-6 bg-white rounded-2xl border border-[#E5E5E5] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#525252] uppercase tracking-wider">Active Channels</span>
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <Globe className="w-4 h-4 text-indigo-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-[#0A0A0A]">{mockChannels.length}</div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex p-1 bg-white border border-[#E5E5E5] rounded-xl shadow-sm mb-6 w-max">
          {[
            { id: 'channels', label: 'Sales Channels', icon: Store },
            { id: 'orders', label: 'Order Sync Log', icon: ShoppingCart }
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

        {activeTab === 'channels' && (
          <div className="grid grid-cols-2 gap-6">
            {mockChannels.map(channel => (
              <div key={channel.id} className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-sm flex flex-col group hover:border-[#0A0A0A] transition-all cursor-pointer">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-[#0A0A0A] flex items-center gap-2">
                      {channel.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 bg-[#FAFAFA] border border-[#E5E5E5] rounded text-[10px] font-bold text-[#525252] uppercase tracking-wider">
                        {channel.platform}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                        channel.status === 'Connected' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      )}>
                        {channel.status}
                      </span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#FAFAFA] border border-[#E5E5E5] flex items-center justify-center text-[#0A0A0A] group-hover:bg-[#0A0A0A] group-hover:text-white transition-colors">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-auto">
                  <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E5E5E5]">
                    <div className="text-[10px] font-bold text-[#525252] uppercase tracking-wider mb-1">Orders Synced</div>
                    <div className="text-lg font-bold text-[#0A0A0A]">{channel.orders.toLocaleString()}</div>
                  </div>
                  <div className="bg-[#FAFAFA] rounded-xl p-3 border border-[#E5E5E5]">
                    <div className="text-[10px] font-bold text-[#525252] uppercase tracking-wider mb-1">Channel GMV</div>
                    <div className="text-lg font-mono font-bold text-[#0A0A0A]">${(channel.gmv / 100).toLocaleString()}</div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-[#E5E5E5] flex justify-between items-center text-xs text-[#525252]">
                  <span>Last sync: {channel.lastSync}</span>
                  <button className="font-bold text-[#0A0A0A] hover:underline">Force Sync</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'orders' && (
           <div className="bg-white border border-[#E5E5E5] rounded-2xl p-12 text-center shadow-sm">
             <ShoppingCart className="w-12 h-12 text-[#A3A3A3] mx-auto mb-4" />
             <h3 className="text-xl font-bold text-[#0A0A0A]">Order Sync Log</h3>
             <p className="text-[#525252] mt-2 max-w-md mx-auto">
               Detailed logs of individual orders synchronizing from active channels into ledger sales receipts and invoices.
             </p>
           </div>
        )}
      </div>
    </div>
  );
}
