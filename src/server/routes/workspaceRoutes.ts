import express from 'express';
import admin from 'firebase-admin';
import { z } from 'zod';
import { getDb, validateWorkspaceMember } from '../db/firestore';

export const workspaceRouter = express.Router();

interface AuthUser extends admin.auth.DecodedIdToken {
  email_verified: boolean;
}

interface AuthenticatedRequest extends express.Request {
  user: AuthUser;
}

function sendError(res: express.Response, message: string, status: number = 500, details?: any) {
  res.status(status).json({
    status: 'error',
    message,
    ...(details && { details })
  });
}

/**
 * Middleware helper for checking per-workspace user role.
 */
export async function getWorkspaceUserRole(db: FirebaseFirestore.Firestore, workspaceId: string, uid: string): Promise<string> {
  const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
  if (!wsDoc.exists) throw new Error('NOT_FOUND');
  const data = wsDoc.data() || {};
  if (data.uid === uid) return 'owner';
  const role = data.roles?.[uid];
  return role || 'viewer';
}

export function requireWorkspaceRole(allowedRoles: string[]) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const workspaceId = req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;
    if (!workspaceId) return sendError(res, "Workspace ID required", 400);

    try {
      const db = getDb();
      await validateWorkspaceMember(db, String(workspaceId), authReq.user);
      const userRole = await getWorkspaceUserRole(db, String(workspaceId), authReq.user.uid);

      if (!allowedRoles.includes(userRole)) {
        return sendError(res, `Forbidden: requires one of roles [${allowedRoles.join(', ')}]`, 403);
      }

      (authReq as any).userRole = userRole;
      next();
    } catch (err: any) {
      if (err.message === 'FORBIDDEN') return sendError(res, 'Forbidden', 403);
      if (err.message === 'NOT_FOUND') return sendError(res, 'Workspace not found', 404);
      sendError(res, 'Role Authorization Error', 500, err.message);
    }
  };
}

/**
 * Task 5: Allocate next document number atomically within Firestore transaction.
 */
workspaceRouter.post('/:workspaceId/next-number', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const { workspaceId } = req.params;
  const schema = z.object({
    type: z.enum(['invoice', 'bill', 'estimate'])
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'Invalid request parameters', 400, parsed.error.issues);
  const { type } = parsed.data;

  try {
    const db = getDb();
    await validateWorkspaceMember(db, workspaceId, authReq.user);

    const wsRef = db.collection('workspaces').doc(workspaceId);

    const formattedNumber = await db.runTransaction(async (tx) => {
      const wsSnap = await tx.get(wsRef);
      if (!wsSnap.exists) throw new Error('NOT_FOUND');
      const wsData = wsSnap.data() || {};

      const numberingSeries = wsData.numberingSeries || {
        invoicePrefix: 'INV-',
        invoiceNextNumber: 1001,
        billPrefix: 'BILL-',
        billNextNumber: 501,
        estimatePrefix: 'EST-',
        estimateNextNumber: 2001
      };

      let prefix = '';
      let nextNum = 1;

      if (type === 'invoice') {
        prefix = numberingSeries.invoicePrefix || 'INV-';
        nextNum = numberingSeries.invoiceNextNumber || 1001;
        numberingSeries.invoiceNextNumber = nextNum + 1;
      } else if (type === 'bill') {
        prefix = numberingSeries.billPrefix || 'BILL-';
        nextNum = numberingSeries.billNextNumber || 501;
        numberingSeries.billNextNumber = nextNum + 1;
      } else if (type === 'estimate') {
        prefix = numberingSeries.estimatePrefix || 'EST-';
        nextNum = numberingSeries.estimateNextNumber || 2001;
        numberingSeries.estimateNextNumber = nextNum + 1;
      }

      tx.update(wsRef, {
        numberingSeries,
        updatedAt: new Date().toISOString()
      });

      return `${prefix}${nextNum}`;
    });

    res.json({ number: formattedNumber });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') return sendError(res, 'Forbidden', 403);
    if (err.message === 'NOT_FOUND') return sendError(res, 'Workspace not found', 404);
    sendError(res, 'Failed to allocate next document number', 500, err.message);
  }
});

/**
 * Task 6: Get workspace user roles map
 */
workspaceRouter.get('/:workspaceId/roles', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const { workspaceId } = req.params;

  try {
    const db = getDb();
    await validateWorkspaceMember(db, workspaceId, authReq.user);
    const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    if (!wsDoc.exists) return sendError(res, 'Workspace not found', 404);
    const data = wsDoc.data() || {};
    res.json({
      ownerUid: data.uid,
      roles: data.roles || {}
    });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') return sendError(res, 'Forbidden', 403);
    sendError(res, 'Failed to fetch roles', 500, err.message);
  }
});

/**
 * Task 6: Update workspace user role (Owner only)
 */
workspaceRouter.post('/:workspaceId/roles', requireWorkspaceRole(['owner']), async (req, res) => {
  const { workspaceId } = req.params;
  const schema = z.object({
    targetUid: z.string().min(1),
    role: z.enum(['owner', 'accountant', 'bookkeeper', 'viewer'])
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'Invalid role payload', 400, parsed.error.issues);
  const { targetUid, role } = parsed.data;

  try {
    const db = getDb();
    const wsRef = db.collection('workspaces').doc(workspaceId);
    
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(wsRef);
      if (!snap.exists) throw new Error('NOT_FOUND');
      const data = snap.data() || {};
      const roles = data.roles || {};
      roles[targetUid] = role;
      tx.update(wsRef, { roles, updatedAt: new Date().toISOString() });
    });

    res.json({ status: 'success', targetUid, role });
  } catch (err: any) {
    sendError(res, 'Failed to update workspace role', 500, err.message);
  }
});
