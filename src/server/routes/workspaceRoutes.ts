import { notify } from '../services/notificationService';
import express from 'express';
import type { DecodedIdToken } from '../auth/supabaseAuth';
import { z } from 'zod';
import { getDb, validateWorkspaceMember, FieldValue } from '../db/firestore';
import type { Firestore } from '../db/firestore';
import { writeServerAuditLog } from '../services/auditLogService';
import { seedDemoWorkspace } from '../../lib/demoWorkspaceSeeder';
import { formatTzDate } from './transactionRoutes';
import { applyAccountTemplate, TemplateError } from '../services/templateService';
import { importRecords, undoImport, ImportError } from '../services/recordImportService';
import { IMPORT_KINDS, MAX_IMPORT_ROWS } from '../../lib/recordImport';
import { periodRouter } from './periodRoutes';
import { badDebtRouter } from './badDebtRoutes';
import { emailRouter } from './emailRoutes';
import { taxRouter } from './taxRoutes';

export const workspaceRouter = express.Router();

interface AuthUser extends DecodedIdToken {
  email_verified: boolean;
}

export interface AuthenticatedRequest extends express.Request {
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
export async function getWorkspaceUserRole(db: Firestore, workspaceId: string, uid: string): Promise<string> {
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
      if (err.message === 'FORBIDDEN' || /Unauthorized|not a member/i.test(err.message || '')) return sendError(res, 'Forbidden', 403);
      if (err.message === 'NOT_FOUND' || /Workspace not found/i.test(err.message || '')) return sendError(res, 'Workspace not found', 404);
      sendError(res, 'Role Authorization Error', 500, err.message);
    }
  };
}

