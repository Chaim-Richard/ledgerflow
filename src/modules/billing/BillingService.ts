// Architecture: Billing & Usage Metric Tracker
// Centralized service for tracking users, charging, and establishing feature gates.
// 5* Modularity: New features can ask BillingService if they are allowed to execute.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from '../../stores/useAuthStore';
import { useLedgerStore } from '../../stores/useLedgerStore';

export interface BillingState {
  currentPlan: 'free' | 'pro' | 'enterprise';
  transactionCount: number;
  userCount: number; // Tracks registered collaborative users
  freeWorkspaceTxCap: number;
  maxRegistrationLimit: number;
  totalSystemUsers: number;
  registrationAllowed: boolean;
  incrementTransaction: () => void;
  incrementUserCount: () => void;
  upgradePlan: (plan: 'pro' | 'enterprise') => void;
  fetchSystemCaps: () => Promise<void>;
  checkQuota: () => boolean; // Enforcement for 'integrity' of usage metrics
}

export const useBillingStore = create<BillingState>()(
  persist(
    (set, get) => ({
      currentPlan: 'free',
      transactionCount: 0,
      userCount: 1,
      freeWorkspaceTxCap: 100,
      maxRegistrationLimit: 100,
      totalSystemUsers: 1,
      registrationAllowed: true,
      incrementTransaction: () => set((state) => ({ transactionCount: state.transactionCount + 1 })),
      incrementUserCount: () => set((state) => ({ userCount: state.userCount + 1 })),
      upgradePlan: (plan) => set({ currentPlan: plan }),
      fetchSystemCaps: async () => {
        try {
          const res = await fetch('/api/v1/public/registration-status');
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'success') {
              set({
                freeWorkspaceTxCap: data.freeWorkspaceTxCap ?? 100,
                maxRegistrationLimit: data.maxRegistrationLimit ?? 100,
                totalSystemUsers: data.totalUsers ?? 1,
                registrationAllowed: data.registrationAllowed ?? true
              });
            }
          }
        } catch (e: any) {
          // Gracefully ignore aborted fetch on component unmount / dev reload
          if (e?.name !== 'AbortError') {
            console.debug("Registration status offline fallback enabled:", e?.message || e);
          }
        }
      },
      checkQuota: () => {
        // Get real current workspace and transactions
        const currentWorkspace = useAuthStore.getState().getCurrentWorkspace();
        const transactions = useLedgerStore.getState().transactions;
        const txCount = transactions?.length ?? get().transactionCount;
        
        const plan = currentWorkspace?.plan || 'free';
        const isFree = plan === 'free';
        
        if (isFree) {
          const cap = get().freeWorkspaceTxCap ?? 100;
          if (txCount >= cap) return false;
        } else if (plan === 'growth') {
          if (txCount >= 1000) return false;
        }
        return true;
      }
    }),
    {
      name: 'ledgerflow-billing-storage'
    }
  )
);

export const BillingAPI = {
  // External API wrapper for Stripe/payment processing
  async chargeUser(amountCents: number, currency: string = 'USD') {
    // Integrate Stripe or equivalent here to process real logic
    console.debug(`Processing charge of ${amountCents} ${currency} for usage.`);
    return true; 
  }
};
