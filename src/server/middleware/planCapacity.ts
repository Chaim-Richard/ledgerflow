import express from 'express';
import { getDb } from '../db/firestore';

export const PLAN_LIMITS: Record<string, { transactions: number; seats: number }> = {
  free: { transactions: 100, seats: 1 },
  sandbox: { transactions: 100, seats: 1 },
  growth: { transactions: 1000, seats: 5 },
  pro: { transactions: 10000, seats: 25 },
  enterprise: { transactions: 1000000, seats: 1000 }
};

export function requirePlanCapacity(resource: 'transactions' | 'seats' | 'storage', dbOverride?: any) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const workspaceId =
        (req.params?.workspaceId as string) ||
        (req.body?.workspaceId as string) ||
        (req.body?.transaction?.workspaceId as string) ||
        (req.query?.workspaceId as string) ||
        (req as any).user?.developerWorkspaceId;

      if (!workspaceId) {
        return res.status(400).json({ status: 'error', message: 'Missing workspaceId parameter' });
      }

      const db = dbOverride || getDb();
      const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
      if (!wsDoc.exists) {
        return res.status(404).json({ status: 'error', message: 'Workspace not found' });
      }

      const wsData = wsDoc.data() || {};
      if (wsData.bypassBilling === true) {
        return next();
      }

      const plan = (wsData.plan || 'free').toLowerCase();
      const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

      if (resource === 'transactions') {
        const txCap = wsData.apiQuotaMonthlyLimitCents ? Math.floor(wsData.apiQuotaMonthlyLimitCents / 100) : limits.transactions;
        const txSnap = await db.collection('transactions').where('workspaceId', '==', workspaceId).get();
        const txCount = txSnap.size;

        if (txCount >= txCap) {
          return res.status(402).json({
            status: 'error',
            message: `Payment Required: Plan transaction limit reached (${txCount}/${txCap}). Upgrade workspace plan to continue creating transactions.`,
            code: 'PLAN_CAPACITY_EXCEEDED',
            cap: txCap,
            current: txCount
          });
        }
      } else if (resource === 'seats') {
        const seatCap = wsData.concurrentUserLimit || wsData.maxSeats || limits.seats;
        const members = wsData.members || [];
        const memberCount = Array.isArray(members) ? members.length : 1;

        if (memberCount >= seatCap) {
          return res.status(402).json({
            status: 'error',
            message: `Payment Required: Plan user seat limit reached (${memberCount}/${seatCap}). Upgrade workspace plan to invite more team members.`,
            code: 'SEAT_CAPACITY_EXCEEDED',
            cap: seatCap,
            current: memberCount
          });
        }
      } else if (resource === 'storage') {
        const storageCapMb = wsData.maxStorageMb || (plan === 'enterprise' ? 100000 : plan === 'pro' ? 25000 : plan === 'growth' ? 5000 : 500);
        const currentStorageMb = wsData.currentStorageMb || 0;
        if (currentStorageMb >= storageCapMb) {
          return res.status(402).json({
            status: 'error',
            message: `Payment Required: Plan storage limit reached (${currentStorageMb}/${storageCapMb} MB). Upgrade workspace plan for additional document storage.`,
            code: 'STORAGE_CAPACITY_EXCEEDED',
            cap: storageCapMb,
            current: currentStorageMb
          });
        }
      }

      next();
    } catch (err: any) {
      console.error('[requirePlanCapacity] Quota check error:', err);
      return res.status(500).json({ status: 'error', message: err.message || 'Capacity verification failed' });
    }
  };
}