export async function allocateNextNumber(db: any, workspaceId: string, type: 'invoice' | 'bill' | 'estimate'): Promise<string> {
  const nsDocRef = db.collection('numberingSeries').doc(`${workspaceId}_${type}`);
  const wsRef = db.collection('workspaces').doc(workspaceId);

  return await db.runTransaction(async (tx: any) => {
    const nsSnap = await tx.get(nsDocRef);
    
    let prefix: string;
    let nextNum: number;
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
 * POST only to prevent prefetching/crawlers from mutating state (Finding E).
 */
// Apply a chart-of-accounts template on the server (templateService): owners and accountants
// manage the chart of accounts; the dashboard layout comes only from built-in templates.
const applyTemplateSchema = z.object({
  templateId: z.string().min(1).max(100).optional(),
  accounts: z.array(z.record(z.string(), z.unknown())).max(500).optional(),
}).refine(b => Boolean(b.templateId) !== Boolean(b.accounts), 'Send either templateId or accounts');

workspaceRouter.post('/:workspaceId/apply-template', requireWorkspaceRole(['owner', 'accountant']), async (req, res) => {
  try {
    const { workspaceId } = req.params as Record<string, string>;
    const body = applyTemplateSchema.parse(req.body);
    const result = await applyAccountTemplate(getDb(), { workspaceId, uid: (req as AuthenticatedRequest).user.uid, ...body });
    res.json({ status: 'success', ...result });
  } catch (err) {
    if (err instanceof z.ZodError) return sendError(res, 'Invalid template request', 400, err.issues);
    if (err instanceof TemplateError) return sendError(res, err.message, err.status);
    sendError(res, 'Could not apply the template', 500, err instanceof Error ? err.message : String(err));
  }
});

// Saved CSV column layouts for statement imports (src/lib/importColumnMaps.ts), keyed by the
// file's header signature. Anyone who imports statements (owner/accountant/bookkeeper) may save.
const importMapSchema = z.object({
  signature: z.string().regex(/^csv_\d{1,3}_[0-9a-f]{8}$/),
  columns: z.object(Object.fromEntries(['date', 'description', 'amount', 'debit', 'credit', 'payee', 'memo'].map(f => [f, z.string().min(1).max(200).optional()]))).strict(),
  skipRows: z.number().int().min(0).max(20),
}).strict();
const MAX_IMPORT_MAPS = 50;

workspaceRouter.post('/:workspaceId/import-maps', requireWorkspaceRole(['owner', 'accountant', 'bookkeeper']), async (req, res) => {
  try {
    const { workspaceId } = req.params as Record<string, string>;
    const { signature, columns, skipRows } = importMapSchema.parse(req.body);
    const db = getDb();
    const ref = db.collection('workspaces').doc(workspaceId);
    await db.runTransaction(async (t) => {
      const maps = { ...((await t.get(ref)).data()?.importColumnMaps || {}) } as Record<string, { savedAt?: string }>;
      maps[signature] = { columns, skipRows, savedAt: new Date().toISOString() } as { savedAt: string };
      // Keep the most recently used layouts only
      const keep = Object.entries(maps).sort((a, b) => String(b[1].savedAt || '').localeCompare(String(a[1].savedAt || ''))).slice(0, MAX_IMPORT_MAPS);
      t.update(ref, { importColumnMaps: Object.fromEntries(keep), updatedAt: new Date().toISOString() });
    });
    res.json({ status: 'success' });
  } catch (err) {
    if (err instanceof z.ZodError) return sendError(res, 'Invalid column layout', 400, err.issues);
    sendError(res, 'Could not save the column layout', 500, err instanceof Error ? err.message : String(err));
  }
});

// Closing the books: close / reopen / partial unlock / sign-offs (src/server/routes/periodRoutes.ts)
workspaceRouter.use('/:workspaceId/periods', requireWorkspaceRole(['owner', 'accountant', 'bookkeeper']), periodRouter);
// Emails to customers and their send log (src/server/routes/emailRoutes.ts)
workspaceRouter.use('/:workspaceId/emails', requireWorkspaceRole(['owner', 'accountant', 'bookkeeper', 'viewer']), emailRouter);
// Tax returns: members see them; filing checks owner/accountant in taxReturnService.ts
workspaceRouter.use('/:workspaceId/tax-returns', requireWorkspaceRole(['owner', 'accountant', 'bookkeeper', 'viewer']), taxRouter);
// Bad debt write-off and its reversal (src/server/routes/badDebtRoutes.ts)
workspaceRouter.use('/:workspaceId/invoices', requireWorkspaceRole(['owner', 'accountant']), badDebtRouter);

// Bulk import of customers, vendors, items or accounts from a spreadsheet (K-01; rules in
// src/lib/recordImport.ts). Writers may import; the chart of accounts is owner/accountant only.
const importRecordsSchema = z.object({
  kind: z.enum(IMPORT_KINDS),
  rows: z.array(z.record(z.string(), z.string().max(5000))).min(1).max(MAX_IMPORT_ROWS),
  openingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dryRun: z.boolean().optional(),
}).strict();
const LEDGER_ADMIN_ROLES = ['owner', 'accountant'];
const roleOf = (req: express.Request) => String((req as unknown as { userRole?: string }).userRole || '');

workspaceRouter.post('/:workspaceId/import-records', requireWorkspaceRole(['owner', 'accountant', 'bookkeeper']), async (req, res) => {
  try {
    const { workspaceId } = req.params as Record<string, string>;
    const body = importRecordsSchema.parse(req.body);
    if (body.kind === 'accounts' && !LEDGER_ADMIN_ROLES.includes(roleOf(req))) return sendError(res, 'Only owners and accountants can change the chart of accounts', 403);
    const { user } = req as AuthenticatedRequest;
    const result = await importRecords(getDb(), { workspaceId, uid: user.uid, email: user.email, ...body });
    res.json({ status: 'success', ...result });
  } catch (err) {
    if (err instanceof z.ZodError) return sendError(res, 'Invalid import request', 400, err.issues);
    if (err instanceof ImportError) return sendError(res, err.message, err.status, err.issues.length ? err.issues : undefined);
    sendError(res, 'Could not import the records', 500, err instanceof Error ? err.message : String(err));
  }
});

workspaceRouter.post('/:workspaceId/import-records/:batchId/undo', requireWorkspaceRole(['owner', 'accountant', 'bookkeeper']), async (req, res) => {
  try {
    const { workspaceId, batchId } = req.params as Record<string, string>;
    const { user } = req as AuthenticatedRequest;
    const result = await undoImport(getDb(), { workspaceId, uid: user.uid, email: user.email, batchId, allowAccounts: LEDGER_ADMIN_ROLES.includes(roleOf(req)) });
    res.json({ status: 'success', ...result });
  } catch (err) {
    if (err instanceof ImportError) return sendError(res, err.message, err.status);
    sendError(res, 'Could not undo the import', 500, err instanceof Error ? err.message : String(err));
  }
});

workspaceRouter.post('/:workspaceId/next-number', requireWorkspaceRole(['owner', 'accountant', 'bookkeeper']), async (req, res) => {
  const { workspaceId } = req.params as Record<string, string>;
  const rawType = req.body?.type;

  const schema = z.enum(['invoice', 'bill', 'estimate']);
  const parsed = schema.safeParse(rawType);
  if (!parsed.success) return sendError(res, 'Invalid request parameters. "type" (invoice, bill, estimate) is required in request body.', 400, parsed.error.issues);
  const type = parsed.data;

  try {
    const db = getDb();
    const formattedNumber = await allocateNextNumber(db, workspaceId, type);

    res.json({ number: formattedNumber });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') return sendError(res, 'Forbidden', 403);
    if (err.message === 'NOT_FOUND') return sendError(res, 'Workspace not found', 404);
    sendError(res, 'Failed to allocate next document number', 500, err.message);
  }
});

// Explicit 405 Method Not Allowed for GET/other methods on /:workspaceId/next-number
workspaceRouter.all('/:workspaceId/next-number', (req, res) => {
  res.setHeader('Allow', 'POST');
  return sendError(res, 'Method Not Allowed: allocate next document number must be called via POST.', 405);
});

import { generateInviteToken } from '../../lib/inviteManager';

export function countWorkspaceOwners(workspaceData: any): { count: number; ownerUids: string[] } {
  const ownerUids: string[] = [];
  if (workspaceData.uid) ownerUids.push(workspaceData.uid);
  if (workspaceData.roles) {
    for (const [uid, role] of Object.entries(workspaceData.roles)) {
      if (role === 'owner' && !ownerUids.includes(uid)) {
        ownerUids.push(uid);
      }
    }
  }
  return { count: ownerUids.length, ownerUids };
}

/**
 * Task 6: Get workspace user roles map
 */
workspaceRouter.get('/:workspaceId/roles', async (req, res) => {
  const authReq = req as unknown as AuthenticatedRequest;
  const { workspaceId } = req.params as Record<string, string>;

  try {
    const db = getDb();
    await validateWorkspaceMember(db, workspaceId, authReq.user);
    const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    if (!wsDoc.exists) return sendError(res, 'Workspace not found', 404);
    const data = wsDoc.data() || {};
    res.json({
      status: 'success',
      ownerUid: data.uid,
      roles: data.roles || {}
    });
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') return sendError(res, 'Forbidden', 403);
    sendError(res, 'Failed to fetch roles', 500, err.message);
  }
});

/**
 * Update workspace user role (Owner only) - Supports POST and PATCH /:workspaceId/roles/:uid
 */
const handleUpdateRole = async (req: express.Request, res: express.Response) => {
  const { workspaceId } = req.params as Record<string, string>;
  const targetUid = req.params.uid || req.body.targetUid;
  const schema = z.object({
    role: z.enum(['owner', 'accountant', 'bookkeeper', 'viewer'])
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success || !targetUid) return sendError(res, 'Invalid role payload or target user ID', 400, parsed.error?.issues);
  const { role } = parsed.data;

  try {
    const db = getDb();
    const wsRef = db.collection('workspaces').doc(workspaceId);

    let previousRole = 'viewer';

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(wsRef);
      if (!snap.exists) throw new Error('NOT_FOUND');
      const data = snap.data() || {};
      const { count, ownerUids } = countWorkspaceOwners(data);

      previousRole = data.roles?.[targetUid] || (data.uid === targetUid ? 'owner' : 'viewer');

      // Protect last owner from demotion
      if (role !== 'owner' && ownerUids.includes(targetUid) && count <= 1) {
        throw new Error('LAST_OWNER_PROTECTION');
      }

      const roles = { ...(data.roles || {}) };
      roles[targetUid] = role;
      tx.update(wsRef, { roles, updatedAt: new Date().toISOString() });

      // Record audit log entry
      await writeServerAuditLog({
        workspaceId,
        uid: (req as any).user.uid,
        email: (req as any).user.email || '',
        action: 'ROLE_CHANGE',
        entityType: 'workspace',
        entityId: workspaceId,
        details: {
          targetUid,
          beforeRole: previousRole,
          afterRole: role,
          description: `User ${targetUid} role updated from ${previousRole} to ${role}`
        }
      }, { db, tx });
    });

    res.json({ status: 'success', targetUid, role, previousRole });
  } catch (err: any) {
    if (err.message === 'LAST_OWNER_PROTECTION') {
      return sendError(res, 'Cannot demote or remove the last owner of the workspace.', 400);
    }
    if (err.message === 'NOT_FOUND') return sendError(res, 'Workspace not found', 404);
    sendError(res, 'Failed to update workspace role', 500, err.message);
  }
};

workspaceRouter.post('/:workspaceId/roles', requireWorkspaceRole(['owner']), handleUpdateRole);
workspaceRouter.patch('/:workspaceId/roles/:uid', requireWorkspaceRole(['owner']), handleUpdateRole);

/**
 * Invites Endpoints
 */
workspaceRouter.get('/:workspaceId/invites', requireWorkspaceRole(['owner', 'accountant']), async (req, res) => {
  const { workspaceId } = req.params as Record<string, string>;
  try {
    const db = getDb();
    const snap = await db.collection('invites').where('workspaceId', '==', workspaceId).limit(100).get();
    const invites = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ status: 'success', invites });
  } catch (err: any) {
    sendError(res, 'Failed to fetch invites', 500, err.message);
  }
});

