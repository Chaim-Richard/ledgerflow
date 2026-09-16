import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../../stores/useAuthStore';
import { CreditCard, Zap, Server, ChevronRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { auth } from '../../../firebase';

export default function BillingSettings() {
  const currentWorkspaceId = useAuthStore(state => state.currentWorkspaceId);
  const workspaces = useAuthStore(state => state.workspaces);
  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);
  const [billingStatus, setBillingStatus] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!currentWorkspace?.id || !auth.currentUser) return;

    const fetchStatus = async () => {
      try {
        const token = await auth.currentUser!.getIdToken();
        const res = await fetch(`/api/v1/billing/status?workspaceId=${currentWorkspace.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setBillingStatus(data);
      } catch (err) {
        console.error("Failed to fetch billing status");
      }
    };
    
    const verifyCheckout = async () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const checkoutStatus = params.get('checkout');
        const session_id = params.get('session_id');

        if (checkoutStatus === 'success' && session_id) {
          setIsVerifying(true);
          try {
            const token = await auth.currentUser!.getIdToken();
            const res = await fetch('/api/v1/billing/verify-session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                workspaceId: currentWorkspace.id,
                session_id
              })
            });
            const data = await res.json();
            if (data.status === 'success') {
              toast.success("Subscription payment successfully processed. Thank you!");
              await fetchStatus();
            } else {
              toast.error("Subscription could not be verified", { description: data.message });
            }
          } catch (e: any) {
            toast.error("Verification failed", { description: e.message || String(e) });
          } finally {
            setIsVerifying(false);
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } else if (checkoutStatus === 'canceled') {
          toast.info("Checkout was canceled.");
          window.history.replaceState({}, document.title, window.location.pathname);
          await fetchStatus();
        } else {
          await fetchStatus();
        }
      }
    };

    verifyCheckout();
  }, [currentWorkspace?.id]);

  const handleCheckout = async (plan: string) => {
    if (!currentWorkspace?.id || !auth.currentUser) return;
    try {
      const toastId = toast.loading('Initiating secure checkout via Stripe...');
      const token = await auth.currentUser.getIdToken();
      
      const res = await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          plan: plan
        })
      });
      
      const data = await res.json();
      if (data.url) {
        toast.dismiss(toastId);
        window.location.href = data.url;
      } else {
        throw new Error(data.message || 'Failed to create checkout session');
      }
    } catch (e: any) {
      toast.error('Checkout Error', { description: e.message || String(e) });
    }
  };

  const handleOpenPortal = async () => {
    if (!currentWorkspace?.id || !auth.currentUser) return;
    try {
      const toastId = toast.loading('Opening customer portal...');
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/v1/billing/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ workspaceId: currentWorkspace.id })
      });
      const data = await res.json();
      if (data.url) {
        toast.dismiss(toastId);
        window.location.href = data.url;
      } else {
        throw new Error(data.message || 'Customer portal unavailable');
      }
    } catch (e: any) {
      toast.error('Portal Error', { description: e.message || String(e) });
    }
  };

  const isPro = billingStatus?.billingCycle === 'pro' || billingStatus?.plan === 'pro' || billingStatus?.plan === 'growth' || billingStatus?.plan === 'enterprise';

  return (
    <div className="space-y-10">
      <div className="ledger-card p-6 md:p-12 bg-[var(--surface)] border-[var(--line)] shadow-sm">
        <div className="flex flex-col md:flex-row gap-10 md:items-center justify-between mb-10">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-indigo-600 text-white rounded-[32px] flex items-center justify-center shadow-xl shadow-indigo-600/20">
              <CreditCard size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-[var(--text)] tracking-tight uppercase tracking-widest">Subscription & Billing</h3>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Manage computational resources</p>
            </div>
          </div>
        </div>

        {isVerifying ? (
          <div className="p-6 md:p-12 text-center text-slate-500 font-medium animate-pulse">
            Verifying secure payment session...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={`p-8 border rounded-[32px] space-y-6 transition-colors ${!isPro ? 'border-indigo-600 bg-indigo-50/50 shadow-sm relative overflow-hidden group' : 'border-[var(--line)] hover:border-indigo-200 bg-[var(--ink)]'}`}>
              {!isPro && (
                <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-lg">
                  Current Plan
                </div>
              )}
              <div className="flex justify-between items-start">
                <div>
                  <h4 className={`text-sm font-black uppercase tracking-tight ${!isPro ? 'text-indigo-900' : 'text-[var(--text)]'}`}>Free Tier</h4>
                  <p className={`text-[11px] font-medium mt-1 ${!isPro ? 'text-indigo-700/70' : 'text-slate-500'}`}>Local computations</p>
                </div>
                <span className={`text-2xl font-black ${!isPro ? 'text-indigo-900' : 'text-[var(--text)]'}`}>$0<span className={`text-sm ${!isPro ? 'text-indigo-600' : 'text-slate-500'}`}>/mo</span></span>
              </div>
              
              <ul className={`space-y-3 pb-6 border-b text-xs font-medium ${!isPro ? 'border-indigo-200 text-indigo-800' : 'border-[var(--line)] text-slate-600'}`}>
                <li className="flex items-center gap-2"><Zap size={12} className={!isPro ? 'text-indigo-500' : 'text-slate-400'} /> Basic AI classification</li>
                <li className="flex items-center gap-2"><Server size={12} className={!isPro ? 'text-indigo-500' : 'text-slate-400'} /> 10,000 API Compute Credits</li>
              </ul>

              <button disabled className={`w-full py-3 font-bold text-xs uppercase tracking-wider rounded-xl cursor-not-allowed ${!isPro ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`} aria-label="Current Plan">
                Current Plan
              </button>
            </div>

            <div className={`p-8 border rounded-[32px] space-y-6 transition-colors ${isPro ? 'border-indigo-600 bg-indigo-50/50 shadow-sm relative overflow-hidden group' : 'border-[var(--line)] hover:border-indigo-200 bg-[var(--ink)] relative overflow-hidden group'}`}>
              {isPro ? (
                <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-lg">
                  Current Plan
                </div>
              ) : (
                <div className="absolute top-0 right-0 bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-lg">
                  Recommended
                </div>
              )}

              <div className="flex justify-between items-start">
                <div>
                  <h4 className={`text-sm font-black uppercase tracking-tight ${isPro ? 'text-indigo-900' : 'text-[var(--text)]'}`}>Pro Network</h4>
                  <p className={`text-[11px] font-medium mt-1 ${isPro ? 'text-indigo-700/70' : 'text-slate-500'}`}>Full cloud acceleration</p>
                </div>
                <span className={`text-2xl font-black ${isPro ? 'text-indigo-900' : 'text-[var(--text)]'}`}>$5<span className={`text-sm ${isPro ? 'text-indigo-600' : 'text-slate-500'}`}>/mo</span></span>
              </div>
              
              <ul className={`space-y-3 pb-6 border-b text-xs font-medium ${isPro ? 'border-indigo-200 text-indigo-800' : 'border-[var(--line)] text-slate-700'}`}>
                <li className="flex items-center gap-2"><Zap size={12} className={isPro ? 'text-indigo-500 fill-indigo-500' : 'text-slate-400'} /> Advanced Rule Tracing</li>
                <li className="flex items-center gap-2"><Server size={12} className={isPro ? 'text-indigo-500' : 'text-slate-400'} /> Dynamic Resource Allocation</li>
                <li className="flex items-center gap-2"><CreditCard size={12} className={isPro ? 'text-indigo-500' : 'text-slate-400'} /> Pay-as-you-go Usage ($10 overage)</li>
              </ul>

              {isPro ? (
                <button 
                  onClick={handleOpenPortal}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex justify-center items-center gap-2 cursor-pointer shadow-md" 
                  aria-label="Manage Subscription Portal"
                >
                  <CheckCircle2 size={16} /> Manage Subscription & Billing Portal
                </button>
              ) : (
                <button 
                  onClick={() => handleCheckout("pro")}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex justify-center items-center gap-2"
                >
                  Upgrade to Pro
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
