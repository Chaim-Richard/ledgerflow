import React, { useState } from 'react';
import { ShoppingBag, RefreshCw, Link2, CheckCircle2, AlertTriangle, Settings, ArrowRight } from 'lucide-react';

export default function EcommerceIntegrations() {
  const [integrations] = useState([
    { name: 'Shopify', status: 'Connected', lastSync: '10 mins ago', orders: 1240, icon: ShoppingBag, color: 'text-emerald-500' },
    { name: 'WooCommerce', status: 'Disconnected', lastSync: 'Never', orders: 0, icon: ShoppingBag, color: 'text-purple-500' },
    { name: 'Amazon Seller', status: 'Syncing', lastSync: 'Just now', orders: 842, icon: ShoppingBag, color: 'text-orange-500' },
    { name: 'Stripe Billing', status: 'Connected', lastSync: '1 hour ago', orders: 412, icon: ShoppingBag, color: 'text-indigo-500' },
  ]);

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Link2 className="text-pink-500 w-8 h-8" />
            E-Commerce & Payment Gateways
          </h1>
          <p className="text-slate-500 mt-2">Connect your sales channels to automatically sync orders, payouts, and fees into the ledger.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrations.map((integration, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between hover:shadow-lg transition-all">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center ${integration.color}`}>
                  <integration.icon size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{integration.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    {integration.status === 'Connected' && <CheckCircle2 size={14} className="text-emerald-500" />}
                    {integration.status === 'Disconnected' && <AlertTriangle size={14} className="text-slate-400" />}
                    {integration.status === 'Syncing' && <RefreshCw size={14} className="text-blue-500 animate-spin" />}
                    <span className={`text-xs font-bold uppercase tracking-wider ${
                      integration.status === 'Connected' ? 'text-emerald-600' :
                      integration.status === 'Syncing' ? 'text-blue-600' : 'text-slate-500'
                    }`}>
                      {integration.status}
                    </span>
                  </div>
                </div>
              </div>
              <button className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100">
                <Settings size={18} />
              </button>
            </div>
            
            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Last Sync</div>
                <div className="text-sm font-medium text-slate-700">{integration.lastSync}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Synced Orders</div>
                <div className="text-sm font-bold text-slate-900">{integration.orders.toLocaleString()}</div>
              </div>
            </div>

            {integration.status === 'Disconnected' && (
              <button className="mt-6 w-full py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors">
                Connect Account
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