workspaceRouter.post('/:workspaceId/invites', requireWorkspaceRole(['owner']), async (req, res) => {
  const { workspaceId } = req.params as Record<string, string>;
  const schema = z.object({
    email: z.string().email(),
    role: z.enum(['owner', 'accountant', 'bookkeeper', 'viewer']).default('viewer')
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 'Invalid invite payload', 400, parsed.error.issues);
  const { email, role } = parsed.data;

  try {
    const db = getDb();
    const wsRef = db.collection('workspaces').doc(workspaceId);
    const wsSnap = await wsRef.get();
    if (!wsSnap.exists) return sendError(res, 'Workspace not found', 404);

    const wsData = wsSnap.data() || {};
    const members: string[] = Array.isArray(wsData.members) ? wsData.members : [];
    const maxSeats = wsData.maxSeats || 5;
    const currentSeatCount = members.length + 1; // plus primary owner

    if (currentSeatCount >= maxSeats) {
      return sendError(
        res,
        `Payment Required: Workspace seat limit reached (${currentSeatCount}/${maxSeats} seats used). Upgrade plan to invite more team members.`,
        402
      );
    }

    const invite = generateInviteToken(workspaceId, email, role);
    const inviteRef = db.collection('invites').doc(invite.id || invite.token);

    await inviteRef.set({
      ...invite,
      invitedByUid: (req as any).user.uid,
      createdAt: new Date().toISOString()
    });

    // Write audit log entry
    await writeServerAuditLog({
      workspaceId,
      uid: (req as any).user.uid,
      email: (req as any).user.email || '',
      action: 'INVITE_SENT',
      entityType: 'workspace',
      entityId: workspaceId,
      details: {
        email: invite.email,
        role: invite.role,
        inviteId: invite.id,
        description: `Invite sent to ${invite.email} with role ${invite.role}`
      }
    }, { db });

    await notify(db, {
      workspaceId, kind: 'member.invited',
      title: `${invite.email} was invited`,
      message: `Invited as ${invite.role} by ${(req as any).user.email || 'a team member'}.`,
      eventKey: `member.invited:${invite.id || invite.token}`, actorUid: (req as any).user.uid,
    });
    res.json({ status: 'success', invite });
  } catch (err: any) {
    sendError(res, 'Failed to create workspace invite', 500, err.message);
  }
});

workspaceRouter.delete('/:workspaceId/invites/:inviteId', requireWorkspaceRole(['owner']), async (req, res) => {
  const { workspaceId, inviteId } = req.params as Record<string, string>;
  try {
    const db = getDb();
    const inviteRef = db.collection('invites').doc(inviteId);
    const snap = await inviteRef.get();
    if (!snap.exists) return sendError(res, 'Invite not found', 404);

    if (snap.data()?.workspaceId !== workspaceId) {
      return sendError(res, 'Forbidden', 403);
    }

    await inviteRef.update({
      status: 'revoked',
      updatedAt: new Date().toISOString()
    });

    res.json({ status: 'success', message: 'Invite revoked successfully' });
  } catch (err: any) {
    sendError(res, 'Failed to revoke invite', 500, err.message);
  }
});

/**
 * Task 4: Soft-delete workspace with 30-day retention (Owner only)
 * Never hard-deletes financial records or auditLogs (Finding Section 13A).
 */
workspaceRouter.delete('/:workspaceId', requireWorkspaceRole(['owner']), async (req, res) => {
  const { workspaceId } = req.params as Record<string, string>;
  try {
    const db = getDb();
    const wsRef = db.collection('workspaces').doc(workspaceId);
    const wsSnap = await wsRef.get();
    if (!wsSnap.exists) {
      return sendError(res, 'Workspace not found', 404);
    }

    const now = new Date();
    const scheduledPurgeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await wsRef.update({
      status: 'pending_deletion',
      deletedAt: now.toISOString(),
      scheduledPurgeAt,
      updatedAt: now.toISOString()
    });

    // Audit log entry - auditLogs must NEVER be deleted
    await writeServerAuditLog({
      workspaceId,
      uid: (req as any).user.uid,
      email: (req as any).user.email || '',
      action: 'WORKSPACE_DELETION_SCHEDULED',
      entityType: 'workspace',
      entityId: workspaceId,
      details: {
        description: `Workspace marked for deletion, scheduled for purge on ${scheduledPurgeAt}`,
        scheduledPurgeAt
      }
    }, { db });

    res.json({
      status: 'success',
      message: 'Workspace marked as pending deletion with a 30-day recovery window.',
      scheduledPurgeAt
    });
  } catch (err: any) {
    sendError(res, 'Failed to delete workspace', 500, err.message);
  }
});

/**
 * Restore workspace within retention window (Owner only)
 */
workspaceRouter.post('/:workspaceId/restore', requireWorkspaceRole(['owner']), async (req, res) => {
  const { workspaceId } = req.params as Record<string, string>;
  try {
    const db = getDb();
    const wsRef = db.collection('workspaces').doc(workspaceId);
    const wsSnap = await wsRef.get();
    if (!wsSnap.exists) {
      return sendError(res, 'Workspace not found', 404);
    }

    const wsData = wsSnap.data() || {};
    if (wsData.status !== 'pending_deletion') {
      return sendError(res, 'Workspace is not pending deletion', 400);
    }

    const now = new Date();
    await wsRef.update({
      status: 'active',
      deletedAt: FieldValue.delete(),
      scheduledPurgeAt: FieldValue.delete(),
      updatedAt: now.toISOString()
    });

    // Audit log entry
    await writeServerAuditLog({
      workspaceId,
      uid: (req as any).user.uid,
      email: (req as any).user.email || '',
      action: 'WORKSPACE_RESTORED',
      entityType: 'workspace',
      entityId: workspaceId,
      details: {
        description: 'Workspace restored from pending deletion'
      }
    }, { db });

    res.json({
      status: 'success',
      message: 'Workspace restored successfully.'
    });
  } catch (err: any) {
    sendError(res, 'Failed to restore workspace', 500, err.message);
  }
});

/**
 * Task 5: Seed Demo Data
 */
workspaceRouter.post('/:workspaceId/seed', requireWorkspaceRole(['owner', 'accountant', 'bookkeeper']), async (req, res) => {
  const { workspaceId } = req.params as Record<string, string>;
  const db = getDb();
  
  try {
    const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
    const wsTz = wsDoc.data()?.timezone || 'UTC';
    const now = new Date();
    const today = formatTzDate(now, wsTz);
    const invoiceDue = formatTzDate(new Date(now.getTime() + 30 * 86400000), wsTz);
    const billDue = formatTzDate(new Date(now.getTime() + 15 * 86400000), wsTz);

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
      date: today,
      dueDate: invoiceDue,
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
      date: today,
      dueDate: billDue,
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
