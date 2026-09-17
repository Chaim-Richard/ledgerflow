import express from 'express';
import admin from 'firebase-admin';
import { z } from 'zod';
import { getDb, validateWorkspaceMember } from '../db/firestore';
import { seedDemoWorkspace } from '../../lib/demoWorkspaceSeeder';

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

export async function allocateNextNumber(db: any, workspaceId: string, type: 'invoice' | 'bill' | 'estimate'): Promise<string> {
  const nsDocRef = db.collection('numberingSeries').doc(`${workspaceId}_${type}`);
  const wsRef = db.collection('workspaces').doc(workspaceId);

  return await db.runTransaction(async (tx: any) => {
    const nsSnap = await tx.get(nsDocRef);
    
    let prefix = '';
    let nextNum = 1;
    let padding = 4;

    if (nsSnap.exists) {
      const data = nsSnap.data() || {};
      prefix = data.prefix ?? (type === 'invoice' ? 'INV-2026-' : type === 'bill' ? 'BIL-2026-' : 'EST-2026-');
      nextNum = data.nextNumber ?? 1;
      padding = data.padding ?? 4;

      tx.update(nsDocRef, {
        nextNumber: nextNum + 1,
        updatedAt: new Date().toISOString()
      });
    } else {
      // Read-through fallback: try to load numberingSeries from the Workspace document
      const wsSnap = await tx.get(wsRef);
      const wsData = wsSnap.exists ? (wsSnap.data() || {}) : {};
      const ns = wsData.numberingSeries || {};

      if (ns[type] && typeof ns[type] === 'object') {
        prefix = ns[type].prefix ?? (type === 'invoice' ? 'INV-2026-' : type === 'bill' ? 'BIL-2026-' : 'EST-2026-');
        nextNum = ns[type].nextNumber ?? 1;
        padding = ns[type].padding ?? 4;
      } else {
        // Fallback for legacy simple fields
        if (type === 'invoice') {
          prefix = ns.invoicePrefix || 'INV-2026-';
          nextNum = ns.invoiceNextNumber || 1;
        } else if (type === 'bill') {
          prefix = ns.billPrefix || 'BIL-2026-';
          nextNum = ns.billNextNumber || 1;
        } else if (type === 'estimate') {
          prefix = ns.estimatePrefix || 'EST-2026-';
          nextNum = ns.estimateNextNumber || 1;
        } else {
          prefix = type === 'invoice' ? 'INV-2026-' : type === 'bill' ? 'BIL-2026-' : 'EST-2026-';
          nextNum = 1;
        }
      }

      tx.set(nsDocRef, {
        workspaceId,
        type,
        prefix,
        nextNumber: nextNum + 1,
        padding,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    return `${prefix}${String(nextNum).padStart(padding, '0')}`;
  });
}

/**
 * Task 5: Allocate next document number atomically within Firestore transaction.
 */
workspaceRouter.all('/:workspaceId/next-number', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const { workspaceId } = req.params;
  const rawType = (req.query.type || req.body?.type) as string;

  const schema = z.enum(['invoice', 'bill', 'estimate']);
  const parsed = schema.safeParse(rawType);
  if (!parsed.success) return sendError(res, 'Invalid request parameters', 400, parsed.error.issues);
  const type = parsed.data;

  try {
    const db = getDb();
    await validateWorkspaceMember(db, workspaceId, authReq.user);
    const formattedNumber = await allocateNextNumber(db, workspaceId, type);

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

/**
 * Task 4: Delete workspace (Owner only)
 */
workspaceRouter.delete('/:workspaceId', requireWorkspaceRole(['owner']), async (req, res) => {
  const { workspaceId } = req.params;
  try {
    const db = getDb();
    
    // We could delete all nested collections, but typically we want to leave this to a background job or just delete the top-level document
    // For now, we will delete the top level workspace doc. In a real environment we would spawn a background function to delete all data.
    await db.collection('workspaces').doc(workspaceId).delete();
    
    // Adding a basic deletion of all core entities in this workspace (not recursively complete for huge datasets without a batch loop, but sufficient for standard scale)
    const collectionsToClear = [
      'transactions', 'accounts', 'journalEntries', 'projects', 'budgets', 
      'vendors', 'customers', 'invoices', 'bills', 'inventory', 'assets', 
      'recurring', 'employees', 'payRuns', 'taxRates', 'auditLogs'
    ];
    
    // In background
    (async () => {
      try {
        for (const coll of collectionsToClear) {
          const snapshot = await db.collection(coll).where('workspaceId', '==', workspaceId).get();
          const batch = db.batch();
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          if (snapshot.size > 0) {
            await batch.commit();
          }
        }
      } catch (e) {
        console.error('Failed to cleanup workspace data', e);
      }
    })();
    
    res.json({ status: 'success', message: 'Workspace deleted successfully.' });
  } catch (err: any) {
    sendError(res, 'Failed to delete workspace', 500, err.message);
  }
});

/**
 * Task 5: Seed Demo Data
 */
workspaceRouter.post('/:workspaceId/seed', requireWorkspaceRole(['owner', 'accountant', 'bookkeeper']), async (req, res) => {
  const { workspaceId } = req.params;
  const db = getDb();
  
  try {
    const demoData = seedDemoWorkspace(workspaceId);
    const batch = db.batch();

    // Write demo chart accounts
    demoData.accounts.forEach(acc => {
      const ref = db.collection('chartAccounts').doc(`${workspaceId}_${acc.id}`);
      batch.set(ref, { ...acc, uid: (req as any).user.uid, workspaceId });
    });

    // Write demo transactions
    demoData.transactions.forEach(tx => {
      const ref = db.collection('transactions').doc(`${workspaceId}_${tx.id}`);
      batch.set(ref, { ...tx, uid: (req as any).user.uid, workspaceId });
    });
    
    // Add Demo Customer
    const customerRef = db.collection('customers').doc();
    batch.set(customerRef, {
      uid: (req as any).user.uid,
      workspaceId,
      name: 'Acme Corporation',
      email: 'billing@acme.com',
      status: 'active'
    });

    // Add Demo Vendor
    const vendorRef = db.collection('vendors').doc();
    batch.set(vendorRef, {
      uid: (req as any).user.uid,
      workspaceId,
      name: 'Cloud Services Ltd',
      category: 'Software',
      status: 'active'
    });
    
    // Add Demo Invoice
    const invoiceRef = db.collection('invoices').doc();
    batch.set(invoiceRef, {
      uid: (req as any).user.uid,
      workspaceId,
      customerId: customerRef.id,
      customerName: 'Acme Corporation',
      number: `INV-DEMO-001`,
      amountCents: 500000,
      totalCents: 500000,
      date: new Date().toISOString().slice(0,10),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10),
      status: 'sent',
      type: 'standard',
      items: [
        {
          id: 'item-1',
          description: 'Consulting Services',
          quantity: 1,
          rateCents: 500000,
          amountCents: 500000,
          accountId: 'income-acct'
        }
      ]
    });

    // Add Demo Bill
    const billRef = db.collection('bills').doc();
    batch.set(billRef, {
      uid: (req as any).user.uid,
      workspaceId,
      vendorId: vendorRef.id,
      vendorName: 'Cloud Services Ltd',
      number: `BILL-DEMO-001`,
      amountCents: 120000,
      date: new Date().toISOString().slice(0,10),
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().slice(0,10),
      status: 'pending',
      splits: [
        {
          amountCents: 120000,
          accountId: 'expense-acct',
          description: 'Server Hosting'
        }
      ]
    });

    await batch.commit();
    res.json({ status: 'success', message: 'Demo data seeded' });
  } catch (e: any) {
    sendError(res, 'Failed to seed demo data', 500, e.message);
  }
});
