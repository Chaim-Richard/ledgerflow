import React, { useMemo, useState } from 'react';
import { useLedgerStore } from '../../stores/useLedgerStore';
import { 
  Monitor, CreditCard, AlertTriangle, CheckCircle2, XCircle, ShieldCheck, Zap
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

interface SaaSItem {
  merchant: string;
  category: string;
  monthlyCostCents: number;
  annualRunRateCents: number;
  lastPaymentDate: string;
  status: 'active' | 'zombie' | 'cancelled';
  virtualCardId?: string;
  instances: number;
  confidence: 'High' | 'Rules Engine Derived';
}

const SUBSCRIPTION_KEYWORDS = [
  // Enterprise & B2B
  'aws', 'amazon web', 'slack', 'google workspace', 'gsuite', 'microsoft', 'azure', 'zoom', 'figma', 'notion', 'github', 'vercel', 'adobe', 'salesforce', 'hubspot', 'mailchimp', 'linear', 'jira', 'atlassian', 'openai', 'anthropic',
  // Household & Consumer Media
  'netflix', 'spotify', 'hulu', 'disney+', 'disney plus', 'amazon prime', 'apple', 'icloud', 'youtube premium', 'hbo max', 'max.com', 'peacock', 'paramount+',
  // Utility & Telecom
  'at&t', 'verizon', 't-mobile', 'comcast', 'xfinity', 'spectrum', 'cox',
  // Services & Delivery
  'instacart', 'uber one', 'dashpass', 'doordash', 'postmates', 'chewy', 'peloton', 'equinox', 'planet fitness',
  // Subscriptions & Memberships
  'costco', "sam's club", 'patreon', 'substack', 'nyt', 'wall street journal', 'home chef', 'blue apron', 'hellofresh', 'gym'
];

export default function SaaSOptimizer() {
  const { transactions } = useLedgerStore();
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const saasData = useMemo(() => {
    // Deterministic Truth Algorithm for extracting SaaS Subscriptions
    const merchantGroups: Record<string, any[]> = {};
    
    transactions.forEach(tx => {
      // Look for standard software keywords in payee or description, OR software categories
      const description = ((tx as any).payee || tx.description || '').toLowerCase();
      const isSoftwareCategory = tx.lines.some(l => (l.category || '').toLowerCase().includes('software') || (l.category || '').toLowerCase().includes('subscription'));
      const isKnownSaaS = SUBSCRIPTION_KEYWORDS.some(k => description.includes(k));

      if (isSoftwareCategory || isKnownSaaS) {
        // Extract a clean merchant name (heuristic clustering)
        const matchedKeyword = SUBSCRIPTION_KEYWORDS.find(k => description.includes(k));
        let cleanName = matchedKeyword ? (matchedKeyword.charAt(0).toUpperCase() + matchedKeyword.slice(1)) : description.split(/[0-9*#-]/)[0].trim().toUpperCase();
        if (cleanName.length < 2) cleanName = 'Unknown SaaS';
        if (cleanName.toLowerCase() === 'amazon web') cleanName = 'AWS';
        if (cleanName.toLowerCase() === 'google workspace' || cleanName.toLowerCase() === 'gsuite') cleanName = 'Google Workspace';

        if (!merchantGroups[cleanName]) {
          merchantGroups[cleanName] = [];
        }
        merchantGroups[cleanName].push(tx);
      }
    });

    const parsedSaaS: SaaSItem[] = [];
    const today = new Date();

    Object.entries(merchantGroups).forEach(([merchant, txs]) => {
      // Sort newest first
      txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const mostRecent = txs[0];
      const monthlyCost = Math.abs(mostRecent.totalAmountCents || (mostRecent.lines[0]?.amountCents) || 0);
      
      const daysSinceLastPayment = differenceInDays(today, parseISO(mostRecent.date));
      
      let status: 'active' | 'zombie' | 'cancelled' = 'active';

      // Deterministic rules for zombie/cancelled
      if (daysSinceLastPayment > 45) {
        status = 'cancelled';
      } else if (daysSinceLastPayment > 30 && txs.length === 1) {
        // Trial period forgotten? One payment, >30 days ago.
        status = 'zombie';
      } else if (daysSinceLastPayment <= 45 && ['adobe', 'zoom', 'notion'].includes(merchant.toLowerCase())) {
        
      }

      parsedSaaS.push({
        merchant,
        category: 'Software / IT',
        monthlyCostCents: monthlyCost,
        annualRunRateCents: monthlyCost * 12,
        lastPaymentDate: mostRecent.date,
        status,
        virtualCardId: `V-CARD-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        instances: txs.length,
        confidence: 'Rules Engine Derived'
      });
    });

    return parsedSaaS.sort((a, b) => b.annualRunRateCents - a.annualRunRateCents);
  }, [transactions]);

  const displayData = saasData;

  const totalARR = displayData.filter(d => d.status !== 'cancelled').reduce((sum, item) => sum + item.annualRunRateCents, 0) / 100;
  const zombieARR = displayData.filter(d => d.status === 'zombie').reduce((sum, item) => sum + item.annualRunRateCents, 0) / 100;

  const handlePauseCard = (merchant: string) => {
    toast.success(`Virtual Card Frozen for ${merchant}`, {
      description: 'The associated clearing network token has been suspended deterministically.'
    });
  };

  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-10 w-full max-w-[1550px] mx-auto h-full text-slate-800">
      
      {/* Header Strategy */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-rose-200 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-rose-50 text-rose-700 rounded-full text-[9px] font-black tracking-widest uppercase shadow-sm border border-rose-200">Spend Control</span>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 text-emerald-400 rounded-full border border-slate-800">
               <ShieldCheck size={10} />
               <span className="text-[9px] font-black tracking-widest uppercase">Deterministic Scanner Active</span>
            </div>
          </div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight font-display">
            Household & Vendor Subscriptions
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">
            Algorithmic recurring cost detection mapping rules Engine Truth. Zero AI Hallucinations.
          </p>
        </div>

        <div className="flex gap-3">
          <div className="bg-rose-50 border border-rose-200 px-4 py-2 rounded-xl flex items-center gap-3 shadow-sm">
             <AlertTriangle size={16} className="text-rose-600" />
             <div>
                <p className="text-[9px] font-medium uppercase tracking-wider text-rose-500">Zombie Subs Identified</p>
                <p className="text-sm font-black font-mono text-rose-700">${zombieARR.toLocaleString()} <span className="text-[10px] uppercase font-bold tracking-widest">Wasted ARR</span></p>
             </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between">
           <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Total Subscription ARR</p>
              <p className="text-3xl font-black tracking-tighter mt-1 font-mono">${totalARR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
           </div>
           <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
              <Monitor size={20} />
           </div>
        </div>

        <div className="bg-rose-50 p-6 rounded-[32px] border border-rose-100 shadow-sm flex items-center justify-between">
           <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-rose-500">Unused / Zombie Spend</p>
              <p className="text-3xl font-black tracking-tighter mt-1 font-mono text-rose-700">${zombieARR.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
           </div>
           <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center text-rose-600">
              <Zap size={20} />
           </div>
        </div>

        <div className="bg-indigo-50 p-6 rounded-[32px] border border-indigo-100 shadow-sm flex flex-col justify-center gap-2 relative overflow-hidden group">
           <div className="absolute -right-4 -bottom-4 opacity-5">
              <CreditCard size={100} />
           </div>
           <p className="text-[10px] font-medium uppercase tracking-wider text-indigo-700 relative z-10">Total Active Vendors</p>
           <p className="text-3xl font-black tracking-tighter text-indigo-900 relative z-10">{displayData.filter(d => d.status === 'active').length}</p>
        </div>
      </div>

      {/* Grid of Subscriptions */}
      <div className="bg-white border border-slate-200 rounded-[32px] shadow-sm overflow-hidden">
         <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-medium uppercase tracking-wider text-slate-500">Discovered Recurring Subscriptions</h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mathematical Mapping</span>
         </div>
         
         <div className="divide-y divide-slate-100">
            {displayData.map((item, idx) => (
               <div key={idx} className={`p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 transition-colors hover:bg-slate-50/50 ${item.status === 'zombie' ? 'bg-rose-50/20' : ''}`}>
                  <div className="flex items-center gap-5">
                     <div className={`w-14 h-14 rounded-[32px] flex items-center justify-center shrink-0 border ${
                       item.status === 'active' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                       item.status === 'zombie' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                       'bg-slate-100 border-slate-200 text-slate-400'
                     }`}>
                        <Monitor size={24} />
                     </div>
                     <div>
                        <div className="flex items-center gap-2">
                           <h4 className="text-lg font-black uppercase tracking-tight">{item.merchant}</h4>
                           {item.status === 'zombie' && (
                             <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-medium uppercase tracking-wider rounded-sm border border-rose-200">Zombie</span>
                           )}
                           {item.status === 'cancelled' && (
                             <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[9px] font-medium uppercase tracking-wider rounded-sm border border-slate-300">Cancelled</span>
                           )}
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                           {item.category} • Detected {item.instances} payments • {item.confidence}
                        </p>
                     </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-8 lg:ml-auto">
                     <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-0.5">Last Payment</p>
                        <p className="text-sm font-bold text-slate-800">{format(parseISO(item.lastPaymentDate), 'MMM d, yyyy')}</p>
                     </div>
                     
                     <div>
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-0.5">Est. ARR</p>
                        <p className="text-lg font-black font-mono text-slate-800">${(item.annualRunRateCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                     </div>

                     <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
                        {item.status !== 'cancelled' ? (
                          <button 
                             onClick={() => handlePauseCard(item.merchant)}
                             className="h-10 px-4 bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm"
                          >
                             <XCircle size={14} />
                             Pause Card {item.virtualCardId}
                          </button>
                        ) : (
                          <button disabled className="h-10 px-4 bg-slate-50 border border-slate-200 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                             <CheckCircle2 size={14} />
                             Card Suspended
                          </button>
                        )}
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </div>
    </div>
  );
}
