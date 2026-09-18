import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/firestore';

export function requireOpenPeriod(dbOverride?: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId =
        (req.params?.workspaceId as string) ||
        (req.body?.workspaceId as string) ||
        (req.body?.transaction?.workspaceId as string) ||
        (req.query?.workspaceId as string) ||
        (req as any).user?.developerWorkspaceId;

      const date =
        req.body?.date ||
        req.body?.transaction?.date ||
        req.body?.invoice?.date ||
        req.body?.bill?.date ||
        req.body?.creditNote?.date;

      if (!workspaceId || !date) {
        return next();
      }

      const db = dbOverride || getDb();
      const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
      if (!wsDoc.exists) {
        return next();
      }

      const lockDate = wsDoc.data()?.lockDate;
      if (lockDate && date <= lockDate) {
        return res.status(400).json({
          status: 'error',
          error: `Period Locked: Data mutation forbidden before or on ${lockDate}`,
          message: `Period Locked: Data mutation forbidden before or on ${lockDate}`,
          code: 'PERIOD_LOCKED',
          lockDate
        });
      }

      return next();
    } catch (err: any) {
      return next(err);
    }
  };
}
